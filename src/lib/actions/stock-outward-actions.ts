"use server";

import { Prisma, OutwardStatus, ApprovalDecision } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { nextDocumentNumber } from "@/lib/numbering";
import { applyStockMovement } from "@/lib/services/inventory";
import { assertOutwardQtyAvailable } from "@/lib/services/stock-reservation";
import { assertSeparateApprover } from "@/lib/services/approval-policy";
import { notifyRoleByName } from "@/lib/services/notifications";
import { validateUpload, uploadObject, getSignedDownloadUrl } from "@/lib/storage";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { createOutwardSchema, updateOutwardSchema } from "@/lib/validators/stock-outward";

const TERMINAL_STATUSES: OutwardStatus[] = [
  OutwardStatus.ISSUED,
  OutwardStatus.CANCELLED,
  OutwardStatus.REJECTED,
];

/**
 * Loads the requested items with `currentStock` set to their balance in the given
 * warehouse — an outward can only issue stock held where it is issued from.
 */
async function loadItemsWithWarehouseStock(tx: Prisma.TransactionClient, itemIds: string[], warehouseId: string) {
  const items = await tx.item.findMany({
    where: { id: { in: itemIds } },
    include: { warehouseStocks: { where: { warehouseId }, select: { quantity: true } } },
  });
  return new Map(
    items.map(({ warehouseStocks, ...item }) => [
      item.id,
      { ...item, currentStock: new Prisma.Decimal(warehouseStocks[0]?.quantity ?? 0) },
    ]),
  );
}

