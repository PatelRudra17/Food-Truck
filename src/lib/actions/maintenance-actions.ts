"use server";

import { Prisma, type MaintenanceState } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireUser } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { maintenanceSchema } from "@/lib/validators/maintenance";
import { computeMaintenanceState, deriveServiceSchedule } from "@/lib/services/maintenance";
import { checkDispatchEligibility, type DispatchCheck } from "@/lib/services/dispatch";
import { validateUpload, uploadObject, getSignedDownloadUrl } from "@/lib/storage";

/**
 * Re-reads the vehicle's current odometer/schedule fields and persists a fresh
 * maintenanceState. Called after every event that can change either input:
 * a new maintenance record, or a fuel entry that advances the vehicle's
 * odometer reading.
 */
export async function recomputeVehicleMaintenanceState(
  vehicleId: string,
): Promise<ActionResult<{ maintenanceState: MaintenanceState }>> {
  try {
    await requireUser();
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new Error("Vehicle not found.");

    const state = computeMaintenanceState({
      currentKm: vehicle.odometerKm,
      nextServiceKm: vehicle.nextServiceKm,
      nextServiceDate: vehicle.nextServiceDate,
    });

    if (state !== vehicle.maintenanceState) {
      await prisma.vehicle.update({ where: { id: vehicleId }, data: { maintenanceState: state } });
    }

    return { ok: true, data: { maintenanceState: state } };
  } catch (error) {
    return actionError(error);
  }
}

