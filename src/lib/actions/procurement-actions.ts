"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { procurementSchema } from "@/lib/validators/procurement";
import { nextDocumentNumber } from "@/lib/numbering";

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export async function createProcurementAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("PROCUREMENT_CREATE");
    const data = procurementSchema.parse(input);

    const lines = data.items.map((line) => ({
      itemId: line.itemId,
      quantity: line.quantity,
      unit: line.unit,
      weight: line.weight,
      quality: line.quality || null,
      purchasePrice: line.purchasePrice ?? null,
      total: line.purchasePrice != null ? round2(line.quantity * line.purchasePrice) : null,
    }));

    const created = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({ where: { id: data.supplierId } });
      if (!supplier) throw new Error("Selected supplier was not found.");

      const warehouse = await tx.warehouse.findUnique({ where: { id: data.warehouseId } });
      if (!warehouse) throw new Error("Selected warehouse was not found.");

      if (data.gateEntryId) {
        const gateEntry = await tx.vehicleGateEntry.findUnique({ where: { id: data.gateEntryId } });
        if (!gateEntry) throw new Error("Selected gate entry was not found.");
      }

      const procurementNumber = await nextDocumentNumber(tx, "PROCUREMENT");

      return tx.procurement.create({
        data: {
          procurementNumber,
          date: new Date(data.date),
          supplierId: data.supplierId,
          vehicleId: data.vehicleId || null,
          driverId: data.driverId || null,
          gateEntryId: data.gateEntryId || null,
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
      include: { items: true },
    });

    if (procurement.status !== "DRAFT") {
      return { ok: false, error: "Only draft procurements can be submitted." };
    }
    if (procurement.items.length === 0) {
      return { ok: false, error: "Add at least one line item before submitting." };
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
