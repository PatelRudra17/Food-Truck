"use server";

import { z } from "zod";
import { Grade, GradeLedgerTxnType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { applyGradeStockMovement } from "@/lib/services/produce-inventory";
import { applyReceiptToPurchaseOrder } from "@/lib/services/purchase-order";
import { isKgUnit } from "@/lib/validators/procurement";

// No dedicated UNLOADING permission resource exists in src/lib/auth/permissions.ts.
// Unloading is the on-site continuation of a truck's gate entry (one Unloading
// row per gate entry), so these mutations accept either GATE_ENTRY_EDIT (Gate
// Operator) or PROCUREMENT_EDIT (store staff who receive the produce).
const UNLOADING_PERMISSIONS = ["GATE_ENTRY_EDIT", "PROCUREMENT_EDIT"] as const;

const completeUnloadingSchema = z.object({
  unloadingId: z.string().min(1, "Unloading record is required"),
  // Measured (scale) weight per batch; this replaces the weight declared on the procurement.
  batches: z
    .array(
      z.object({
        batchId: z.string().min(1),
        weight: z.coerce.number().positive("Weight must be greater than 0"),
      }),
    )
    .min(1, "There are no batches to unload."),
  remarks: z.string().max(1000).optional().or(z.literal("")),
});

export async function startUnloadingAction(
  gateEntryId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAnyPermission(...UNLOADING_PERMISSIONS);

    const gateEntry = await prisma.vehicleGateEntry.findUniqueOrThrow({
      where: { id: gateEntryId },
      include: { procurements: { where: { status: { not: "CANCELLED" } } } },
    });
    if (gateEntry.status !== "INSIDE") {
      return { ok: false, error: "This vehicle is not currently inside." };
    }
    // Batches only exist once a procurement is submitted; unloading a truck with a
    // draft would leave that draft's batches with no unloading to move them on.
    const drafts = gateEntry.procurements.filter((p) => p.status === "DRAFT");
    if (drafts.length > 0) {
      return {
        ok: false,
        error: `Submit or cancel ${drafts.map((p) => p.procurementNumber).join(", ")} before starting unloading.`,
      };
    }
    if (!gateEntry.procurements.some((p) => p.status === "SUBMITTED")) {
      return { ok: false, error: "This vehicle has no submitted procurement to unload." };
    }

    const existing = await prisma.unloading.findUnique({ where: { gateEntryId } });
    if (existing) {
      return { ok: false, error: "Unloading has already been started for this gate entry." };
    }

    const created = await prisma.unloading.create({
      data: {
        gateEntryId,
        vehicleId: gateEntry.vehicleId,
        driverId: gateEntry.driverId,
        supplierId: gateEntry.supplierId,
        arrivalAt: gateEntry.timeIn,
        unloadingStartAt: new Date(),
        unloadingStaffId: user.id,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "Unloading",
      entityId: created.id,
      newValues: { gateEntryId },
    });

    revalidatePath("/procurement/unloading");
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return actionError(error);
  }
}

/**
 * Completes unloading and transitions every ProcurementBatch sharing this
 * Unloading's gateEntryId from PENDING_UNLOADING to PENDING_SORTING, all inside
 * one transaction. Each batch's rawWeight is replaced by its measured weight
 * (the declared weight stays on the ProcurementItem), and Unloading.weight is
 * the total measured weight.
 *
 * Unloading is the point at which raw material physically enters the
 * warehouse, so this is also where each batch's raw weight is credited to
 * grade-aware stock (Grade.RAW) via applyGradeStockMovement — matching the
 * PROCUREMENT+INCREASE->INWARD mapping documented in produce-inventory.ts.
 * Without this, submitSortingAction's later RAW decrement would always throw
 * InsufficientGradeStockError since nothing would have ever credited it.
 */
export async function completeUnloadingAction(
  input: unknown,
): Promise<ActionResult<{ id: string; batchCount: number }>> {
  try {
    const user = await requireAnyPermission(...UNLOADING_PERMISSIONS);
    const data = completeUnloadingSchema.parse(input);
    const totalWeight = data.batches.reduce((sum, b) => sum + b.weight, 0);

    const unloading = await prisma.unloading.findUniqueOrThrow({
      where: { id: data.unloadingId },
    });
    if (!unloading.unloadingStartAt) {
      return { ok: false, error: "Unloading has not been started yet." };
    }
    if (unloading.unloadingEndAt) {
      return { ok: false, error: "This unloading has already been completed." };
    }

    const batchCount = await prisma.$transaction(async (tx) => {
      await tx.unloading.update({
        where: { id: unloading.id },
        data: {
          unloadingEndAt: new Date(),
          weight: totalWeight,
          remarks: data.remarks || null,
          unloadingStaffId: unloading.unloadingStaffId ?? user.id,
        },
      });

      const batches = await tx.procurementBatch.findMany({
        where: { gateEntryId: unloading.gateEntryId, status: "PENDING_UNLOADING" },
        include: { procurementItem: true, procurement: { select: { purchaseOrderId: true } } },
      });
      if (batches.length === 0) throw new Error("There are no batches waiting for this unloading.");

      const measured = new Map(data.batches.map((b) => [b.batchId, b.weight]));
      if (measured.size !== batches.length || batches.some((b) => !measured.has(b.id))) {
        throw new Error("Enter a weight for every batch on this truck.");
      }

      for (const batch of batches) {
        const weight = measured.get(batch.id)!;

        await applyGradeStockMovement(tx, {
          itemId: batch.itemId,
          warehouseId: batch.warehouseId,
          grade: Grade.RAW,
          transactionType: GradeLedgerTxnType.PROCUREMENT,
          direction: "INCREASE",
          quantity: weight,
          referenceType: "UNLOADING",
          referenceId: unloading.id,
          referenceNumber: batch.batchNumber,
          batchId: batch.id,
          userId: user.id,
        });

        await tx.procurementBatch.update({
          where: { id: batch.id },
          data: { status: "PENDING_SORTING", rawWeight: weight },
        });

        // Goods are physically received now, so count them against the linked purchase order —
        // capped at what is still open on it, since weighed produce often lands slightly over
        // the ordered quantity and that must not block unloading.
        const poId = batch.procurement.purchaseOrderId;
        if (poId) {
          const poItem = await tx.purchaseOrderItem.findFirst({
            where: { poId, itemId: batch.itemId, po: { status: { in: ["APPROVED", "PARTIALLY_RECEIVED"] } } },
          });
          if (poItem) {
            const receivedQty = new Prisma.Decimal(
              isKgUnit(batch.procurementItem.unit) ? weight : batch.procurementItem.quantity,
            );
            const remaining = new Prisma.Decimal(poItem.quantity).minus(poItem.receivedQuantity);
            const counted = Prisma.Decimal.min(receivedQty, remaining);
            if (counted.gt(0)) {
              await applyReceiptToPurchaseOrder(tx, {
                poId,
                receipts: [{ poItemId: poItem.id, quantity: counted }],
              });
            }
          }
        }
      }

      return batches.length;
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Unloading",
      entityId: unloading.id,
      newValues: { weight: totalWeight, batches: data.batches, completed: true, batchesAdvanced: batchCount },
    });

    revalidatePath("/procurement/unloading");
    revalidatePath("/procurement/batches");
    revalidatePath("/purchase-orders");
    return { ok: true, data: { id: unloading.id, batchCount } };
  } catch (error) {
    return actionError(error);
  }
}
