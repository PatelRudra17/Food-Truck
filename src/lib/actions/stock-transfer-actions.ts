"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { notifyRoleByName } from "@/lib/services/notifications";
import { applyStockMovement } from "@/lib/services/inventory";
import { nextDocumentNumber } from "@/lib/numbering";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { createTransferSchema, transferDecisionSchema } from "@/lib/validators/stock-transfer";

export async function createTransferAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("STOCK_TRANSFER_CREATE");
    const data = createTransferSchema.parse(input);

    const availableItems = await prisma.item.findMany({
      where: { id: { in: data.items.map((i) => i.itemId) }, warehouseId: data.sourceWarehouseId },
      select: { id: true },
    });
    if (availableItems.length !== new Set(data.items.map((i) => i.itemId)).size) {
      return { ok: false, error: "One or more selected items are not available in the source warehouse." };
    }

    const transfer = await prisma.$transaction(async (tx) => {
      const transferNumber = await nextDocumentNumber(tx, "STOCK_TRANSFER");
      return tx.stockTransfer.create({
        data: {
          transferNumber,
          sourceWarehouseId: data.sourceWarehouseId,
          destWarehouseId: data.destWarehouseId,
          requestedById: user.id,
          remarks: data.remarks || undefined,
          status: "DRAFT",
          items: {
            create: data.items.map((i) => ({
              itemId: i.itemId,
              quantity: i.quantity,
              unit: i.unit,
              batchNumber: i.batchNumber || undefined,
            })),
          },
        },
      });
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "StockTransfer",
      entityId: transfer.id,
      newValues: data,
    });
    revalidatePath("/stock/transfer");
    return { ok: true, data: { id: transfer.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function submitTransferForApprovalAction(id: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("STOCK_TRANSFER_CREATE");
    const transfer = await prisma.stockTransfer.findUnique({ where: { id } });
    if (!transfer) return { ok: false, error: "Transfer not found." };

    await prisma.$transaction(async (tx) => {
      const updated = await tx.stockTransfer.updateMany({
        where: { id, status: "DRAFT" },
        data: { status: "REQUESTED" },
      });
      if (updated.count === 0) {
        throw new Error("Only draft transfers can be submitted for approval.");
      }
      await tx.approval.create({
        data: {
          entityType: "StockTransfer",
          entityId: id,
          requestedById: user.id,
          transferFk: id,
        },
      });
    });

    await notifyRoleByName("Store Manager", {
      type: "TRANSFER_PENDING",
      title: "Stock transfer pending approval",
      message: `Transfer ${transfer.transferNumber} is awaiting approval.`,
      entityType: "StockTransfer",
      entityId: id,
    });
    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "StockTransfer",
      entityId: id,
      newValues: { status: "REQUESTED" },
    });
    revalidatePath(`/stock/transfer/${id}`);
    revalidatePath("/stock/transfer");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function decideTransferAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await requirePermission("STOCK_TRANSFER_APPROVE");
    const { id, decision, comment } = transferDecisionSchema.parse(input);

    const transfer = await prisma.stockTransfer.findUnique({
      where: { id },
      include: { approvals: { where: { decision: "PENDING" }, orderBy: { requestedAt: "desc" }, take: 1 } },
    });
    if (!transfer) return { ok: false, error: "Transfer not found." };

    await prisma.$transaction(async (tx) => {
      const updated = await tx.stockTransfer.updateMany({
        where: { id, status: "REQUESTED" },
        data: {
          status: decision,
          approvedById: decision === "APPROVED" ? user.id : undefined,
        },
      });
      if (updated.count === 0) {
        throw new Error("Only transfers pending approval can be approved or rejected.");
      }
      const approval = transfer.approvals[0];
      if (approval) {
        await tx.approval.update({
          where: { id: approval.id },
          data: { decision, decidedById: user.id, decidedAt: new Date(), comment: comment || undefined },
        });
      }
    });

    await writeAuditLog({
      userId: user.id,
      action: decision === "APPROVED" ? "APPROVE" : "REJECT",
      entityType: "StockTransfer",
      entityId: id,
      newValues: { status: decision, comment },
    });
    revalidatePath(`/stock/transfer/${id}`);
    revalidatePath("/stock/transfer");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function dispatchTransferAction(id: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("STOCK_TRANSFER_EDIT");

    await prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({ where: { id }, include: { items: true } });
      if (!transfer) throw new Error("Transfer not found.");

      const updated = await tx.stockTransfer.updateMany({
        where: { id, status: "APPROVED" },
        data: { status: "DISPATCHED", dispatchDate: new Date() },
      });
      if (updated.count === 0) {
        throw new Error("Only approved transfers can be dispatched.");
      }

      for (const item of transfer.items) {
        await applyStockMovement(tx, {
          itemId: item.itemId,
          warehouseId: transfer.sourceWarehouseId,
          transactionType: "TRANSFER_OUT",
          quantity: item.quantity,
          referenceType: "StockTransfer",
          referenceId: transfer.id,
          referenceNumber: transfer.transferNumber,
          userId: user.id,
        });
      }
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "StockTransfer",
      entityId: id,
      newValues: { status: "DISPATCHED" },
    });
    revalidatePath(`/stock/transfer/${id}`);
    revalidatePath("/stock/transfer");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function receiveTransferAction(id: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("STOCK_TRANSFER_EDIT");

    await prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({ where: { id }, include: { items: true } });
      if (!transfer) throw new Error("Transfer not found.");

      const updated = await tx.stockTransfer.updateMany({
        where: { id, status: "DISPATCHED" },
        data: { status: "RECEIVED", receivedDate: new Date() },
      });
      if (updated.count === 0) {
        throw new Error("Only dispatched transfers can be received.");
      }

      for (const item of transfer.items) {
        await applyStockMovement(tx, {
          itemId: item.itemId,
          warehouseId: transfer.destWarehouseId,
          transactionType: "TRANSFER_IN",
          quantity: item.quantity,
          referenceType: "StockTransfer",
          referenceId: transfer.id,
          referenceNumber: transfer.transferNumber,
          userId: user.id,
        });
      }
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "StockTransfer",
      entityId: id,
      newValues: { status: "RECEIVED" },
    });
    revalidatePath(`/stock/transfer/${id}`);
    revalidatePath("/stock/transfer");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function cancelTransferAction(id: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("STOCK_TRANSFER_EDIT");

    const updated = await prisma.stockTransfer.updateMany({
      where: { id, status: { in: ["DRAFT", "REQUESTED", "APPROVED"] } },
      data: { status: "CANCELLED" },
    });
    if (updated.count === 0) {
      return { ok: false, error: "Only draft, requested or approved transfers can be cancelled." };
    }

    await writeAuditLog({
      userId: user.id,
      action: "ARCHIVE",
      entityType: "StockTransfer",
      entityId: id,
      newValues: { status: "CANCELLED" },
    });
    revalidatePath(`/stock/transfer/${id}`);
    revalidatePath("/stock/transfer");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}
