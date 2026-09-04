"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, ForbiddenError } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { driverSchema, driverDocumentSchema, isSensitiveDocType } from "@/lib/validators/driver";
import { validateUpload, uploadObject, getSignedDownloadUrl } from "@/lib/storage";
import { encryptSensitive, decryptSensitive, maskForDocType } from "@/lib/crypto";

function toDateOrNull(value: string | undefined): Date | null {
  return value ? new Date(value) : null;
}

export async function createDriverAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("DRIVER_CREATE");
    const data = driverSchema.parse(input);

    if (data.employeeId) {
      const existing = await prisma.driver.findUnique({ where: { employeeId: data.employeeId } });
      if (existing) return { ok: false, error: "A driver with this employee ID already exists." };
    }

    const created = await prisma.driver.create({
      data: {
        employeeId: data.employeeId ?? null,
        fullName: data.fullName,
        mobile: data.mobile,
        altMobile: data.altMobile ?? null,
        address: data.address ?? null,
        dob: toDateOrNull(data.dob),
        joiningDate: toDateOrNull(data.joiningDate),
        emergencyContact: data.emergencyContact ?? null,
        profilePhotoUrl: data.profilePhotoUrl ?? null,
        status: data.status,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "Driver",
      entityId: created.id,
      newValues: data,
    });

    revalidatePath("/drivers");
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateDriverAction(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("DRIVER_EDIT");
    const data = driverSchema.parse(input);

    const existing = await prisma.driver.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Driver not found." };

    if (data.employeeId && data.employeeId !== existing.employeeId) {
      const clash = await prisma.driver.findUnique({ where: { employeeId: data.employeeId } });
      if (clash) return { ok: false, error: "A driver with this employee ID already exists." };
    }

    const updated = await prisma.driver.update({
      where: { id },
      data: {
        employeeId: data.employeeId ?? null,
        fullName: data.fullName,
        mobile: data.mobile,
        altMobile: data.altMobile ?? null,
        address: data.address ?? null,
        dob: toDateOrNull(data.dob),
        joiningDate: toDateOrNull(data.joiningDate),
        emergencyContact: data.emergencyContact ?? null,
        profilePhotoUrl: data.profilePhotoUrl ?? null,
        status: data.status,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Driver",
      entityId: updated.id,
      oldValues: {
        fullName: existing.fullName,
        mobile: existing.mobile,
        status: existing.status,
        employeeId: existing.employeeId,
      },
      newValues: data,
    });

    revalidatePath("/drivers");
    revalidatePath(`/drivers/${id}`);
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function archiveDriverAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("DRIVER_ARCHIVE");
    const existing = await prisma.driver.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Driver not found." };

    await prisma.driver.update({ where: { id }, data: { status: "INACTIVE" } });

    await writeAuditLog({
      userId: user.id,
      action: "ARCHIVE",
      entityType: "Driver",
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status: "INACTIVE" },
    });

    revalidatePath("/drivers");
    revalidatePath(`/drivers/${id}`);
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}

/**
 * Create/edit a DriverDocument. For AADHAAR/PAN/DRIVING_LICENCE, `plainNumber`
 * (if provided) is immediately encrypted+masked and the plaintext is discarded —
 * it is never stored, logged, or included in the audit trail. Leaving
 * `plainNumber` blank on an edit keeps the existing encrypted value untouched.
 */
export async function upsertDriverDocumentAction(
  input: unknown,
  documentId?: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission(documentId ? "DRIVER_DOCUMENT_EDIT" : "DRIVER_DOCUMENT_CREATE");
    const data = driverDocumentSchema.parse(input);

    const driver = await prisma.driver.findUnique({ where: { id: data.driverId } });
    if (!driver) return { ok: false, error: "Driver not found." };

    const sensitive = isSensitiveDocType(data.docType);

    let numberEncrypted: string | null | undefined;
    let numberMasked: string | null | undefined;

    if (sensitive) {
      if (data.plainNumber) {
        numberEncrypted = encryptSensitive(data.plainNumber);
        numberMasked = maskForDocType(data.docType, data.plainNumber);
      } else if (!documentId) {
        return { ok: false, error: "An identity number is required for this document type." };
      }
      // else: editing without a new number — leave numberEncrypted/numberMasked untouched (undefined = no change)
    } else {
      numberEncrypted = null;
      numberMasked = data.plainNumber ?? null;
    }

    const basePayload = {
      driverId: data.driverId,
      docType: data.docType,
      licenceClass: data.docType === "DRIVING_LICENCE" ? (data.licenceClass ?? null) : null,
      issueDate: toDateOrNull(data.issueDate),
      expiryDate: toDateOrNull(data.expiryDate),
      issuingAuthority: data.docType === "DRIVING_LICENCE" ? (data.issuingAuthority ?? null) : null,
      verificationStatus: data.verificationStatus,
      isSensitive: sensitive,
    };

    const doc = documentId
      ? await prisma.driverDocument.update({
          where: { id: documentId },
          data: {
            ...basePayload,
            ...(numberEncrypted !== undefined ? { numberEncrypted } : {}),
            ...(numberMasked !== undefined ? { numberMasked } : {}),
          },
        })
      : await prisma.driverDocument.create({
          data: { ...basePayload, numberEncrypted: numberEncrypted ?? null, numberMasked: numberMasked ?? null },
        });

    // Audit log deliberately excludes the plaintext number and even the encrypted
    // payload — only non-sensitive metadata about the change is recorded.
    await writeAuditLog({
      userId: user.id,
      action: documentId ? "EDIT" : "CREATE",
      entityType: "DriverDocument",
      entityId: doc.id,
      newValues: {
        driverId: data.driverId,
        docType: data.docType,
        verificationStatus: data.verificationStatus,
        numberChanged: numberEncrypted !== undefined,
      },
    });

    revalidatePath(`/drivers/${data.driverId}`);
    return { ok: true, data: { id: doc.id } };
  } catch (error) {
    return actionError(error);
  }
}

