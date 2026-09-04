"use server";

import { z } from "zod";
import { Grade, GradeLedgerTxnType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { applyGradeStockMovement } from "@/lib/services/produce-inventory";

// No dedicated UNLOADING permission resource exists in src/lib/auth/permissions.ts.
// Unloading is the on-site continuation of a truck's gate entry (one Unloading
// row per gate entry), so these mutations are gated under GATE_ENTRY_EDIT
// rather than PROCUREMENT_EDIT — the Gate Operator role already holds it.

const completeUnloadingSchema = z.object({
  unloadingId: z.string().min(1, "Unloading record is required"),
  weight: z.coerce.number().positive("Weight must be greater than 0"),
  remarks: z.string().max(1000).optional().or(z.literal("")),
});

export async function startUnloadingAction(
  gateEntryId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("GATE_ENTRY_EDIT");

    const gateEntry = await prisma.vehicleGateEntry.findUniqueOrThrow({
      where: { id: gateEntryId },
    });
    if (gateEntry.status !== "INSIDE") {
      return { ok: false, error: "This vehicle is not currently inside." };
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
 * Completes unloading (sets unloadingEndAt + weight) and transitions every
 * ProcurementBatch sharing this Unloading's gateEntryId from PENDING_UNLOADING
 * to PENDING_SORTING, all inside one transaction.
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
    const user = await requirePermission("GATE_ENTRY_EDIT");
    const data = completeUnloadingSchema.parse(input);

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
          weight: data.weight,
          remarks: data.remarks || null,
          unloadingStaffId: unloading.unloadingStaffId ?? user.id,
        },
      });

      const batches = await tx.procurementBatch.findMany({
        where: { gateEntryId: unloading.gateEntryId, status: "PENDING_UNLOADING" },
      });

      for (const batch of batches) {
        await applyGradeStockMovement(tx, {
          itemId: batch.itemId,
          warehouseId: batch.warehouseId,
          grade: Grade.RAW,
          transactionType: GradeLedgerTxnType.PROCUREMENT,
          direction: "INCREASE",
          quantity: batch.rawWeight,
          referenceType: "UNLOADING",
          referenceId: unloading.id,
          referenceNumber: batch.batchNumber,
          batchId: batch.id,
          userId: user.id,
        });

        await tx.procurementBatch.update({
          where: { id: batch.id },
          data: { status: "PENDING_SORTING" },
        });
      }

      return batches.length;
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Unloading",
      entityId: unloading.id,
      newValues: { weight: data.weight, completed: true, batchesAdvanced: batchCount },
    });

    revalidatePath("/procurement/unloading");
    revalidatePath("/procurement/batches");
    return { ok: true, data: { id: unloading.id, batchCount } };
  } catch (error) {
    return actionError(error);
  }
}