export async function createMaintenanceAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("MAINTENANCE_CREATE");
    const raw = Object.fromEntries(formData.entries());
    const parsed = maintenanceSchema.parse(raw);

    const vehicle = await prisma.vehicle.findUnique({ where: { id: parsed.vehicleId } });
    if (!vehicle) throw new Error("Vehicle not found.");

    const serviceDate = new Date(parsed.serviceDate);
    if (Number.isNaN(serviceDate.getTime())) throw new Error("Invalid service date.");

    const totalCost = parsed.labourCost + parsed.partsCost + parsed.otherCost;

    const nextServiceDate = vehicle.serviceIntervalDays
      ? new Date(serviceDate.getTime() + vehicle.serviceIntervalDays * 24 * 60 * 60 * 1000)
      : vehicle.nextServiceDate;
    const nextServiceKm = vehicle.serviceIntervalKm
      ? new Prisma.Decimal(parsed.odometerKm).plus(vehicle.serviceIntervalKm)
      : vehicle.nextServiceKm;

    const newState = computeMaintenanceState({
      currentKm: vehicle.odometerKm,
      nextServiceKm,
      nextServiceDate,
    });

    const file = formData.get("attachment");
    let uploaded: { storageKey: string; fileName: string; mimeType: string; sizeBytes: number } | null = null;
    if (file instanceof File && file.size > 0) {
      validateUpload({ type: file.type, size: file.size });
      const buffer = Buffer.from(await file.arrayBuffer());
      const { storageKey } = await uploadObject({
        buffer,
        mimeType: file.type,
        entityType: "VehicleMaintenance",
        originalFileName: file.name,
      });
      uploaded = { storageKey, fileName: file.name, mimeType: file.type, sizeBytes: file.size };
    }

    const created = await prisma.$transaction(async (tx) => {
      const record = await tx.vehicleMaintenance.create({
        data: {
          vehicleId: parsed.vehicleId,
          maintenanceType: parsed.maintenanceType,
          serviceDate,
          odometerKm: parsed.odometerKm,
          serviceCenterVendor: parsed.serviceCenterVendor || null,
          technician: parsed.technician || null,
          workPerformed: parsed.workPerformed || null,
          partsReplaced: parsed.partsReplaced || null,
          labourCost: parsed.labourCost,
          partsCost: parsed.partsCost,
          otherCost: parsed.otherCost,
          totalCost,
          remarks: parsed.remarks || null,
          createdById: user.id,
        },
      });

      if (uploaded) {
        await tx.attachment.create({
          data: {
            fileName: uploaded.fileName,
            storageKey: uploaded.storageKey,
            mimeType: uploaded.mimeType,
            sizeBytes: uploaded.sizeBytes,
            entityType: "VehicleMaintenance",
            entityId: record.id,
            documentType: "MAINTENANCE_INVOICE",
            uploadedById: user.id,
            maintenanceFk: record.id,
          },
        });
      }

      await tx.vehicle.update({
        where: { id: vehicle.id },
        data: {
          lastServiceDate: serviceDate,
          lastServiceKm: parsed.odometerKm,
          nextServiceDate,
          nextServiceKm,
          maintenanceState: newState,
          ...(parsed.markUnderMaintenance ? { status: "MAINTENANCE" as const } : {}),
        },
      });

      return record;
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "VehicleMaintenance",
      entityId: created.id,
      newValues: { ...parsed, totalCost },
    });

    revalidatePath("/maintenance");
    revalidatePath("/fuel");
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function getMaintenanceAttachmentUrlAction(attachmentId: string): Promise<ActionResult<{ url: string }>> {
  try {
    const user = await requirePermission("MAINTENANCE_VIEW");
    const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
    if (!attachment || attachment.entityType !== "VehicleMaintenance" || attachment.isDeleted) {
      throw new Error("Attachment not found.");
    }
    const url = await getSignedDownloadUrl(attachment.storageKey);
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

export async function archiveMaintenanceAction(id: string, reason: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("MAINTENANCE_ARCHIVE");
    if (!reason || !reason.trim()) throw new Error("A reason is required to archive a maintenance record.");

    const existing = await prisma.vehicleMaintenance.findUnique({ where: { id } });
    if (!existing) throw new Error("Maintenance record not found.");
    if (existing.isArchived) throw new Error("This maintenance record is already archived.");

    const vehicleSchedule = await prisma.$transaction(async (tx) => {
      await tx.vehicleMaintenance.update({
        where: { id },
        data: {
          isArchived: true,
          archiveReason: reason.trim(),
          archivedById: user.id,
          archivedAt: new Date(),
        },
      });

      // The archived record may be the one that set the vehicle's last/next
      // service values, so rebuild them from the latest remaining record.
      const vehicle = await tx.vehicle.findUnique({ where: { id: existing.vehicleId } });
      if (!vehicle) return null;
      const latest = await tx.vehicleMaintenance.findFirst({
        where: { vehicleId: existing.vehicleId, isArchived: false },
        orderBy: [{ serviceDate: "desc" }, { createdAt: "desc" }],
        select: { serviceDate: true, odometerKm: true },
      });
      const schedule = deriveServiceSchedule(vehicle, latest);
      await tx.vehicle.update({ where: { id: vehicle.id }, data: schedule });
      return {
        old: {
          lastServiceDate: vehicle.lastServiceDate,
          lastServiceKm: vehicle.lastServiceKm,
          nextServiceDate: vehicle.nextServiceDate,
          nextServiceKm: vehicle.nextServiceKm,
          maintenanceState: vehicle.maintenanceState,
        },
        new: schedule,
      };
    });

    await writeAuditLog({
      userId: user.id,
      action: "ARCHIVE",
      entityType: "VehicleMaintenance",
      entityId: id,
      oldValues: existing,
      newValues: { archiveReason: reason.trim() },
    });

    if (vehicleSchedule) {
      await writeAuditLog({
        userId: user.id,
        action: "EDIT",
        entityType: "Vehicle",
        entityId: existing.vehicleId,
        oldValues: vehicleSchedule.old,
        newValues: { ...vehicleSchedule.new, reason: `Maintenance record ${id} archived` },
      });
    }

    revalidatePath("/maintenance");
    revalidatePath("/vehicles");
    revalidatePath(`/vehicles/${existing.vehicleId}`);
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}

/**
 * Sets a manual override so a vehicle otherwise blocked from dispatch by an
 * overdue maintenance state can still be dispatched. Requires a reason and is
 * gated behind the dedicated OVERRIDE_MAINTENANCE_BLOCK permission (separate
 * from ordinary maintenance CRUD).
 */
export async function overrideMaintenanceBlockAction(
  vehicleId: string,
  reason: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("OVERRIDE_MAINTENANCE_BLOCK");
    if (!reason || !reason.trim()) throw new Error("A reason is required to override a maintenance block.");

    const existing = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!existing) throw new Error("Vehicle not found.");

    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { maintenanceOverride: true, maintenanceOverrideReason: reason.trim() },
    });

    await writeAuditLog({
      userId: user.id,
      action: "MAINTENANCE_OVERRIDE",
      entityType: "Vehicle",
      entityId: vehicleId,
      oldValues: { maintenanceOverride: existing.maintenanceOverride },
      newValues: { maintenanceOverride: true, maintenanceOverrideReason: reason.trim() },
    });

    revalidatePath("/maintenance");
    revalidatePath("/vehicles");
    return { ok: true, data: { id: vehicleId } };
  } catch (error) {
    return actionError(error);
  }
}

/** Clears a previously-set manual maintenance override. */
export async function clearMaintenanceOverrideAction(vehicleId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("OVERRIDE_MAINTENANCE_BLOCK");
    const existing = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!existing) throw new Error("Vehicle not found.");

    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { maintenanceOverride: false, maintenanceOverrideReason: null },
    });

    await writeAuditLog({
      userId: user.id,
      action: "MAINTENANCE_OVERRIDE",
      entityType: "Vehicle",
      entityId: vehicleId,
      oldValues: { maintenanceOverride: existing.maintenanceOverride },
      newValues: { maintenanceOverride: false },
    });

    revalidatePath("/maintenance");
    revalidatePath("/vehicles");
    return { ok: true, data: { id: vehicleId } };
  } catch (error) {
    return actionError(error);
  }
}

/**
 * Loads a vehicle and runs the shared pre-dispatch eligibility check. Exposed
 * here so the Vehicle Management module (built separately) can wire a "Check
 * dispatch eligibility" button to it without duplicating the query/service call.
 */
export async function checkVehicleDispatchAction(vehicleId: string): Promise<ActionResult<DispatchCheck>> {
  try {
    await requirePermission("VEHICLE_VIEW");
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new Error("Vehicle not found.");

    const result = checkDispatchEligibility(vehicle);
    return { ok: true, data: result };
  } catch (error) {
    return actionError(error);
  }
}