/**
 * Returns the decrypted plaintext for a sensitive DriverDocument, ON DEMAND
 * ONLY — never rendered into initial server-rendered HTML. Gated behind
 * VIEW_SENSITIVE_DRIVER_DOCUMENTS and logged via writeAuditLog
 * (SENSITIVE_DOCUMENT_ACCESS). DocumentAccessLog is skipped here since it
 * requires an attachmentId and this reveals a field value, not a file.
 */
export async function revealDriverDocumentNumber(
  driverDocumentId: string,
): Promise<ActionResult<{ value: string }>> {
  try {
    const user = await requirePermission("VIEW_SENSITIVE_DRIVER_DOCUMENTS");

    const doc = await prisma.driverDocument.findUnique({ where: { id: driverDocumentId } });
    if (!doc) return { ok: false, error: "Document not found." };
    if (!doc.numberEncrypted) return { ok: false, error: "No stored number for this document." };

    const value = decryptSensitive(doc.numberEncrypted);

    await writeAuditLog({
      userId: user.id,
      action: "SENSITIVE_DOCUMENT_ACCESS",
      entityType: "DriverDocument",
      entityId: driverDocumentId,
    });

    return { ok: true, data: { value } };
  } catch (error) {
    return actionError(error);
  }
}

export async function uploadDriverDocumentFileAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const driverDocumentId = formData.get("driverDocumentId") as string | null;
    const file = formData.get("file") as File | null;
    if (!driverDocumentId || !file) return { ok: false, error: "Missing file or document reference." };

    const doc = await prisma.driverDocument.findUnique({ where: { id: driverDocumentId } });
    if (!doc) return { ok: false, error: "Driver document not found." };

    // Uploading the file itself (not viewing the stored number) only requires
    // ordinary document edit rights — download of a sensitive attachment is
    // what's gated behind VIEW_SENSITIVE_DRIVER_DOCUMENTS (see the download action).
    const user = await requirePermission("DRIVER_DOCUMENT_EDIT");

    validateUpload({ type: file.type, size: file.size });
    const buffer = Buffer.from(await file.arrayBuffer());
    const { storageKey } = await uploadObject({
      buffer,
      mimeType: file.type,
      entityType: "DriverDocument",
      originalFileName: file.name,
    });

    const attachment = await prisma.attachment.create({
      data: {
        fileName: file.name,
        storageKey,
        mimeType: file.type,
        sizeBytes: file.size,
        entityType: "DriverDocument",
        entityId: driverDocumentId,
        documentType: doc.docType,
        expiryDate: doc.expiryDate,
        isSensitive: doc.isSensitive,
        uploadedById: user.id,
        driverDocFk: driverDocumentId,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "Attachment",
      entityId: attachment.id,
      newValues: { fileName: file.name, driverDocumentId, isSensitive: doc.isSensitive },
    });

    revalidatePath(`/drivers/${doc.driverId}`);
    return { ok: true, data: { id: attachment.id } };
  } catch (error) {
    return actionError(error);
  }
}

/**
 * Signed download URL for a driver document file. Sensitive attachments
 * additionally require VIEW_SENSITIVE_DRIVER_DOCUMENTS, and every access is
 * logged via both DocumentAccessLog (DOWNLOAD) and writeAuditLog
 * (DOCUMENT_DOWNLOAD).
 */
export async function getDriverDocumentDownloadUrlAction(
  attachmentId: string,
): Promise<ActionResult<{ url: string }>> {
  try {
    const user = await requirePermission("DRIVER_DOCUMENT_VIEW");
    const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
    if (!attachment || attachment.isDeleted) return { ok: false, error: "File not found." };

    if (attachment.isSensitive && !user.permissions.includes("VIEW_SENSITIVE_DRIVER_DOCUMENTS")) {
      throw new ForbiddenError("VIEW_SENSITIVE_DRIVER_DOCUMENTS");
    }

    const url = await getSignedDownloadUrl(attachment.storageKey);

    await prisma.documentAccessLog.create({
      data: { attachmentId: attachment.id, userId: user.id, action: "DOWNLOAD" },
    });
    await writeAuditLog({
      userId: user.id,
      action: "DOCUMENT_DOWNLOAD",
      entityType: "Attachment",
      entityId: attachment.id,
    });

    return { ok: true, data: { url } };
  } catch (error) {
    return actionError(error);
  }
}
