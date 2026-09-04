"use server";

import { GradeLedgerTxnType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { warehouseWastageSchema, wastageDecisionSchema } from "@/lib/validators/wastage";
import { applyGradeStockMovement, getItemGradeStock } from "@/lib/services/produce-inventory";
import { isNegativeStockAllowed } from "@/lib/services/inventory";
import { nextDocumentNumber } from "@/lib/numbering";
import { notifyRoleByName } from "@/lib/services/notifications";

// A single warehouse disposal that wipes out more than this share of the
// grade's pre-disposal balance is flagged as high wastage (chosen threshold —
// the build doc does not specify one; mirrors the ratio-based check used for
// sorting-floor wastage in sorting-actions.ts).
const HIGH_WASTAGE_RATIO = 0.25;

/**
 * Returns the current grade-wise stock balance for an item at a warehouse, so
 * the "Record Disposal" form can show available stock as the user picks a
 * grade (and the server-side check in `createWarehouseWastageAction` above
 * repeats this against the same source of truth at submit time).
 */
export async function getItemGradeBalancesAction(
  itemId: string,
  warehouseId: string,
): Promise<ActionResult<{ grade: string; quantity: number }[]>> {
  try {
    await requirePermission("WASTAGE_VIEW");
    if (!itemId || !warehouseId) return { ok: true, data: [] };
    const balances = await getItemGradeStock(itemId, warehouseId);
    return { ok: true, data: balances };
  } catch (error) {
    return actionError(error);
  }
}

/**
 * Records a standalone warehouse disposal (dumping stock already in
 * inventory — `Wastage.stage = WAREHOUSE`), as opposed to sorting-floor
 * waste which `submitSortingAction` creates automatically. Validates the
 * requested quantity against the real grade balance (via
 * `getItemGradeStock`) before attempting the movement, then decrements the
 * chosen grade through `applyGradeStockMovement` with
 * `transactionType: DISPOSAL`.
 */
export async function createWarehouseWastageAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("WASTAGE_CREATE");
    const data = warehouseWastageSchema.parse(input);

    const item = await prisma.item.findUnique({ where: { id: data.itemId }, select: { id: true, name: true } });
    if (!item) throw new Error("Item not found.");

    const warehouse = await prisma.warehouse.findUnique({ where: { id: data.warehouseId }, select: { id: true } });
    if (!warehouse) throw new Error("Warehouse not found.");

    const date = new Date(data.date);
    if (Number.isNaN(date.getTime())) throw new Error("Invalid date.");

    const balances = await getItemGradeStock(data.itemId, data.warehouseId);
    const available = balances.find((b) => b.grade === data.grade)?.quantity ?? 0;
    if (data.quantity > available) {
      const allowNegative = await isNegativeStockAllowed();
      if (!allowNegative) {
        throw new Error(
          `Insufficient ${data.grade} stock for ${item.name}: available ${available.toLocaleString()}, requested ${data.quantity.toLocaleString()}.`,
        );
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const wastageNumber = await nextDocumentNumber(tx, "WASTAGE");
      const wastage = await tx.wastage.create({
        data: {
          wastageNumber,
          stage: "WAREHOUSE",
          itemId: data.itemId,
          warehouseId: data.warehouseId,
          quantity: data.quantity,
          reason: data.reason,
          disposalMethod: data.disposalMethod || null,
          date,
          recordedById: user.id,
          remarks: data.remarks || null,
        },
      });

      await applyGradeStockMovement(tx, {
        itemId: data.itemId,
        warehouseId: data.warehouseId,
        grade: data.grade,
        transactionType: GradeLedgerTxnType.DISPOSAL,
        direction: "DECREASE",
        quantity: data.quantity,
        referenceType: "WASTAGE",
        referenceId: wastage.id,
        referenceNumber: wastageNumber,
        userId: user.id,
        reason: data.reason,
      });

      // Disposal takes effect immediately (inventory must reflect real-world
      // stock right away), but a Store Manager still reviews the record after
      // the fact — this Approval row is what the Approval Center's Wastage
      // row acts on. A rejection does not reverse the stock movement; a
      // disputed disposal is corrected through Stock Adjustment like any
      // other stock discrepancy.
      await tx.approval.create({
        data: {
          entityType: "Wastage",
          entityId: wastage.id,
          requestedById: user.id,
          wastageFk: wastage.id,
        },
      });

      return wastage;
    });

    if (available > 0 && data.quantity / available > HIGH_WASTAGE_RATIO) {
      await notifyRoleByName("Store Manager", {
        type: "HIGH_WASTAGE",
        title: "High wastage in warehouse disposal",
        message: `${data.quantity.toLocaleString()} of ${item.name} (${data.grade}) disposed — ${Math.round((data.quantity / available) * 100)}% of the available balance.`,
        entityType: "Wastage",
        entityId: created.id,
      });
    } else {
      await notifyRoleByName("Store Manager", {
        type: "PENDING_APPROVAL",
        title: "Wastage disposal pending review",
        message: `${created.wastageNumber} — ${data.quantity.toLocaleString()} of ${item.name} (${data.grade}) is awaiting review.`,
        entityType: "Wastage",
        entityId: created.id,
      });
    }

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "Wastage",
      entityId: created.id,
      newValues: data,
    });

    revalidatePath("/wastage");
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function approveWastageAction(id: string, comment?: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("WASTAGE_APPROVE");

    const wastage = await prisma.wastage.findUnique({
      where: { id },
      include: { approvals: { where: { decision: "PENDING" }, orderBy: { requestedAt: "desc" }, take: 1 } },
    });
    if (!wastage) return { ok: false, error: "Wastage record not found." };
    const approval = wastage.approvals[0];
    if (!approval) return { ok: false, error: "This wastage record has no pending approval." };

    await prisma.approval.update({
      where: { id: approval.id },
      data: { decision: "APPROVED", decidedById: user.id, decidedAt: new Date(), comment: comment || undefined },
    });

    await writeAuditLog({
      userId: user.id,
      action: "APPROVE",
      entityType: "Wastage",
      entityId: id,
    });
    revalidatePath("/wastage");
    revalidatePath("/settings/approvals");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function rejectWastageAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await requirePermission("WASTAGE_APPROVE");
    const { id, comment } = wastageDecisionSchema.parse(input);
    if (!comment) return { ok: false, error: "A reason is required to reject a wastage record." };

    const wastage = await prisma.wastage.findUnique({
      where: { id },
      include: { approvals: { where: { decision: "PENDING" }, orderBy: { requestedAt: "desc" }, take: 1 } },
    });
    if (!wastage) return { ok: false, error: "Wastage record not found." };
    const approval = wastage.approvals[0];
    if (!approval) return { ok: false, error: "This wastage record has no pending approval." };

    await prisma.approval.update({
      where: { id: approval.id },
      data: { decision: "REJECTED", decidedById: user.id, decidedAt: new Date(), comment },
    });

    await writeAuditLog({
      userId: user.id,
      action: "REJECT",
      entityType: "Wastage",
      entityId: id,
      newValues: { comment },
    });
    revalidatePath("/wastage");
    revalidatePath("/settings/approvals");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}
