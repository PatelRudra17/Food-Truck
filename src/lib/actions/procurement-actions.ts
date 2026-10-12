"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { procurementSchema, type ProcurementInput } from "@/lib/validators/procurement";
import { nextDocumentNumber } from "@/lib/numbering";

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function buildLines(data: ProcurementInput) {
  return data.items.map((line) => ({
    itemId: line.itemId,
    quantity: line.quantity,
    unit: line.unit,
    weight: line.weight,
    quality: line.quality || null,
    purchasePrice: line.purchasePrice ?? null,
    total: line.purchasePrice != null ? round2(line.quantity * line.purchasePrice) : null,
  }));
}

/**
 * Validates every reference on a procurement and returns the vehicle/driver to
 * store. The vehicle and driver always come from the gate entry, so they can
 * never disagree with the truck that actually arrived.
 */
async function resolveProcurementRefs(tx: Prisma.TransactionClient, data: ProcurementInput) {
  const supplier = await tx.supplier.findUnique({ where: { id: data.supplierId } });
  if (!supplier) throw new Error("Selected supplier was not found.");

  const warehouse = await tx.warehouse.findUnique({ where: { id: data.warehouseId } });
  if (!warehouse) throw new Error("Selected warehouse was not found.");

  const gateEntry = await tx.vehicleGateEntry.findUnique({
    where: { id: data.gateEntryId },
    include: { unloading: { select: { id: true } } },
  });
  if (!gateEntry) throw new Error("Selected gate entry was not found.");
  if (gateEntry.status !== "INSIDE") {
    throw new Error(`Gate entry ${gateEntry.gateEntryNumber} is no longer inside.`);
  }
  if (gateEntry.unloading) {
    throw new Error(`Unloading has already started for gate entry ${gateEntry.gateEntryNumber}.`);
  }
  if (gateEntry.supplierId && gateEntry.supplierId !== data.supplierId) {
    throw new Error(`Gate entry ${gateEntry.gateEntryNumber} was recorded for a different supplier.`);
  }

  if (data.purchaseOrderId) {
    const po = await tx.purchaseOrder.findUnique({ where: { id: data.purchaseOrderId } });
    if (!po) throw new Error("Selected purchase order was not found.");
    if (po.supplierId !== data.supplierId) {
      throw new Error(`Purchase order ${po.poNumber} belongs to a different supplier.`);
    }
    if (po.status !== "APPROVED" && po.status !== "PARTIALLY_RECEIVED") {
      throw new Error(`Purchase order ${po.poNumber} is not open for receiving.`);
    }
  }

  return { vehicleId: gateEntry.vehicleId, driverId: gateEntry.driverId };
}

export async function createProcurementAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("PROCUREMENT_CREATE");
    const data = procurementSchema.parse(input);
    const lines = buildLines(data);

    const created = await prisma.$transaction(async (tx) => {
      const { vehicleId, driverId } = await resolveProcurementRefs(tx, data);
      const procurementNumber = await nextDocumentNumber(tx, "PROCUREMENT");

      return tx.procurement.create({
        data: {
          procurementNumber,
          date: new Date(data.date),
          supplierId: data.supplierId,
          vehicleId,
          driverId,
          gateEntryId: data.gateEntryId,
          warehouseId: data.warehouseId,
          purchaseOrderId: data.purchaseOrderId || null,
          invoiceNumber: data.invoiceNumber || null,
          remarks: data.remarks || null,
          status: "DRAFT",
          createdById: user.id,
          items: { create: lines },
        },
      });
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "Procurement",
      entityId: created.id,
      newValues: { procurementNumber: created.procurementNumber, lineCount: lines.length },
    });

    revalidatePath("/procurement");
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return actionError(error);
  }
}

