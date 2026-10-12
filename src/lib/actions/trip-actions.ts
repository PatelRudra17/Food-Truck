"use server";

import { Prisma, Grade, type TripStatus, type SalesOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError, paginationSchema, paginationMeta } from "@/lib/validators/common";
import { createTripSchema, tripCancelSchema } from "@/lib/validators/trip";
import { nextDocumentNumber } from "@/lib/numbering";
import { checkTripEligibility, type TripEligibilityItem } from "@/lib/services/trip-eligibility";
import { applyGradeStockMovement } from "@/lib/services/produce-inventory";

function revalidateTrip(id?: string) {
  revalidatePath("/dispatch");
  revalidatePath("/dispatch/trips");
  if (id) revalidatePath(`/dispatch/trips/${id}`);
}

function revalidateSalesOrders(ids: Iterable<string>) {
  revalidatePath("/sales/orders");
  for (const id of ids) revalidatePath(`/sales/orders/${id}`);
}

/** Trip statuses whose goods have physically left (stock already decremented). */
const SHIPPED_TRIP_STATUSES: TripStatus[] = ["DISPATCHED", "DELIVERED", "RETURNED"];

/** Sales order statuses a trip may be raised against. */
const DISPATCHABLE_SO_STATUSES: SalesOrderStatus[] = ["APPROVED", "READY_FOR_DISPATCH", "PARTIALLY_FULFILLED"];

/**
 * SalesOrderItem.fulfilledQty is the quantity COMMITTED to non-cancelled trips
 * (incremented at trip creation, released on cancel) and is what caps new
 * trips. The SO's status, however, reflects what has actually SHIPPED: the
 * sum of TripItem quantities on dispatched/delivered/returned trips per line.
 * All lines shipped in full -> COMPLETED, some shipped -> PARTIALLY_FULFILLED.
 * Orders not yet in a dispatchable/fulfilment state are left alone.
 */
async function recomputeSalesOrderStatus(tx: Prisma.TransactionClient, salesOrderId: string) {
  const so = await tx.salesOrder.findUnique({ where: { id: salesOrderId }, include: { items: true } });
  if (!so) return;
  if (!([...DISPATCHABLE_SO_STATUSES, "COMPLETED"] as SalesOrderStatus[]).includes(so.status)) return;

  const shippedRows = await tx.tripItem.groupBy({
    by: ["salesOrderItemId"],
    where: {
      salesOrderItemId: { in: so.items.map((i) => i.id) },
      trip: { status: { in: SHIPPED_TRIP_STATUSES } },
    },
    _sum: { quantity: true },
  });
  const shippedByLine = new Map(
    shippedRows.map((r) => [r.salesOrderItemId, new Prisma.Decimal(r._sum.quantity ?? 0)]),
  );
  const shipped = (lineId: string) => shippedByLine.get(lineId) ?? new Prisma.Decimal(0);

  const allShipped = so.items.length > 0 && so.items.every((i) => shipped(i.id).gte(i.quantity));
  const anyShipped = so.items.some((i) => shipped(i.id).gt(0));

  const nextStatus: SalesOrderStatus = allShipped
    ? "COMPLETED"
    : anyShipped
      ? "PARTIALLY_FULFILLED"
      : so.status === "COMPLETED" || so.status === "PARTIALLY_FULFILLED"
        ? "READY_FOR_DISPATCH"
        : so.status;

  if (nextStatus !== so.status) {
    await tx.salesOrder.update({ where: { id: so.id }, data: { status: nextStatus } });
  }
}

/** Every sales order a trip touches — via Trip.salesOrderId or any line's salesOrderItemId. */
/**
 * Takes a trip line's graded stock from wherever it sits: the item's home warehouse
 * first, then the warehouses holding the most. Any shortfall (only possible when the
 * stock check was overridden) is applied to the home warehouse, so the normal
 * negative-stock rule in applyGradeStockMovement decides whether it's allowed.
 */
