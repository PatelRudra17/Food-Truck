"use server";

import { Prisma, Grade, type TripStatus } from "@prisma/client";
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

    // Trip/TripItem carry no warehouseId field (schema gap — see report). The
    // warehouse to check/move stock against is inferred from each Item's own
    // (optional) default warehouse assignment.
    const eligibilityItems: TripEligibilityItem[] = [];
    for (const line of data.items) {
      const item = itemsById.get(line.itemId);
      if (!item) return { ok: false, error: "One of the selected items no longer exists." };
      if (!item.warehouseId) {
        return {
          ok: false,
          error: `Item "${item.name}" has no assigned warehouse, so its stock cannot be checked for dispatch.`,
        };
      }
      eligibilityItems.push({
        itemId: item.id,
        itemName: item.name,
        warehouseId: item.warehouseId,
        grade: line.grade,
        quantity: line.quantity,
      });
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

    const created = await prisma.$transaction(async (tx) => {
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

      // Best-effort fulfilledQty bump on the linked SalesOrderItem(s). The Sales
      // Order module (built in parallel) owns its own status-transition logic —
      // we only nudge this counter and never fail Trip creation over it.
      for (const line of data.items) {
        if (!line.salesOrderItemId) continue;
        try {
          await tx.salesOrderItem.update({
            where: { id: line.salesOrderItemId },
            data: { fulfilledQty: { increment: line.quantity } },
          });
        } catch {
          // Referenced SalesOrderItem may not exist (module not yet populated) — ignore.
        }
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
      if (!item.warehouseId) {
        eligibilityItems.push({ itemId: item.id, itemName: item.name, warehouseId: "", grade: line.grade as Grade, quantity: line.quantity });
        continue;
      }
      eligibilityItems.push({
        itemId: item.id,
        itemName: item.name,
        warehouseId: item.warehouseId,
        grade: line.grade as Grade,
        quantity: line.quantity,
      });
    }

    // Items with no assigned warehouse can't be stock-checked — surface that plainly
    // rather than querying getItemGradeStock with an empty warehouseId.
    const unassigned = eligibilityItems.filter((i) => !i.warehouseId);
    const checkable = eligibilityItems.filter((i) => i.warehouseId);

    const result = await checkTripEligibility({ vehicle, driver, items: checkable });
    const stockReasons = [
      ...result.stockReasons,
      ...unassigned.map((i) => `Item "${i.itemName}" has no assigned warehouse, so its stock cannot be checked.`),
    ];

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
 */
export async function dispatchTripAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("TRIP_EDIT");
    const trip = await prisma.trip.findUnique({ where: { id }, include: { items: true } });
    if (!trip) return { ok: false, error: "Trip not found." };
    if (trip.status !== "LOADED") {
      return { ok: false, error: `Trip must be Loaded before it can be dispatched (current status: ${trip.status}).` };
    }

    const itemIds = [...new Set(trip.items.map((line) => line.itemId))];
    const items = await prisma.item.findMany({ where: { id: { in: itemIds } } });
    const itemsById = new Map(items.map((i) => [i.id, i]));

    await prisma.$transaction(async (tx) => {
      for (const line of trip.items) {
        const item = itemsById.get(line.itemId);
        if (!item?.warehouseId) {
          throw new Error(`Item "${item?.name ?? line.itemId}" has no assigned warehouse; cannot dispatch.`);
        }
        await applyGradeStockMovement(tx, {
          itemId: line.itemId,
          warehouseId: item.warehouseId,
          grade: line.grade,
          transactionType: "DISPATCH",
          direction: "DECREASE",
          quantity: line.quantity,
          referenceType: "Trip",
          referenceId: trip.id,
          referenceNumber: trip.tripNumber,
          userId: user.id,
        });
      }

      await tx.trip.update({
        where: { id },
        data: { status: "DISPATCHED", departureAt: trip.departureAt ?? new Date() },
      });
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Trip",
      entityId: id,
      oldValues: { status: "LOADED" },
      newValues: { status: "DISPATCHED" },
    });

    revalidateTrip(id);
    revalidatePath("/items");
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
    await requireTripInStatus(id, ["DELIVERED"]);

    await prisma.trip.update({ where: { id }, data: { status: "RETURNED", returnedAt: new Date() } });
    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Trip",
      entityId: id,
      oldValues: { status: "DELIVERED" },
      newValues: { status: "RETURNED" },
    });

    revalidateTrip(id);
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function cancelTripAction(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("TRIP_EDIT");
    const data = tripCancelSchema.parse(input);
    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) return { ok: false, error: "Trip not found." };

    if (!(["CREATED", "APPROVED", "LOADING", "LOADED"] as TripStatus[]).includes(trip.status)) {
      return {
        ok: false,
        error: `A trip in ${trip.status.toLowerCase()} status cannot be cancelled (stock may already be committed).`,
      };
    }

    const combinedRemarks = trip.remarks ? `${trip.remarks}\n\nCancelled: ${data.reason}` : `Cancelled: ${data.reason}`;
    await prisma.trip.update({ where: { id }, data: { status: "CANCELLED", remarks: combinedRemarks } });
    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Trip",
      entityId: id,
      oldValues: { status: trip.status },
      newValues: { status: "CANCELLED", reason: data.reason },
    });

    revalidateTrip(id);
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}
