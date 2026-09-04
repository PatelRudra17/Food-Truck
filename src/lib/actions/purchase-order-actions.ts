"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { purchaseOrderSchema } from "@/lib/validators/purchase-order";
import { nextDocumentNumber } from "@/lib/numbering";
import { notifyRoleByName } from "@/lib/services/notifications";

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function computeLineTotal(quantity: number, rate: number, taxPercent?: number) {
  const base = quantity * rate;
  const tax = taxPercent ? base * (taxPercent / 100) : 0;
  return round2(base + tax);
}

export async function createPurchaseOrderAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("PURCHASE_ORDER_CREATE");
    const data = purchaseOrderSchema.parse(input);

    const lines = data.items.map((line) => ({
      itemId: line.itemId,
      quantity: line.quantity,
      rate: line.rate,
      taxPercent: line.taxPercent ?? null,
      total: computeLineTotal(line.quantity, line.rate, line.taxPercent),
    }));
    const totalAmount = round2(lines.reduce((sum, l) => sum + l.total, 0));

    const created = await prisma.$transaction(async (tx) => {
      const poNumber = await nextDocumentNumber(tx, "PURCHASE_ORDER");
      return tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierId: data.supplierId,
          date: new Date(data.date),
          expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : null,
          remarks: data.remarks || null,
          totalAmount,
          status: "DRAFT",
          createdById: user.id,
          items: {
            create: lines.map((line) => ({
              itemId: line.itemId,
              quantity: line.quantity,
              receivedQuantity: 0,
              rate: line.rate,
              taxPercent: line.taxPercent,
              total: line.total,
            })),
          },
        },
      });
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "PurchaseOrder",
      entityId: created.id,
      newValues: { poNumber: created.poNumber, totalAmount, lineCount: lines.length },
    });

    revalidatePath("/purchase-orders");
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function submitPurchaseOrderForApprovalAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("PURCHASE_ORDER_EDIT");
    const po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id } });

    if (po.status !== "DRAFT") {
      return { ok: false, error: "Only draft purchase orders can be submitted for approval." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.purchaseOrder.update({ where: { id }, data: { status: "PENDING_APPROVAL" } });
      await tx.approval.create({
        data: {
          entityType: "PurchaseOrder",
          entityId: id,
          requestedById: user.id,
          poFk: id,
        },
      });
    });

    await notifyRoleByName("Store Manager", {
      type: "PO_PENDING",
      title: "Purchase order pending approval",
      message: `${po.poNumber} is awaiting approval.`,
      entityType: "PurchaseOrder",
      entityId: id,
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "PurchaseOrder",
      entityId: id,
      oldValues: { status: "DRAFT" },
      newValues: { status: "PENDING_APPROVAL" },
    });

    revalidatePath("/purchase-orders");
    revalidatePath(`/purchase-orders/${id}`);
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function decidePurchaseOrderApprovalAction(
  id: string,
  decision: "APPROVED" | "REJECTED",
  comment?: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("PURCHASE_ORDER_APPROVE");

    const updated = await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUniqueOrThrow({
        where: { id },
        include: { approvals: { where: { decision: "PENDING" }, orderBy: { requestedAt: "desc" } } },
      });

      if (po.status !== "PENDING_APPROVAL") {
        throw new Error("This purchase order is not pending approval.");
      }

      const approval = po.approvals[0];
      if (!approval) {
        throw new Error("No pending approval record was found for this purchase order.");
      }

      await tx.approval.update({
        where: { id: approval.id },
        data: {
          decision,
          decidedById: user.id,
          decidedAt: new Date(),
          comment: comment || null,
        },
      });

      const nextStatus = decision === "APPROVED" ? "APPROVED" : "DRAFT";
      return tx.purchaseOrder.update({
        where: { id },
        data: {
          status: nextStatus,
          approvedById: decision === "APPROVED" ? user.id : null,
        },
      });
    });

    await writeAuditLog({
      userId: user.id,
      action: decision === "APPROVED" ? "APPROVE" : "REJECT",
      entityType: "PurchaseOrder",
      entityId: id,
      newValues: { decision, comment },
    });

    revalidatePath("/purchase-orders");
    revalidatePath(`/purchase-orders/${id}`);
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function cancelPurchaseOrderAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("PURCHASE_ORDER_EDIT");
    const po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id }, include: { items: true } });

    if (!["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(po.status)) {
      return { ok: false, error: `A purchase order in ${po.status} status cannot be cancelled.` };
    }

    const anyReceived = po.items.some((item) => Number(item.receivedQuantity) > 0);
    if (anyReceived) {
      return {
        ok: false,
        error: "This purchase order already has received quantity against it and cannot be cancelled.",
      };
    }

    const updated = await prisma.purchaseOrder.update({ where: { id }, data: { status: "CANCELLED" } });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "PurchaseOrder",
      entityId: id,
      oldValues: { status: po.status },
      newValues: { status: "CANCELLED" },
    });

    revalidatePath("/purchase-orders");
    revalidatePath(`/purchase-orders/${id}`);
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}