async function takeGradeStockForTrip(
  tx: Prisma.TransactionClient,
  params: {
    itemId: string;
    homeWarehouseId: string | null;
    grade: Grade;
    quantity: number;
    trip: { id: string; tripNumber: string };
    userId: string;
  },
) {
  const stocks = await tx.itemGradeStock.findMany({
    where: { itemId: params.itemId, grade: params.grade, quantity: { gt: 0 } },
    orderBy: { quantity: "desc" },
  });
  stocks.sort((a, b) => Number(b.warehouseId === params.homeWarehouseId) - Number(a.warehouseId === params.homeWarehouseId));

  const take = (warehouseId: string, quantity: Prisma.Decimal) =>
    applyGradeStockMovement(tx, {
      itemId: params.itemId,
      warehouseId,
      grade: params.grade,
      transactionType: "DISPATCH",
      direction: "DECREASE",
      quantity,
      referenceType: "Trip",
      referenceId: params.trip.id,
      referenceNumber: params.trip.tripNumber,
      userId: params.userId,
    });

  let remaining = new Prisma.Decimal(params.quantity);
  for (const stock of stocks) {
    if (remaining.lte(0)) break;
    const quantity = Prisma.Decimal.min(remaining, stock.quantity);
    await take(stock.warehouseId, quantity);
    remaining = remaining.minus(quantity);
  }
  if (remaining.gt(0)) {
    const warehouseId = params.homeWarehouseId ?? stocks[0]?.warehouseId;
    if (!warehouseId) throw new Error(`There is no ${params.grade.replace("_", " ")} stock of this item in any warehouse.`);
    await take(warehouseId, remaining);
  }
}

async function linkedSalesOrderIds(
  tx: Prisma.TransactionClient,
  trip: { salesOrderId: string | null; items: { salesOrderItemId: string | null }[] },
) {
  const ids = new Set<string>();
  if (trip.salesOrderId) ids.add(trip.salesOrderId);
  const lineIds = trip.items.map((i) => i.salesOrderItemId).filter((v): v is string => !!v);
  if (lineIds.length > 0) {
    const lines = await tx.salesOrderItem.findMany({
      where: { id: { in: lineIds } },
      select: { salesOrderId: true },
    });
    for (const line of lines) ids.add(line.salesOrderId);
  }
  return [...ids];
}

/**
 * Creates a Trip + its TripItems in one transaction after running the combined
 * vehicle/driver/stock eligibility check. If the check fails, dispatch is
 * blocked unless the user both requests an override AND holds the matching
 * special permission for every category of failure found
 * (OVERRIDE_MAINTENANCE_BLOCK for vehicle/driver issues, OVERRIDE_NEGATIVE_STOCK
 * for stock issues) — in which case Trip.eligibilityOverride/Reason are set and
 * a DISPATCH_OVERRIDE audit entry is written.
 */