/** Replaces a DRAFT procurement's details and line items. Submitted/cancelled ones are read-only. */
export async function updateProcurementAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("PROCUREMENT_EDIT");
    const data = procurementSchema.parse(input);
    const lines = buildLines(data);

    await prisma.$transaction(async (tx) => {
      const existing = await tx.procurement.findUniqueOrThrow({ where: { id } });
      if (existing.status !== "DRAFT") throw new Error("Only draft procurements can be edited.");

      const { vehicleId, driverId } = await resolveProcurementRefs(tx, data);

      await tx.procurementItem.deleteMany({ where: { procurementId: id } });
      await tx.procurement.update({
        where: { id },
        data: {
          date: new Date(data.date),
          supplierId: data.supplierId,
          vehicleId,
          driverId,
          gateEntryId: data.gateEntryId,
          warehouseId: data.warehouseId,
          purchaseOrderId: data.purchaseOrderId || null,
          invoiceNumber: data.invoiceNumber || null,
          remarks: data.remarks || null,
          items: { create: lines },
        },
      });
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Procurement",
      entityId: id,
      newValues: { lineCount: lines.length },
    });

    revalidatePath("/procurement");
    revalidatePath(`/procurement/${id}`);
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}

/**
 * Transitions a DRAFT procurement to SUBMITTED and creates one ProcurementBatch
 * per line item, copying the traceability chain (supplier/vehicle/driver/gate
 * entry/warehouse) from the parent procurement onto each batch. Runs inside a
 * single transaction so a partial batch-creation failure rolls back the whole
 * submission.
 */
export async function submitProcurementAction(
  id: string,
): Promise<ActionResult<{ id: string; batchCount: number }>> {
  try {
    const user = await requirePermission("PROCUREMENT_EDIT");
    const procurement = await prisma.procurement.findUniqueOrThrow({
      where: { id },
      include: { items: true, gateEntry: { include: { unloading: { select: { id: true } } } } },
    });

    if (procurement.status !== "DRAFT") {
      return { ok: false, error: "Only draft procurements can be submitted." };
    }
    if (procurement.items.length === 0) {
      return { ok: false, error: "Add at least one line item before submitting." };
    }
    // Batches only move forward when their truck is unloaded, so the truck must
    // still be inside and not yet unloaded — otherwise the batches would be stuck.
    if (!procurement.gateEntry) {
      return { ok: false, error: "Link a gate entry (edit this draft) before submitting." };
    }
    if (procurement.gateEntry.status !== "INSIDE") {
      return { ok: false, error: `Gate entry ${procurement.gateEntry.gateEntryNumber} is no longer inside.` };
    }
    if (procurement.gateEntry.unloading) {
      return {
        ok: false,
        error: `Unloading has already started for gate entry ${procurement.gateEntry.gateEntryNumber}.`,
      };
    }

    await prisma.$transaction(async (tx) => {
      for (const item of procurement.items) {
        const batchNumber = await nextDocumentNumber(tx, "PROCUREMENT_BATCH");
        await tx.procurementBatch.create({
          data: {
            batchNumber,
            procurementId: procurement.id,
            procurementItemId: item.id,
            supplierId: procurement.supplierId,
            itemId: item.itemId,
            vehicleId: procurement.vehicleId,
            driverId: procurement.driverId,
            gateEntryId: procurement.gateEntryId,
            warehouseId: procurement.warehouseId,
            rawWeight: item.weight,
            date: procurement.date,
            status: "PENDING_UNLOADING",
          },
        });
      }

      await tx.procurement.update({ where: { id }, data: { status: "SUBMITTED" } });
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Procurement",
      entityId: id,
      oldValues: { status: "DRAFT" },
      newValues: { status: "SUBMITTED", batchCount: procurement.items.length },
    });

    revalidatePath("/procurement");
    revalidatePath(`/procurement/${id}`);
    revalidatePath("/procurement/batches");
    return { ok: true, data: { id, batchCount: procurement.items.length } };
  } catch (error) {
    return actionError(error);
  }
}

/**
 * Only DRAFT procurements can be cancelled. Once submitted, ProcurementBatch
 * rows exist and immediately become live traceable inventory-in-transit
 * records — BatchStatus has no CANCELLED state (by design, per the schema),
 * so unwinding a submitted procurement is intentionally not supported here.
 */
export async function cancelProcurementAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("PROCUREMENT_EDIT");
    const procurement = await prisma.procurement.findUniqueOrThrow({ where: { id } });

    if (procurement.status !== "DRAFT") {
      return {
        ok: false,
        error: `A procurement in ${procurement.status} status cannot be cancelled.`,
      };
    }

    const updated = await prisma.procurement.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Procurement",
      entityId: id,
      oldValues: { status: "DRAFT" },
      newValues: { status: "CANCELLED" },
    });

    revalidatePath("/procurement");
    revalidatePath(`/procurement/${id}`);
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}
