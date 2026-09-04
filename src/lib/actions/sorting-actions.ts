"use server";

import { Grade, GradeLedgerTxnType, BatchStatus, type WastageReason } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { buildSortingSchema } from "@/lib/validators/sorting";
import { applyGradeStockMovement } from "@/lib/services/produce-inventory";
import { nextDocumentNumber } from "@/lib/numbering";
import { notifyRoleByName } from "@/lib/services/notifications";

// A batch that wastes more than this share of its raw weight during sorting is
// flagged to the Store Manager as unusually high wastage. Configurable via
// Settings > High Wastage Threshold (%); falls back to 15% if unset.
async function getHighWastageRatio(): Promise<number> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: "HIGH_WASTAGE_THRESHOLD_PERCENT" },
  });
  const percent = typeof setting?.value === "number" ? setting.value : 15;
  return percent / 100;
}

/**
 * Submits the sorting/grading result for a batch that is PENDING_SORTING.
 * The weight balance rule (gradeA + gradeB + gradeC + other + waste ===
 * rawWeight, exactly) is validated twice: client-side via the same
 * `buildSortingSchema` factory, and here again against the batch's real
 * `rawWeight` read fresh from the database — never trust a client-supplied
 * raw weight for this check.
 *
 * On success, in one transaction: creates the Sorting record, decrements
 * grade=RAW by the full rawWeight and increments each non-zero produced
 * grade (GRADE_A/B/C/OTHER) via `applyGradeStockMovement` (see that file's
 * header comment for why the net effect on Item.currentStock is exactly
 * -wasteWeight), creates a Wastage record (stage SORTING) when wasteWeight >
 * 0, and transitions the batch to SORTED.
 */
export async function submitSortingAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("SORTING_CREATE");

    const batchId = (input as { batchId?: unknown } | null)?.batchId;
    if (typeof batchId !== "string" || !batchId) {
      throw new Error("Batch is required.");
    }

    const batch = await prisma.procurementBatch.findUnique({
      where: { id: batchId },
      include: { sorting: true },
    });
    if (!batch) throw new Error("Batch not found.");
    if (batch.sorting) throw new Error("This batch has already been sorted.");
    if (batch.status !== BatchStatus.PENDING_SORTING) {
      throw new Error("This batch is not pending sorting.");
    }

    const rawWeight = Number(batch.rawWeight);
    const data = buildSortingSchema(rawWeight).parse(input);

    const { sorting: created, wastageRecord } = await prisma.$transaction(async (tx) => {
      const sorting = await tx.sorting.create({
        data: {
          batchId: batch.id,
          rawWeight: batch.rawWeight,
          gradeAWeight: data.gradeAWeight,
          gradeBWeight: data.gradeBWeight,
          gradeCWeight: data.gradeCWeight,
          otherGradeWeight: data.otherGradeWeight,
          wasteWeight: data.wasteWeight,
          wasteReason: data.wasteWeight > 0 ? (data.wasteReason as WastageReason) : null,
          sortedById: user.id,
          remarks: data.remarks || null,
        },
      });

      // The whole raw weight is consumed by grading; the produced grades (below)
      // and the wastage record together account for exactly this amount.
      await applyGradeStockMovement(tx, {
        itemId: batch.itemId,
        warehouseId: batch.warehouseId,
        grade: Grade.RAW,
        transactionType: GradeLedgerTxnType.SORTING,
        direction: "DECREASE",
        quantity: batch.rawWeight,
        referenceType: "SORTING",
        referenceId: sorting.id,
        referenceNumber: batch.batchNumber,
        batchId: batch.id,
        userId: user.id,
      });

      const producedGrades: { grade: Grade; weight: number }[] = [
        { grade: Grade.GRADE_A, weight: data.gradeAWeight },
        { grade: Grade.GRADE_B, weight: data.gradeBWeight },
        { grade: Grade.GRADE_C, weight: data.gradeCWeight },
        { grade: Grade.OTHER, weight: data.otherGradeWeight },
      ];
      for (const { grade, weight } of producedGrades) {
        if (weight > 0) {
          await applyGradeStockMovement(tx, {
            itemId: batch.itemId,
            warehouseId: batch.warehouseId,
            grade,
            transactionType: GradeLedgerTxnType.SORTING,
            direction: "INCREASE",
            quantity: weight,
            referenceType: "SORTING",
            referenceId: sorting.id,
            referenceNumber: batch.batchNumber,
            batchId: batch.id,
            userId: user.id,
          });
        }
      }

      let wastage: { id: string } | null = null;
      if (data.wasteWeight > 0) {
        const wastageNumber = await nextDocumentNumber(tx, "WASTAGE");
        wastage = await tx.wastage.create({
          data: {
            wastageNumber,
            stage: "SORTING",
            batchId: batch.id,
            itemId: batch.itemId,
            warehouseId: batch.warehouseId,
            quantity: data.wasteWeight,
            reason: data.wasteReason as WastageReason,
            date: new Date(),
            recordedById: user.id,
            remarks: data.remarks || null,
          },
        });
      }

      await tx.procurementBatch.update({
        where: { id: batch.id },
        data: { status: BatchStatus.SORTED },
      });

      return { sorting, wastageRecord: wastage };
    });

    const highWastageRatio = await getHighWastageRatio();
    if (wastageRecord && rawWeight > 0 && data.wasteWeight / rawWeight > highWastageRatio) {
      await notifyRoleByName("Store Manager", {
        type: "HIGH_WASTAGE",
        title: "High wastage in sorting",
        message: `Batch ${batch.batchNumber} lost ${data.wasteWeight.toLocaleString()} of ${rawWeight.toLocaleString()} raw weight (${Math.round((data.wasteWeight / rawWeight) * 100)}%) during sorting.`,
        entityType: "Wastage",
        entityId: wastageRecord.id,
      });
    }

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "Sorting",
      entityId: created.id,
      newValues: { ...data, batchNumber: batch.batchNumber },
    });

    revalidatePath("/procurement/sorting");
    revalidatePath("/wastage");
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return actionError(error);
  }
}