export async function createOutwardAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("STOCK_OUTWARD_CREATE");
    const data = createOutwardSchema.parse(input);

    const created = await prisma.$transaction(async (tx) => {
      // Free stock = warehouse balance minus what other pending/approved outwards already claim.
      await assertOutwardQtyAvailable(tx, {
        warehouseId: data.warehouseId,
        lines: data.items.map((line) => ({ itemId: line.itemId, quantity: line.requestedQty })),
      });
      const itemMap = await loadItemsWithWarehouseStock(tx, data.items.map((i) => i.itemId), data.warehouseId);
      if (data.items.some((line) => !itemMap.has(line.itemId))) {
        throw new Error("One of the selected items no longer exists.");
      }

      const outwardNumber = await nextDocumentNumber(tx, "STOCK_OUTWARD");
      return tx.stockOutward.create({
        data: {
          outwardNumber,
          date: new Date(data.date),
          department: data.department || null,
          project: data.project || null,
          requestedById: user.id,
          warehouseId: data.warehouseId,
          vehicleId: data.vehicleId || null,
          driverId: data.driverId || null,
          destination: data.destination || null,
          receiver: data.receiver || null,
          purpose: data.purpose || null,
          remarks: data.remarks || null,
          status: OutwardStatus.DRAFT,
          items: {
            create: data.items.map((line) => ({
              itemId: line.itemId,
              availableQtySnapshot: new Prisma.Decimal(itemMap.get(line.itemId)!.currentStock),
              requestedQty: new Prisma.Decimal(line.requestedQty),
              unit: line.unit,
              batchNumber: line.batchNumber || null,
              serialNumber: line.serialNumber || null,
            })),
          },
        },
      });
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "StockOutward",
      entityId: created.id,
      newValues: data,
    });
    revalidatePath("/stock/outward");
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateOutwardAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("STOCK_OUTWARD_EDIT");
    const data = updateOutwardSchema.parse(input);

    await prisma.$transaction(async (tx) => {
      const existing = await tx.stockOutward.findUniqueOrThrow({ where: { id } });
      if (existing.status !== OutwardStatus.DRAFT) {
        throw new Error("Only draft outward requests can be edited.");
      }

      // Free stock = warehouse balance minus what other pending/approved outwards already claim.
      await assertOutwardQtyAvailable(tx, {
        warehouseId: data.warehouseId,
        lines: data.items.map((line) => ({ itemId: line.itemId, quantity: line.requestedQty })),
        excludeOutwardId: id,
      });
      const itemMap = await loadItemsWithWarehouseStock(tx, data.items.map((i) => i.itemId), data.warehouseId);
      if (data.items.some((line) => !itemMap.has(line.itemId))) {
        throw new Error("One of the selected items no longer exists.");
      }

      await tx.stockOutwardItem.deleteMany({ where: { outwardId: id } });
      await tx.stockOutward.update({
        where: { id },
        data: {
          date: new Date(data.date),
          department: data.department || null,
          project: data.project || null,
          warehouseId: data.warehouseId,
          vehicleId: data.vehicleId || null,
          driverId: data.driverId || null,
          destination: data.destination || null,
          receiver: data.receiver || null,
          purpose: data.purpose || null,
          remarks: data.remarks || null,
          items: {
            create: data.items.map((line) => ({
              itemId: line.itemId,
              availableQtySnapshot: new Prisma.Decimal(itemMap.get(line.itemId)!.currentStock),
              requestedQty: new Prisma.Decimal(line.requestedQty),
              unit: line.unit,
              batchNumber: line.batchNumber || null,
              serialNumber: line.serialNumber || null,
            })),
          },
        },
      });
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "StockOutward",
      entityId: id,
      newValues: data,
    });
    revalidatePath(`/stock/outward/${id}`);
    revalidatePath("/stock/outward");
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function submitOutwardForApprovalAction(id: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("STOCK_OUTWARD_EDIT");

    const outward = await prisma.$transaction(async (tx) => {
      const existing = await tx.stockOutward.findUniqueOrThrow({ where: { id }, include: { items: true } });
      if (existing.status !== OutwardStatus.DRAFT) {
        throw new Error("Only draft outward requests can be submitted for approval.");
      }
      // Submitting turns the draft into a claim on stock, so it must still fit what is free.
      await assertOutwardQtyAvailable(tx, {
        warehouseId: existing.warehouseId,
        lines: existing.items.map((line) => ({ itemId: line.itemId, quantity: line.requestedQty })),
        excludeOutwardId: id,
      });
      const updated = await tx.stockOutward.update({
        where: { id },
        data: { status: OutwardStatus.PENDING_APPROVAL },
      });
      await tx.approval.create({
        data: {
          entityType: "StockOutward",
          entityId: id,
          outwardFk: id,
          requestedById: user.id,
        },
      });
      return updated;
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "StockOutward",
      entityId: id,
      newValues: { status: "PENDING_APPROVAL" },
    });
    await notifyRoleByName("Store Manager", {
      type: "PENDING_APPROVAL",
      title: "Stock Outward pending approval",
      message: `Outward ${outward.outwardNumber} is awaiting approval.`,
      entityType: "StockOutward",
      entityId: id,
    });
    revalidatePath(`/stock/outward/${id}`);
    revalidatePath("/stock/outward");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function approveOutwardAction(id: string, comment?: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("STOCK_OUTWARD_APPROVE");

    await prisma.$transaction(async (tx) => {
      const existing = await tx.stockOutward.findUniqueOrThrow({ where: { id }, include: { items: true } });
      if (existing.status !== OutwardStatus.PENDING_APPROVAL) {
        throw new Error("Only outward requests pending approval can be approved.");
      }
      const approval = await tx.approval.findFirst({
        where: { outwardFk: id, decision: ApprovalDecision.PENDING },
        orderBy: { requestedAt: "desc" },
      });
      await assertSeparateApprover(tx, user.id, [existing.requestedById, approval?.requestedById]);
      // Other approved/pending outwards may have claimed the stock since this one was requested.
      await assertOutwardQtyAvailable(tx, {
        warehouseId: existing.warehouseId,
        lines: existing.items.map((line) => ({ itemId: line.itemId, quantity: line.requestedQty })),
        excludeOutwardId: id,
      });
      if (approval) {
        await tx.approval.update({
          where: { id: approval.id },
          data: {
            decision: ApprovalDecision.APPROVED,
            decidedById: user.id,
            decidedAt: new Date(),
            comment: comment || null,
          },
        });
      }
      await tx.stockOutward.update({
        where: { id },
        data: { status: OutwardStatus.APPROVED, approvedById: user.id },
      });
    });

    await writeAuditLog({ userId: user.id, action: "APPROVE", entityType: "StockOutward", entityId: id });
    revalidatePath(`/stock/outward/${id}`);
    revalidatePath("/stock/outward");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function rejectOutwardAction(id: string, comment: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("STOCK_OUTWARD_APPROVE");

    await prisma.$transaction(async (tx) => {
      const existing = await tx.stockOutward.findUniqueOrThrow({ where: { id } });
      if (existing.status !== OutwardStatus.PENDING_APPROVAL) {
        throw new Error("Only outward requests pending approval can be rejected.");
      }
      const approval = await tx.approval.findFirst({
        where: { outwardFk: id, decision: ApprovalDecision.PENDING },
        orderBy: { requestedAt: "desc" },
      });
      if (approval) {
        await tx.approval.update({
          where: { id: approval.id },
          data: {
            decision: ApprovalDecision.REJECTED,
            decidedById: user.id,
            decidedAt: new Date(),
            comment,
          },
        });
      }
      await tx.stockOutward.update({
        where: { id },
        data: { status: OutwardStatus.REJECTED, approvedById: user.id },
      });
    });

    await writeAuditLog({
      userId: user.id,
      action: "REJECT",
      entityType: "StockOutward",
      entityId: id,
      newValues: { comment },
    });
    revalidatePath(`/stock/outward/${id}`);
    revalidatePath("/stock/outward");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

/** Transition APPROVED -> ISSUED: the only point stock is actually decremented. */
export async function issueOutwardAction(id: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("STOCK_OUTWARD_EDIT");

    await prisma.$transaction(async (tx) => {
      const outward = await tx.stockOutward.findUniqueOrThrow({
        where: { id },
        include: { items: true },
      });

      if (TERMINAL_STATUSES.includes(outward.status)) {
        throw new Error(`This outward request is already ${outward.status.toLowerCase()} and cannot be processed again.`);
      }
      if (outward.status !== OutwardStatus.APPROVED) {
        throw new Error("Only approved outward requests can be issued.");
      }

      for (const item of outward.items) {
        // Lets InsufficientStockError surface as-is if stock has since become insufficient.
        await applyStockMovement(tx, {
          itemId: item.itemId,
          warehouseId: outward.warehouseId,
          transactionType: "OUTWARD",
          quantity: item.requestedQty,
          referenceType: "StockOutward",
          referenceId: outward.id,
          referenceNumber: outward.outwardNumber,
          userId: user.id,
        });
      }

      await tx.stockOutward.update({ where: { id }, data: { status: OutwardStatus.ISSUED } });
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "StockOutward",
      entityId: id,
      newValues: { status: "ISSUED" },
    });
    revalidatePath(`/stock/outward/${id}`);
    revalidatePath("/stock/outward");
    revalidatePath("/dashboard");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function cancelOutwardAction(id: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("STOCK_OUTWARD_EDIT");

    await prisma.$transaction(async (tx) => {
      const outward = await tx.stockOutward.findUniqueOrThrow({ where: { id } });
      if (TERMINAL_STATUSES.includes(outward.status)) {
        throw new Error(`This outward request is already ${outward.status.toLowerCase()} and cannot be cancelled.`);
      }
      await tx.stockOutward.update({ where: { id }, data: { status: OutwardStatus.CANCELLED } });
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "StockOutward",
      entityId: id,
      newValues: { status: "CANCELLED" },
    });
    revalidatePath(`/stock/outward/${id}`);
    revalidatePath("/stock/outward");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function uploadOutwardAttachmentAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("STOCK_OUTWARD_EDIT");
    const outwardId = formData.get("outwardId");
    const file = formData.get("file");

    if (typeof outwardId !== "string" || !outwardId) {
      throw new Error("Missing outward reference.");
    }
    if (!(file instanceof File)) {
      throw new Error("No file was provided.");
    }
    validateUpload({ type: file.type, size: file.size });

    const buffer = Buffer.from(await file.arrayBuffer());
    const { storageKey } = await uploadObject({
      buffer,
      mimeType: file.type,
      entityType: "StockOutward",
      originalFileName: file.name,
    });

    const attachment = await prisma.attachment.create({
      data: {
        fileName: file.name,
        storageKey,
        mimeType: file.type,
        sizeBytes: file.size,
        entityType: "StockOutward",
        entityId: outwardId,
        outwardFk: outwardId,
        uploadedById: user.id,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "Attachment",
      entityId: attachment.id,
      newValues: { outwardId, fileName: file.name },
    });
    revalidatePath(`/stock/outward/${outwardId}`);
    return { ok: true, data: { id: attachment.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function getOutwardAttachmentUrlAction(
  attachmentId: string,
): Promise<ActionResult<{ url: string }>> {
  try {
    const user = await requirePermission("STOCK_OUTWARD_VIEW");
    const attachment = await prisma.attachment.findUniqueOrThrow({ where: { id: attachmentId } });
    const url = await getSignedDownloadUrl(attachment.storageKey);

    await prisma.documentAccessLog.create({
      data: { attachmentId, userId: user.id, action: "VIEW" },
    });
    await writeAuditLog({
      userId: user.id,
      action: "DOCUMENT_VIEW",
      entityType: "Attachment",
      entityId: attachmentId,
    });

    return { ok: true, data: { url } };
  } catch (error) {
    return actionError(error);
  }
}
