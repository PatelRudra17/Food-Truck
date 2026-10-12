"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { vehicleSchema, vehicleDocumentSchema, type VehicleInput } from "@/lib/validators/vehicle";
import { computeMaintenanceState } from "@/lib/services/maintenance";
import { vehicleExpiryUpdateForDocument } from "@/lib/services/vehicle-expiry-sync";
import { validateUpload, uploadObject, getSignedDownloadUrl } from "@/lib/storage";

function toDateOrNull(value: string | undefined): Date | null {
  return value ? new Date(value) : null;
}

/** Vehicle numbers are normalised by vehicleSchema; this also catches legacy rows stored in other casing. */
async function findVehicleNumberClash(vehicleNumber: string, excludeId?: string) {
  return prisma.vehicle.findFirst({
    where: {
      vehicleNumber: { equals: vehicleNumber, mode: "insensitive" },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
}

/** Fuel target + service schedule columns shared by create and update. */
function scheduleFields(data: VehicleInput) {
  return {
    fuelEfficiencyTargetKmpl: data.fuelEfficiencyTargetKmpl ?? null,
    serviceIntervalDays: data.serviceIntervalDays ?? null,
    serviceIntervalKm: data.serviceIntervalKm ?? null,
    nextServiceDate: toDateOrNull(data.nextServiceDate),
    nextServiceKm: data.nextServiceKm ?? null,
  };
}

export async function createVehicleAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("VEHICLE_CREATE");
    const data = vehicleSchema.parse(input);

    const existing = await findVehicleNumberClash(data.vehicleNumber);
    if (existing) {
      return { ok: false, error: "A vehicle with this number already exists." };
    }

    const created = await prisma.vehicle.create({
      data: {
        vehicleNumber: data.vehicleNumber,
        vehicleType: data.vehicleType,
        manufacturer: data.manufacturer ?? null,
        model: data.model ?? null,
        ownerCompany: data.ownerCompany ?? null,
        registrationDate: toDateOrNull(data.registrationDate),
        registrationExpiry: toDateOrNull(data.registrationExpiry),
        insuranceExpiry: toDateOrNull(data.insuranceExpiry),
        pucExpiry: toDateOrNull(data.pucExpiry),
        fitnessExpiry: toDateOrNull(data.fitnessExpiry),
        permitExpiry: toDateOrNull(data.permitExpiry),
        capacity: data.capacity ?? null,
        currentDriverId: data.currentDriverId ?? null,
        currentLocation: data.currentLocation ?? null,
        status: data.status,
        imageUrl: data.imageUrl ?? null,
        ...scheduleFields(data),
        maintenanceState: computeMaintenanceState({
          currentKm: 0,
          nextServiceKm: data.nextServiceKm ?? null,
          nextServiceDate: toDateOrNull(data.nextServiceDate),
        }),
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "Vehicle",
      entityId: created.id,
      newValues: data,
    });

    revalidatePath("/vehicles");
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateVehicleAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("VEHICLE_EDIT");
    const data = vehicleSchema.parse(input);

    const existing = await prisma.vehicle.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Vehicle not found." };

    const clash = await findVehicleNumberClash(data.vehicleNumber, id);
    if (clash) return { ok: false, error: "A vehicle with this number already exists." };

    const schedule = scheduleFields(data);

    const updated = await prisma.vehicle.update({
      where: { id },
      data: {
        vehicleNumber: data.vehicleNumber,
        vehicleType: data.vehicleType,
        manufacturer: data.manufacturer ?? null,
        model: data.model ?? null,
        ownerCompany: data.ownerCompany ?? null,
        registrationDate: toDateOrNull(data.registrationDate),
        registrationExpiry: toDateOrNull(data.registrationExpiry),
        insuranceExpiry: toDateOrNull(data.insuranceExpiry),
        pucExpiry: toDateOrNull(data.pucExpiry),
        fitnessExpiry: toDateOrNull(data.fitnessExpiry),
        permitExpiry: toDateOrNull(data.permitExpiry),
        capacity: data.capacity ?? null,
        currentDriverId: data.currentDriverId ?? null,
        currentLocation: data.currentLocation ?? null,
        status: data.status,
        imageUrl: data.imageUrl ?? null,
        ...schedule,
        maintenanceState: computeMaintenanceState({
          currentKm: existing.odometerKm,
          nextServiceKm: schedule.nextServiceKm,
          nextServiceDate: schedule.nextServiceDate,
        }),
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Vehicle",
      entityId: updated.id,
      oldValues: {
        vehicleNumber: existing.vehicleNumber,
        vehicleType: existing.vehicleType,
        manufacturer: existing.manufacturer,
        model: existing.model,
        ownerCompany: existing.ownerCompany,
        status: existing.status,
        currentDriverId: existing.currentDriverId,
        currentLocation: existing.currentLocation,
        fuelEfficiencyTargetKmpl: existing.fuelEfficiencyTargetKmpl,
        serviceIntervalDays: existing.serviceIntervalDays,
        serviceIntervalKm: existing.serviceIntervalKm,
        nextServiceDate: existing.nextServiceDate,
        nextServiceKm: existing.nextServiceKm,
      },
      newValues: data,
    });

    revalidatePath("/vehicles");
    revalidatePath(`/vehicles/${id}`);
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function archiveVehicleAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("VEHICLE_ARCHIVE");
    const existing = await prisma.vehicle.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Vehicle not found." };

    await prisma.vehicle.update({ where: { id }, data: { status: "INACTIVE" } });

    await writeAuditLog({
      userId: user.id,
      action: "ARCHIVE",
      entityType: "Vehicle",
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status: "INACTIVE" },
    });

    revalidatePath("/vehicles");
    revalidatePath(`/vehicles/${id}`);
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function upsertVehicleDocumentAction(
  input: unknown,
  documentId?: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission(documentId ? "VEHICLE_DOCUMENT_EDIT" : "VEHICLE_DOCUMENT_CREATE");
    const data = vehicleDocumentSchema.parse(input);

    const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } });
    if (!vehicle) return { ok: false, error: "Vehicle not found." };

    if (documentId) {
      const existingDoc = await prisma.vehicleDocument.findUnique({
        where: { id: documentId },
        select: { vehicleId: true },
      });
      if (!existingDoc || existingDoc.vehicleId !== vehicle.id) {
        return { ok: false, error: "Vehicle document not found." };
      }
    }

    const payload = {
      vehicleId: data.vehicleId,
      docType: data.docType,
      docNumber: data.docNumber ?? null,
      issueDate: toDateOrNull(data.issueDate),
      expiryDate: toDateOrNull(data.expiryDate),
      verificationStatus: data.verificationStatus,
    };

    // Keep the vehicle's own expiry column for this document type in sync
    // (only ever moved forward - see vehicleExpiryUpdateForDocument).
    const expiryUpdate = vehicleExpiryUpdateForDocument(data.docType, payload.expiryDate, vehicle);

    const doc = await prisma.$transaction(async (tx) => {
      const saved = documentId
        ? await tx.vehicleDocument.update({ where: { id: documentId }, data: payload })
        : await tx.vehicleDocument.create({ data: payload });
      if (expiryUpdate) {
        await tx.vehicle.update({ where: { id: vehicle.id }, data: expiryUpdate });
      }
      return saved;
    });

    await writeAuditLog({
      userId: user.id,
      action: documentId ? "EDIT" : "CREATE",
      entityType: "VehicleDocument",
      entityId: doc.id,
      newValues: payload,
    });

    if (expiryUpdate) {
      const [field] = Object.keys(expiryUpdate) as (keyof typeof expiryUpdate)[];
      await writeAuditLog({
        userId: user.id,
        action: "EDIT",
        entityType: "Vehicle",
        entityId: vehicle.id,
        oldValues: { [field]: vehicle[field] },
        newValues: { ...expiryUpdate, syncedFromVehicleDocument: doc.id },
      });
    }

    revalidatePath("/vehicles");
    revalidatePath(`/vehicles/${data.vehicleId}`);
    return { ok: true, data: { id: doc.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function uploadVehicleDocumentFileAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("VEHICLE_DOCUMENT_EDIT");
    const vehicleDocumentId = formData.get("vehicleDocumentId") as string | null;
    const file = formData.get("file") as File | null;
    if (!vehicleDocumentId || !file) return { ok: false, error: "Missing file or document reference." };

    const doc = await prisma.vehicleDocument.findUnique({ where: { id: vehicleDocumentId } });
    if (!doc) return { ok: false, error: "Vehicle document not found." };

    validateUpload({ type: file.type, size: file.size });
    const buffer = Buffer.from(await file.arrayBuffer());
    const { storageKey } = await uploadObject({
      buffer,
      mimeType: file.type,
      entityType: "VehicleDocument",
      originalFileName: file.name,
    });

    const attachment = await prisma.attachment.create({
      data: {
        fileName: file.name,
        storageKey,
        mimeType: file.type,
        sizeBytes: file.size,
        entityType: "VehicleDocument",
        entityId: vehicleDocumentId,
        documentType: doc.docType,
        expiryDate: doc.expiryDate,
        isSensitive: false,
        uploadedById: user.id,
        vehicleDocFk: vehicleDocumentId,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "Attachment",
      entityId: attachment.id,
      newValues: { fileName: file.name, vehicleDocumentId },
    });

    revalidatePath(`/vehicles/${doc.vehicleId}`);
    return { ok: true, data: { id: attachment.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function getVehicleDocumentDownloadUrlAction(
  attachmentId: string,
): Promise<ActionResult<{ url: string }>> {
  try {
    const user = await requirePermission("VEHICLE_DOCUMENT_VIEW");
    const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
    if (!attachment || attachment.isDeleted) return { ok: false, error: "File not found." };

    const url = await getSignedDownloadUrl(attachment.storageKey);

    await prisma.documentAccessLog.create({
      data: { attachmentId: attachment.id, userId: user.id, action: "VIEW" },
    });
    await writeAuditLog({
      userId: user.id,
      action: "DOCUMENT_VIEW",
      entityType: "Attachment",
      entityId: attachment.id,
    });

    return { ok: true, data: { url } };
  } catch (error) {
    return actionError(error);
  }
}
