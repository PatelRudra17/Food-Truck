"use server";

import { Prisma, InwardStatus, ApprovalDecision, POStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { nextDocumentNumber } from "@/lib/numbering";
import { applyStockMovement } from "@/lib/services/inventory";
import { applyReceiptToPurchaseOrder } from "@/lib/services/purchase-order";
import { notifyRoleByName } from "@/lib/services/notifications";
import { validateUpload, uploadObject, getSignedDownloadUrl } from "@/lib/storage";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { createInwardSchema, updateInwardSchema, type CreateInwardInput } from "@/lib/validators/stock-inward";
import { assertSeparateApprover } from "@/lib/services/approval-policy";

function computeLineTotal(quantity: number, rate?: number | null, taxPercent?: number | null) {
  if (rate == null) return null;
  const base = quantity * rate;
  const tax = taxPercent ? base * (taxPercent / 100) : 0;
  return base + tax;
}

/**
 * An inward raised against a PO must reference an open PO (APPROVED /
 * PARTIALLY_RECEIVED) from the same supplier, and every line's poItemId must
 * be a line of THAT PO for the same item. Quantity limits are enforced at
 * receipt time by applyReceiptToPurchaseOrder, since other inwards may be
 * received in between.
 */
async function assertInwardPoLinkage(tx: Prisma.TransactionClient, data: CreateInwardInput) {
  const linkedLines = data.items.filter((item) => item.poItemId);
  if (!data.purchaseOrderId) {
    if (linkedLines.length > 0) throw new Error("Purchase order lines can only be used on an inward linked to that purchase order.");
    return;
  }

  const po = await tx.purchaseOrder.findUnique({ where: { id: data.purchaseOrderId }, include: { items: true } });
  if (!po) throw new Error("Selected purchase order was not found.");
  if (po.status !== POStatus.APPROVED && po.status !== POStatus.PARTIALLY_RECEIVED) {
    throw new Error(`Purchase order ${po.poNumber} is not open for receiving.`);
  }
  if (data.supplierId && data.supplierId !== po.supplierId) {
    throw new Error(`Purchase order ${po.poNumber} belongs to a different supplier.`);
  }

  const poItemsById = new Map(po.items.map((line) => [line.id, line]));
  for (const item of linkedLines) {
    const poItem = poItemsById.get(item.poItemId as string);
    if (!poItem) throw new Error(`A line item does not belong to purchase order ${po.poNumber}.`);
    if (poItem.itemId !== item.itemId) {
      throw new Error(`A line item does not match the item on its purchase order ${po.poNumber} line.`);
    }
  }
}

export async function createInwardAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("STOCK_INWARD_CREATE");
    const data = createInwardSchema.parse(input);

    const created = await prisma.$transaction(async (tx) => {
      await assertInwardPoLinkage(tx, data);
      const inwardNumber = await nextDocumentNumber(tx, "STOCK_INWARD");
      return tx.stockInward.create({
        data: {
          inwardNumber,
          date: new Date(data.date),
          supplierId: data.supplierId || null,
          purchaseOrderId: data.purchaseOrderId || null,
          invoiceNumber: data.invoiceNumber || null,
          vehicleId: data.vehicleId || null,
          driverId: data.driverId || null,
          warehouseId: data.warehouseId,
          receivedById: user.id,
          remarks: data.remarks || null,
          status: InwardStatus.DRAFT,
          items: {
            create: data.items.map((item) => {
              const total = computeLineTotal(item.quantity, item.rate, item.taxPercent);
              return {
                itemId: item.itemId,
                poItemId: item.poItemId || null,
                quantity: new Prisma.Decimal(item.quantity),
                unit: item.unit,
                batchNumber: item.batchNumber || null,
                serialNumber: item.serialNumber || null,
                expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
                rate: item.rate != null ? new Prisma.Decimal(item.rate) : null,
                taxPercent: item.taxPercent != null ? new Prisma.Decimal(item.taxPercent) : null,
                total: total != null ? new Prisma.Decimal(total) : null,
              };
            }),
          },
        },
      });
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "StockInward",
      entityId: created.id,
      newValues: data,
    });
    revalidatePath("/stock/inward");
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateInwardAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("STOCK_INWARD_EDIT");
    const data = updateInwardSchema.parse(input);

    await prisma.$transaction(async (tx) => {
      const existing = await tx.stockInward.findUniqueOrThrow({ where: { id } });
      if (existing.status !== InwardStatus.DRAFT) {
        throw new Error("Only draft inwards can be edited.");
      }
      await assertInwardPoLinkage(tx, data);

      await tx.stockInwardItem.deleteMany({ where: { inwardId: id } });
      await tx.stockInward.update({
        where: { id },
        data: {
          date: new Date(data.date),
          supplierId: data.supplierId || null,
          purchaseOrderId: data.purchaseOrderId || null,
          invoiceNumber: data.invoiceNumber || null,
          vehicleId: data.vehicleId || null,
          driverId: data.driverId || null,
          warehouseId: data.warehouseId,
          remarks: data.remarks || null,
          items: {
            create: data.items.map((item) => {
              const total = computeLineTotal(item.quantity, item.rate, item.taxPercent);
              return {
                itemId: item.itemId,
                poItemId: item.poItemId || null,
                quantity: new Prisma.Decimal(item.quantity),
                unit: item.unit,
                batchNumber: item.batchNumber || null,
                serialNumber: item.serialNumber || null,
                expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
                rate: item.rate != null ? new Prisma.Decimal(item.rate) : null,
                taxPercent: item.taxPercent != null ? new Prisma.Decimal(item.taxPercent) : null,
                total: total != null ? new Prisma.Decimal(total) : null,
              };
            }),
          },
        },
      });
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "StockInward",
      entityId: id,
      newValues: data,
    });
    revalidatePath(`/stock/inward/${id}`);
    revalidatePath("/stock/inward");
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function submitInwardForApprovalAction(id: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("STOCK_INWARD_EDIT");

    const inward = await prisma.$transaction(async (tx) => {
      const existing = await tx.stockInward.findUniqueOrThrow({ where: { id } });
      if (existing.status !== InwardStatus.DRAFT) {
        throw new Error("Only draft inwards can be submitted for approval.");
      }
      const updated = await tx.stockInward.update({
        where: { id },
        data: { status: InwardStatus.PENDING },
      });
      await tx.approval.create({
        data: {
          entityType: "StockInward",
          entityId: id,
          inwardFk: id,
          requestedById: user.id,
        },
      });
      return updated;
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "StockInward",
      entityId: id,
      newValues: { status: "PENDING" },
    });
    await notifyRoleByName("Store Manager", {
      type: "PENDING_APPROVAL",
      title: "Stock Inward pending approval",
      message: `Inward ${inward.inwardNumber} is awaiting approval.`,
      entityType: "StockInward",
      entityId: id,
    });
    revalidatePath(`/stock/inward/${id}`);
    revalidatePath("/stock/inward");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function approveInwardAction(id: string, comment?: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("STOCK_INWARD_APPROVE");

    await prisma.$transaction(async (tx) => {
      const existing = await tx.stockInward.findUniqueOrThrow({ where: { id } });
      if (existing.status !== InwardStatus.PENDING) {
        throw new Error("Only inwards pending approval can be approved.");
      }
      const approval = await tx.approval.findFirst({
        where: { inwardFk: id, decision: ApprovalDecision.PENDING },
        orderBy: { requestedAt: "desc" },
      });
      await assertSeparateApprover(tx, user.id, [existing.receivedById, approval?.requestedById]);
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
      await tx.stockInward.update({ where: { id }, data: { status: InwardStatus.APPROVED } });
    });

    await writeAuditLog({ userId: user.id, action: "APPROVE", entityType: "StockInward", entityId: id });
    revalidatePath(`/stock/inward/${id}`);
    revalidatePath("/stock/inward");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function rejectInwardAction(id: string, comment: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("STOCK_INWARD_APPROVE");

    await prisma.$transaction(async (tx) => {
      const existing = await tx.stockInward.findUniqueOrThrow({ where: { id } });
      if (existing.status !== InwardStatus.PENDING) {
        throw new Error("Only inwards pending approval can be rejected.");
      }
      const approval = await tx.approval.findFirst({
        where: { inwardFk: id, decision: ApprovalDecision.PENDING },
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
      await tx.stockInward.update({ where: { id }, data: { status: InwardStatus.DRAFT } });
    });

    await writeAuditLog({
      userId: user.id,
      action: "REJECT",
      entityType: "StockInward",
      entityId: id,
      newValues: { comment },
    });
    revalidatePath(`/stock/inward/${id}`);
    revalidatePath("/stock/inward");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

/** Transition APPROVED -> RECEIVED: posts the inward stock movement and, if this
 * inward was raised against a PO, reconciles received quantities on that PO. */
export async function receiveInwardAction(id: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("STOCK_INWARD_EDIT");

    await prisma.$transaction(async (tx) => {
      const inward = await tx.stockInward.findUniqueOrThrow({
        where: { id },
        include: { items: true },
      });

      if (inward.status === InwardStatus.RECEIVED || inward.status === InwardStatus.CANCELLED) {
        throw new Error(`This inward is already ${inward.status.toLowerCase()} and cannot be processed again.`);
      }
      if (inward.status !== InwardStatus.APPROVED) {
        throw new Error("Only approved inwards can be marked as received.");
      }
      // The PO may have been cancelled (or fully received) since this inward was drafted.
      if (inward.purchaseOrderId) {
        const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: inward.purchaseOrderId } });
        if (po.status !== POStatus.APPROVED && po.status !== POStatus.PARTIALLY_RECEIVED) {
          throw new Error(
            `Purchase order ${po.poNumber} is ${po.status.toLowerCase().replace(/_/g, " ")} and cannot be received against.`,
          );
        }
      }

      for (const item of inward.items) {
        await applyStockMovement(tx, {
          itemId: item.itemId,
          warehouseId: inward.warehouseId,
          transactionType: "INWARD",
          quantity: item.quantity,
          referenceType: "StockInward",
          referenceId: inward.id,
          referenceNumber: inward.inwardNumber,
          userId: user.id,
        });
      }

      if (inward.purchaseOrderId) {
        const receipts = inward.items
          .filter((item) => item.poItemId)
          .map((item) => ({ poItemId: item.poItemId as string, quantity: item.quantity }));
        if (receipts.length > 0) {
          // Throws if any line would be received beyond its remaining PO quantity.
          await applyReceiptToPurchaseOrder(tx, { poId: inward.purchaseOrderId, receipts });
        }
      }

      await tx.stockInward.update({ where: { id }, data: { status: InwardStatus.RECEIVED } });
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "StockInward",
      entityId: id,
      newValues: { status: "RECEIVED" },
    });
    revalidatePath(`/stock/inward/${id}`);
    revalidatePath("/stock/inward");
    revalidatePath("/dashboard");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function cancelInwardAction(id: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("STOCK_INWARD_EDIT");

    await prisma.$transaction(async (tx) => {
      const inward = await tx.stockInward.findUniqueOrThrow({ where: { id } });
      if (inward.status === InwardStatus.RECEIVED || inward.status === InwardStatus.CANCELLED) {
        throw new Error(`This inward is already ${inward.status.toLowerCase()} and cannot be cancelled.`);
      }
      await tx.stockInward.update({ where: { id }, data: { status: InwardStatus.CANCELLED } });
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "StockInward",
      entityId: id,
      newValues: { status: "CANCELLED" },
    });
    revalidatePath(`/stock/inward/${id}`);
    revalidatePath("/stock/inward");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function uploadInwardAttachmentAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("STOCK_INWARD_EDIT");
    const inwardId = formData.get("inwardId");
    const file = formData.get("file");

    if (typeof inwardId !== "string" || !inwardId) {
      throw new Error("Missing inward reference.");
    }
    if (!(file instanceof File)) {
      throw new Error("No file was provided.");
    }
    validateUpload({ type: file.type, size: file.size });

    const buffer = Buffer.from(await file.arrayBuffer());
    const { storageKey } = await uploadObject({
      buffer,
      mimeType: file.type,
      entityType: "StockInward",
      originalFileName: file.name,
    });

    const attachment = await prisma.attachment.create({
      data: {
        fileName: file.name,
        storageKey,
        mimeType: file.type,
        sizeBytes: file.size,
        entityType: "StockInward",
        entityId: inwardId,
        inwardFk: inwardId,
        uploadedById: user.id,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "Attachment",
      entityId: attachment.id,
      newValues: { inwardId, fileName: file.name },
    });
    revalidatePath(`/stock/inward/${inwardId}`);
    return { ok: true, data: { id: attachment.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function getInwardAttachmentUrlAction(
  attachmentId: string,
): Promise<ActionResult<{ url: string }>> {
  try {
    const user = await requirePermission("STOCK_INWARD_VIEW");
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
