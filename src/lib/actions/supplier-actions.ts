"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { supplierSchema } from "@/lib/validators/supplier";
import { validateUpload, uploadObject, getSignedDownloadUrl } from "@/lib/storage";

function toNullable(value: string | undefined) {
  return value && value.trim().length > 0 ? value.trim() : null;
}

export async function createSupplierAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("SUPPLIER_CREATE");
    const data = supplierSchema.parse(input);

    const created = await prisma.supplier.create({
      data: {
        code: data.code.trim(),
        companyName: data.companyName.trim(),
        contactPerson: toNullable(data.contactPerson),
        phone: toNullable(data.phone),
        email: toNullable(data.email),
        address: toNullable(data.address),
        gstNumber: toNullable(data.gstNumber),
        panNumber: toNullable(data.panNumber),
        status: data.status,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "Supplier",
      entityId: created.id,
      newValues: data,
    });

    revalidatePath("/suppliers");
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "A supplier with this code already exists." };
    }
    return actionError(error);
  }
}

export async function updateSupplierAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("SUPPLIER_EDIT");
    const data = supplierSchema.parse(input);
    const existing = await prisma.supplier.findUniqueOrThrow({ where: { id } });

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        code: data.code.trim(),
        companyName: data.companyName.trim(),
        contactPerson: toNullable(data.contactPerson),
        phone: toNullable(data.phone),
        email: toNullable(data.email),
        address: toNullable(data.address),
        gstNumber: toNullable(data.gstNumber),
        panNumber: toNullable(data.panNumber),
        status: data.status,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Supplier",
      entityId: id,
      oldValues: existing,
      newValues: data,
    });

    revalidatePath("/suppliers");
    revalidatePath(`/suppliers/${id}`);
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "A supplier with this code already exists." };
    }
    return actionError(error);
  }
}

export async function archiveSupplierAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("SUPPLIER_ARCHIVE");
    const existing = await prisma.supplier.findUniqueOrThrow({ where: { id } });
    const updated = await prisma.supplier.update({ where: { id }, data: { status: "INACTIVE" } });

    await writeAuditLog({
      userId: user.id,
      action: "ARCHIVE",
      entityType: "Supplier",
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status: "INACTIVE" },
    });

    revalidatePath("/suppliers");
    revalidatePath(`/suppliers/${id}`);
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function reactivateSupplierAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("SUPPLIER_EDIT");
    const existing = await prisma.supplier.findUniqueOrThrow({ where: { id } });
    const updated = await prisma.supplier.update({ where: { id }, data: { status: "ACTIVE" } });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Supplier",
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status: "ACTIVE" },
    });

    revalidatePath("/suppliers");
    revalidatePath(`/suppliers/${id}`);
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function uploadSupplierAttachmentAction(
  supplierId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("SUPPLIER_EDIT");
    const file = formData.get("file") as File | null;
    const documentType = (formData.get("documentType") as string | null) || null;

    if (!file || file.size === 0) {
      return { ok: false, error: "Please choose a file to upload." };
    }

    validateUpload({ type: file.type, size: file.size });
    const buffer = Buffer.from(await file.arrayBuffer());
    const { storageKey } = await uploadObject({
      buffer,
      mimeType: file.type,
      entityType: "supplier",
      originalFileName: file.name,
    });

    const attachment = await prisma.attachment.create({
      data: {
        fileName: file.name,
        storageKey,
        mimeType: file.type,
        sizeBytes: file.size,
        entityType: "Supplier",
        entityId: supplierId,
        documentType,
        uploadedById: user.id,
        supplierFk: supplierId,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "Attachment",
      entityId: attachment.id,
      newValues: { supplierId, fileName: file.name, documentType },
    });

    revalidatePath(`/suppliers/${supplierId}`);
    return { ok: true, data: { id: attachment.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function getSupplierAttachmentUrlAction(
  attachmentId: string,
): Promise<ActionResult<{ url: string }>> {
  try {
    const user = await requirePermission("SUPPLIER_VIEW");
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
