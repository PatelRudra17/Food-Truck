"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { notifyRoleByName } from "@/lib/services/notifications";
import { applyStockMovement } from "@/lib/services/inventory";
import { nextDocumentNumber } from "@/lib/numbering";
import { validateUpload, uploadObject, UploadValidationError, getSignedDownloadUrl } from "@/lib/storage";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { createAdjustmentSchema, adjustmentDecisionSchema } from "@/lib/validators/stock-adjustment";

export async function createAdjustmentAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("STOCK_ADJUSTMENT_CREATE");
    const data = createAdjustmentSchema.parse({
      itemId: formData.get("itemId"),
      warehouseId: formData.get("warehouseId"),
      physicalQty: formData.get("physicalQty"),
      reason: formData.get("reason"),
    });

    const item = await prisma.item.findUnique({ where: { id: data.itemId } });
    if (!item) return { ok: false, error: "Item not found." };

    const currentQty = item.currentStock;
    const physicalQty = new Prisma.Decimal(data.physicalQty);
    const difference = physicalQty.minus(currentQty);

    let upload: { storageKey: string; fileName: string; mimeType: string; sizeBytes: number } | null = null;
    const file = formData.get("file");
    if (file instanceof File && file.size > 0) {
      try {
        validateUpload({ type: file.type, size: file.size });
      } catch (err) {
        if (err instanceof UploadValidationError) return { ok: false, error: err.message };
        throw err;
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const { storageKey } = await uploadObject({
        buffer,
        mimeType: file.type,
        entityType: "StockAdjustment",
        originalFileName: file.name,
      });
      upload = { storageKey, fileName: file.name, mimeType: file.type, sizeBytes: file.size };
    }

    const adjustment = await prisma.$transaction(async (tx) => {
      const adjustmentNumber = await nextDocumentNumber(tx, "STOCK_ADJUSTMENT");
      const created = await tx.stockAdjustment.create({
        data: {
          adjustmentNumber,
          itemId: data.itemId,
          warehouseId: data.warehouseId,
          currentQty,
          physicalQty,
          difference,
          reason: data.reason,
          createdById: user.id,
          status: "PENDING_APPROVAL",
        },
      });
      await tx.approval.create({
        data: {
          entityType: "StockAdjustment",
          entityId: created.id,
          requestedById: user.id,
          adjustmentFk: created.id,
        },
      });
      if (upload) {
        await tx.attachment.create({
          data: {
            fileName: upload.fileName,
            storageKey: upload.storageKey,
            mimeType: upload.mimeType,
            sizeBytes: upload.sizeBytes,
            entityType: "StockAdjustment",
            entityId: created.id,
            uploadedById: user.id,
            adjustmentFk: created.id,
          },
        });
      }
      return created;
    });

    await notifyRoleByName("Store Manager", {
      type: "PENDING_APPROVAL",
      title: "Stock adjustment pending approval",
      message: `Adjustment ${adjustment.adjustmentNumber} (${difference.gte(0) ? "+" : ""}${difference.toString()}) is awaiting approval.`,
      entityType: "StockAdjustment",
      entityId: adjustment.id,
    });
    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "StockAdjustment",
      entityId: adjustment.id,
      newValues: {
        ...data,
        currentQty: currentQty.toString(),
        difference: difference.toString(),
      },
    });
    revalidatePath("/stock/adjustment");
    return { ok: true, data: { id: adjustment.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function approveAdjustmentAction(id: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("STOCK_ADJUSTMENT_APPROVE");

    await prisma.$transaction(async (tx) => {
      const adjustment = await tx.stockAdjustment.findUnique({
        where: { id },
        include: { approvals: { where: { decision: "PENDING" }, orderBy: { requestedAt: "desc" }, take: 1 } },
      });
      if (!adjustment) throw new Error("Adjustment not found.");

      const updated = await tx.stockAdjustment.updateMany({
        where: { id, status: "PENDING_APPROVAL" },
        data: { status: "APPROVED", approvedById: user.id },
      });
      if (updated.count === 0) {
        throw new Error("Only adjustments pending approval can be approved.");
      }

      const difference = new Prisma.Decimal(adjustment.difference);
      if (!difference.isZero()) {
        await applyStockMovement(tx, {
          itemId: adjustment.itemId,
          warehouseId: adjustment.warehouseId,
          transactionType: difference.gte(0) ? "ADJUSTMENT_POSITIVE" : "ADJUSTMENT_NEGATIVE",
          quantity: difference.abs(),
          referenceType: "StockAdjustment",
          referenceId: adjustment.id,
          referenceNumber: adjustment.adjustmentNumber,
          userId: user.id,
          reason: adjustment.reason,
        });
      }

      const approval = adjustment.approvals[0];
      if (approval) {
        await tx.approval.update({
          where: { id: approval.id },
          data: { decision: "APPROVED", decidedById: user.id, decidedAt: new Date() },
        });
      }
    });

    await writeAuditLog({
      userId: user.id,
      action: "APPROVE",
      entityType: "StockAdjustment",
      entityId: id,
    });
    revalidatePath(`/stock/adjustment/${id}`);
    revalidatePath("/stock/adjustment");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function rejectAdjustmentAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await requirePermission("STOCK_ADJUSTMENT_APPROVE");
    const { id, comment } = adjustmentDecisionSchema.parse(input);

    const adjustment = await prisma.stockAdjustment.findUnique({
      where: { id },
      include: { approvals: { where: { decision: "PENDING" }, orderBy: { requestedAt: "desc" }, take: 1 } },
    });
    if (!adjustment) return { ok: false, error: "Adjustment not found." };

    await prisma.$transaction(async (tx) => {
      const updated = await tx.stockAdjustment.updateMany({
        where: { id, status: "PENDING_APPROVAL" },
        data: { status: "REJECTED" },
      });
      if (updated.count === 0) {
        throw new Error("Only adjustments pending approval can be rejected.");
      }
      const approval = adjustment.approvals[0];
      if (approval) {
        await tx.approval.update({
          where: { id: approval.id },
          data: { decision: "REJECTED", decidedById: user.id, decidedAt: new Date(), comment: comment || undefined },
        });
      }
    });

    await writeAuditLog({
      userId: user.id,
      action: "REJECT",
      entityType: "StockAdjustment",
      entityId: id,
      newValues: { comment },
    });
    revalidatePath(`/stock/adjustment/${id}`);
    revalidatePath("/stock/adjustment");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function getAdjustmentAttachmentUrlAction(
  attachmentId: string,
): Promise<ActionResult<{ url: string }>> {
  try {
    const user = await requirePermission("STOCK_ADJUSTMENT_VIEW");
    const attachment = await prisma.attachment.findUniqueOrThrow({ where: { id: attachmentId } });
    const url = await getSignedDownloadUrl(attachment.storageKey);

    await prisma.documentAccessLog.create({
      data: { attachmentId, userId: user.id, action: "DOWNLOAD" },
    });
    await writeAuditLog({
      userId: user.id,
      action: "DOCUMENT_DOWNLOAD",
      entityType: "Attachment",
      entityId: attachmentId,
    });

    return { ok: true, data: { url } };
  } catch (error) {
    return actionError(error);
  }
}