export async function createTripAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("TRIP_CREATE");
    const data = createTripSchema.parse(input);

    const [vehicle, driver, customer] = await Promise.all([
      prisma.vehicle.findUnique({ where: { id: data.vehicleId } }),
      prisma.driver.findUnique({ where: { id: data.driverId } }),
      prisma.customer.findUnique({ where: { id: data.customerId } }),
    ]);
    if (!vehicle) return { ok: false, error: "Selected vehicle does not exist." };
    if (!driver) return { ok: false, error: "Selected driver does not exist." };
    if (!customer) return { ok: false, error: "Selected customer does not exist." };

    const itemIds = [...new Set(data.items.map((line) => line.itemId))];
    const items = await prisma.item.findMany({ where: { id: { in: itemIds } } });
    const itemsById = new Map(items.map((i) => [i.id, i]));

    // Trip/TripItem carry no warehouse: stock is checked across all warehouses and
    // taken home-warehouse first at dispatch (see takeGradeStockForTrip).
    const eligibilityItems: TripEligibilityItem[] = [];
    for (const line of data.items) {
      const item = itemsById.get(line.itemId);
      if (!item) return { ok: false, error: "One of the selected items no longer exists." };
      eligibilityItems.push({ itemId: item.id, itemName: item.name, grade: line.grade, quantity: line.quantity });
    }

    const eligibility = await checkTripEligibility({ vehicle, driver, items: eligibilityItems });

    let overrideUsed = false;
    if (!eligibility.allowed) {
      const needsVehicleDriverOverride = eligibility.vehicleDriverReasons.length > 0;
      const needsStockOverride = eligibility.stockReasons.length > 0;
      const hasVehicleDriverOverride = user.permissions.includes("OVERRIDE_MAINTENANCE_BLOCK");
      const hasStockOverride = user.permissions.includes("OVERRIDE_NEGATIVE_STOCK");

      const fullyCovered =
        data.overrideEligibility &&
        (!needsVehicleDriverOverride || hasVehicleDriverOverride) &&
        (!needsStockOverride || hasStockOverride);

      if (!fullyCovered) {
        return { ok: false, error: `Dispatch blocked: ${eligibility.reasons.join(" ")}` };
      }
      overrideUsed = true;
    }

    const linesWithSoItem = data.items.filter((line) => line.salesOrderItemId);
    if (linesWithSoItem.length > 0 && !data.salesOrderId) {
      return { ok: false, error: "Sales order lines can only be dispatched on a trip linked to that sales order." };
    }

    const created = await prisma.$transaction(async (tx) => {
      // Validate the sales order link inside the transaction so the remaining-quantity
      // check reads the same fulfilledQty values the increments below build on.
      if (data.salesOrderId) {
        const so = await tx.salesOrder.findUnique({ where: { id: data.salesOrderId }, include: { items: true } });
        if (!so) throw new Error("Selected sales order does not exist.");
        if (!DISPATCHABLE_SO_STATUSES.includes(so.status)) {
          throw new Error(
            `Sales order ${so.soNumber} is ${so.status.toLowerCase().replace(/_/g, " ")} and cannot be dispatched.`,
          );
        }
        if (so.customerId !== data.customerId) {
          throw new Error(`Sales order ${so.soNumber} belongs to a different customer than the one selected for this trip.`);
        }

        const soItemsById = new Map(so.items.map((i) => [i.id, i]));
        const requestedByLine = new Map<string, number>();
        for (const line of linesWithSoItem) {
          const soItem = soItemsById.get(line.salesOrderItemId as string);
          if (!soItem) throw new Error(`A trip line does not belong to sales order ${so.soNumber}.`);
          if (soItem.itemId !== line.itemId) {
            throw new Error(`A trip line's item does not match its sales order ${so.soNumber} line.`);
          }
          requestedByLine.set(soItem.id, (requestedByLine.get(soItem.id) ?? 0) + line.quantity);
        }
        for (const [lineId, requested] of requestedByLine) {
          const soItem = soItemsById.get(lineId)!;
          const remaining = Number(soItem.quantity) - Number(soItem.fulfilledQty);
          if (requested > remaining + 1e-9) {
            const itemName = itemsById.get(soItem.itemId)?.name ?? "item";
            throw new Error(
              `Only ${Math.max(0, remaining).toLocaleString()} of "${itemName}" remains on sales order ${so.soNumber}; this trip requests ${requested.toLocaleString()}.`,
            );
          }
        }
      }

      const tripNumber = await nextDocumentNumber(tx, "TRIP");
      const trip = await tx.trip.create({
        data: {
          tripNumber,
          salesOrderId: data.salesOrderId,
          customerId: data.customerId,
          routeId: data.routeId,
          vehicleId: data.vehicleId,
          driverId: data.driverId,
          loadingStaffId: data.loadingStaffId,
          departureAt: data.departureAt ? new Date(data.departureAt) : null,
          expectedArrivalAt: data.expectedArrivalAt ? new Date(data.expectedArrivalAt) : null,
          remarks: data.remarks,
          eligibilityOverride: overrideUsed,
          eligibilityOverrideReason: overrideUsed ? data.eligibilityOverrideReason : null,
          status: "CREATED",
          createdById: user.id,
          items: {
            create: data.items.map((line) => ({
              salesOrderItemId: line.salesOrderItemId,
              itemId: line.itemId,
              grade: line.grade,
              quantity: line.quantity,
              cratesCount: line.cratesCount ?? null,
            })),
          },
        },
      });

      // Commit the quantity against the SO lines (validated above). Released again by
      // cancelTripAction; the SO's status is recomputed from shipped quantity on dispatch.
      for (const line of linesWithSoItem) {
        await tx.salesOrderItem.update({
          where: { id: line.salesOrderItemId as string },
          data: { fulfilledQty: { increment: line.quantity } },
        });
      }

      return trip;
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "Trip",
      entityId: created.id,
      newValues: { tripNumber: created.tripNumber, customerId: data.customerId, itemCount: data.items.length },
    });

    if (overrideUsed) {
      await writeAuditLog({
        userId: user.id,
        action: "DISPATCH_OVERRIDE",
        entityType: "Trip",
        entityId: created.id,
        newValues: { reasons: eligibility.reasons, reason: data.eligibilityOverrideReason },
      });
    }

    revalidateTrip(created.id);
    if (data.salesOrderId) revalidateSalesOrders([data.salesOrderId]);
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return actionError(error);
  }
}

export type TripEligibilityPreview = {
  allowed: boolean;
  reasons: string[];
  vehicleDriverReasons: string[];
  stockReasons: string[];
};

/**
 * Read-only preview of `checkTripEligibility()` for the trip-creation form,
 * so exact block reasons ("Dispatch blocked: ...") can be shown to the user
 * before they submit. Runs the identical check `createTripAction` runs; it
 * just doesn't create anything.
 */
export async function previewTripEligibilityAction(input: {
  vehicleId?: string;
  driverId?: string;
  items: { itemId: string; grade: string; quantity: number }[];
}): Promise<ActionResult<TripEligibilityPreview>> {
  try {
    await requirePermission("TRIP_CREATE");
    if (!input.vehicleId || !input.driverId) {
      return { ok: true, data: { allowed: true, reasons: [], vehicleDriverReasons: [], stockReasons: [] } };
    }

    const [vehicle, driver] = await Promise.all([
      prisma.vehicle.findUnique({ where: { id: input.vehicleId } }),
      prisma.driver.findUnique({ where: { id: input.driverId } }),
    ]);
    if (!vehicle) return { ok: false, error: "Selected vehicle does not exist." };
    if (!driver) return { ok: false, error: "Selected driver does not exist." };

    const validLines = input.items.filter(
      (line) => line.itemId && line.quantity > 0 && (Object.values(Grade) as string[]).includes(line.grade),
    );
    const itemIds = [...new Set(validLines.map((line) => line.itemId))];
    const items = await prisma.item.findMany({ where: { id: { in: itemIds } } });
    const itemsById = new Map(items.map((i) => [i.id, i]));

    const eligibilityItems: TripEligibilityItem[] = [];
    for (const line of validLines) {
      const item = itemsById.get(line.itemId);
      if (!item) continue;
      eligibilityItems.push({ itemId: item.id, itemName: item.name, grade: line.grade as Grade, quantity: line.quantity });
    }

    const result = await checkTripEligibility({ vehicle, driver, items: eligibilityItems });
    const stockReasons = result.stockReasons;

    return {
      ok: true,
      data: {
        allowed: result.vehicleDriverReasons.length === 0 && stockReasons.length === 0,
        reasons: [...result.vehicleDriverReasons, ...stockReasons],
        vehicleDriverReasons: result.vehicleDriverReasons,
        stockReasons,
      },
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function listTripsAction(params: {
  page?: number;
  pageSize?: number;
  status?: string;
  statuses?: readonly string[];
  q?: string;
}) {
  await requirePermission("TRIP_VIEW");
  const pagination = paginationSchema.parse({ page: params.page, pageSize: params.pageSize });

  const statusIn = params.status ? [params.status] : params.statuses ? [...params.statuses] : undefined;

  const where: Prisma.TripWhereInput = {
    ...(statusIn ? { status: { in: statusIn as TripStatus[] } } : {}),
    ...(params.q
      ? {
          OR: [
            { tripNumber: { contains: params.q, mode: "insensitive" } },
            { customer: { name: { contains: params.q, mode: "insensitive" } } },
            { vehicle: { vehicleNumber: { contains: params.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, trips] = await Promise.all([
    prisma.trip.count({ where }),
    prisma.trip.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
      include: {
        customer: { select: { name: true } },
        vehicle: { select: { vehicleNumber: true } },
        driver: { select: { fullName: true } },
        route: { select: { name: true } },
        items: { select: { id: true } },
      },
    }),
  ]);

  return { trips, pagination: paginationMeta(total, pagination) };
}

/**
 * Puts a vehicle back to AVAILABLE once its trip is over — but only if it is
 * currently ON_TRIP and no other shipped-but-not-returned trip still uses it.
 */
async function releaseVehicleFromTrip(tx: Prisma.TransactionClient, vehicleId: string, tripId: string) {
  const otherActive = await tx.trip.count({
    where: { vehicleId, id: { not: tripId }, status: { in: ["DISPATCHED", "DELIVERED"] } },
  });
  if (otherActive > 0) return;
  await tx.vehicle.updateMany({ where: { id: vehicleId, status: "ON_TRIP" }, data: { status: "AVAILABLE" } });
}

async function requireTripInStatus(id: string, expected: TripStatus[]) {
  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) throw new Error("Trip not found.");
  if (!expected.includes(trip.status)) {
    throw new Error(`Trip is ${trip.status.toLowerCase()}; expected ${expected.join(" or ")}.`);
  }
  return trip;
}

export async function approveTripAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("TRIP_APPROVE");
    await requireTripInStatus(id, ["CREATED"]);

    await prisma.trip.update({ where: { id }, data: { status: "APPROVED" } });
    await writeAuditLog({
      userId: user.id,
      action: "APPROVE",
      entityType: "Trip",
      entityId: id,
      oldValues: { status: "CREATED" },
      newValues: { status: "APPROVED" },
    });

    revalidateTrip(id);
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function startTripLoadingAction(
  id: string,
  loadingStaffId?: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("TRIP_EDIT");
    await requireTripInStatus(id, ["APPROVED"]);

    await prisma.trip.update({
      where: { id },
      data: { status: "LOADING", loadingStaffId: loadingStaffId || undefined },
    });
    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Trip",
      entityId: id,
      oldValues: { status: "APPROVED" },
      newValues: { status: "LOADING" },
    });

    revalidateTrip(id);
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function markTripLoadedAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("TRIP_EDIT");
    await requireTripInStatus(id, ["LOADING"]);

    await prisma.trip.update({ where: { id }, data: { status: "LOADED" } });
    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Trip",
      entityId: id,
      oldValues: { status: "LOADING" },
      newValues: { status: "LOADED" },
    });

    revalidateTrip(id);
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}

/**
 * The one status transition that moves real inventory: decrements grade
 * stock (and the generic Item.currentStock via applyGradeStockMovement) for
 * every TripItem with transactionType DISPATCH / direction DECREASE.
 *
 * In the same transaction it also: assigns physical crates (sum of the trip's
 * TripItem.cratesCount) to the customer as WITH_CUSTOMER, marks the vehicle
 * ON_TRIP, and recomputes the status of every linked sales order.
 */
export async function dispatchTripAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("TRIP_EDIT");
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: { items: true, customer: { select: { name: true } }, vehicle: { select: { vehicleNumber: true, status: true } } },
    });
    if (!trip) return { ok: false, error: "Trip not found." };
    if (trip.status !== "LOADED") {
      return { ok: false, error: `Trip must be Loaded before it can be dispatched (current status: ${trip.status}).` };
    }
    if (trip.vehicle.status === "ON_TRIP") {
      return { ok: false, error: `Vehicle ${trip.vehicle.vehicleNumber} is already out on another trip.` };
    }

    const cratesNeeded = trip.items.reduce((sum, line) => sum + (line.cratesCount ?? 0), 0);

    const itemIds = [...new Set(trip.items.map((line) => line.itemId))];
    const items = await prisma.item.findMany({ where: { id: { in: itemIds } } });
    const itemsById = new Map(items.map((i) => [i.id, i]));

    const { crateCodes, crateIds, salesOrderIds } = await prisma.$transaction(async (tx) => {
      // Physical crates leave with the trip: oldest-idle free crates first.
      let crates: { id: string; crateCode: string }[] = [];
      if (cratesNeeded > 0) {
        crates = await tx.crate.findMany({
          where: { status: { in: ["AVAILABLE", "READY"] } },
          orderBy: { updatedAt: "asc" },
          take: cratesNeeded,
          select: { id: true, crateCode: true },
        });
        if (crates.length < cratesNeeded) {
          throw new Error(`Only ${crates.length} crates are available; this trip needs ${cratesNeeded}.`);
        }
        // Status guard in the WHERE so a crate grabbed concurrently by another dispatch isn't double-assigned.
        const assigned = await tx.crate.updateMany({
          where: { id: { in: crates.map((c) => c.id) }, status: { in: ["AVAILABLE", "READY"] } },
          data: { status: "WITH_CUSTOMER", customerId: trip.customerId, currentLocation: trip.customer.name },
        });
        if (assigned.count !== crates.length) {
          throw new Error("Some crates were assigned elsewhere while dispatching. Please try again.");
        }
      }

      for (const line of trip.items) {
        await takeGradeStockForTrip(tx, {
          itemId: line.itemId,
          homeWarehouseId: itemsById.get(line.itemId)?.warehouseId ?? null,
          grade: line.grade,
          quantity: Number(line.quantity),
          trip,
          userId: user.id,
        });
      }

      await tx.trip.update({
        where: { id },
        data: { status: "DISPATCHED", departureAt: trip.departureAt ?? new Date() },
      });
      await tx.vehicle.update({ where: { id: trip.vehicleId }, data: { status: "ON_TRIP" } });

      const soIds = await linkedSalesOrderIds(tx, trip);
      for (const soId of soIds) await recomputeSalesOrderStatus(tx, soId);

      return { crateCodes: crates.map((c) => c.crateCode), crateIds: crates.map((c) => c.id), salesOrderIds: soIds };
    });

    // Per-crate history lives in AuditLog (no crate-movement table) — see crate-return-actions.ts.
    for (const crateId of crateIds) {
      await writeAuditLog({
        userId: user.id,
        action: "EDIT",
        entityType: "Crate",
        entityId: crateId,
        newValues: { status: "WITH_CUSTOMER", customerId: trip.customerId, reason: `Dispatched on trip ${trip.tripNumber}` },
      });
    }

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Trip",
      entityId: id,
      oldValues: { status: "LOADED" },
      newValues: { status: "DISPATCHED", crates: crateCodes },
    });

    revalidateTrip(id);
    revalidateSalesOrders(salesOrderIds);
    revalidatePath("/items");
    revalidatePath("/crates");
    revalidatePath("/vehicles");
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function markTripDeliveredAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("TRIP_EDIT");
    await requireTripInStatus(id, ["DISPATCHED"]);

    await prisma.trip.update({ where: { id }, data: { status: "DELIVERED", deliveredAt: new Date() } });
    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Trip",
      entityId: id,
      oldValues: { status: "DISPATCHED" },
      newValues: { status: "DELIVERED" },
    });

    revalidateTrip(id);
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function markTripReturnedAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("TRIP_EDIT");
    const trip = await requireTripInStatus(id, ["DELIVERED"]);

    await prisma.$transaction(async (tx) => {
      await tx.trip.update({ where: { id }, data: { status: "RETURNED", returnedAt: new Date() } });
      await releaseVehicleFromTrip(tx, trip.vehicleId, id);
    });
    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Trip",
      entityId: id,
      oldValues: { status: "DELIVERED" },
      newValues: { status: "RETURNED" },
    });

    revalidateTrip(id);
    revalidatePath("/vehicles");
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function cancelTripAction(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("TRIP_EDIT");
    const data = tripCancelSchema.parse(input);
    const trip = await prisma.trip.findUnique({ where: { id }, include: { items: true } });
    if (!trip) return { ok: false, error: "Trip not found." };

    // Only pre-dispatch trips can be cancelled, so no stock or crates have moved yet.
    if (!(["CREATED", "APPROVED", "LOADING", "LOADED"] as TripStatus[]).includes(trip.status)) {
      return {
        ok: false,
        error: `A trip in ${trip.status.toLowerCase()} status cannot be cancelled (stock may already be committed).`,
      };
    }

    const combinedRemarks = trip.remarks ? `${trip.remarks}\n\nCancelled: ${data.reason}` : `Cancelled: ${data.reason}`;
    const salesOrderIds = await prisma.$transaction(async (tx) => {
      await tx.trip.update({ where: { id }, data: { status: "CANCELLED", remarks: combinedRemarks } });

      // Release the quantity this trip committed against its sales order lines at creation.
      for (const line of trip.items) {
        if (!line.salesOrderItemId) continue;
        await tx.salesOrderItem.updateMany({
          where: { id: line.salesOrderItemId },
          data: { fulfilledQty: { decrement: line.quantity } },
        });
      }
      const soIds = await linkedSalesOrderIds(tx, trip);
      for (const soId of soIds) await recomputeSalesOrderStatus(tx, soId);

      await releaseVehicleFromTrip(tx, trip.vehicleId, id);
      return soIds;
    });
    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Trip",
      entityId: id,
      oldValues: { status: trip.status },
      newValues: { status: "CANCELLED", reason: data.reason },
    });

    revalidateTrip(id);
    revalidateSalesOrders(salesOrderIds);
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}
