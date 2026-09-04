"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { fuelEntrySchema } from "@/lib/validators/fuel";
import { computeFuelDerivedFields } from "@/lib/services/fuel";
import { notifyRoleByName } from "@/lib/services/notifications";
import { validateUpload, uploadObject, getSignedDownloadUrl } from "@/lib/storage";
import { recomputeVehicleMaintenanceState } from "@/lib/actions/maintenance-actions";

export async function createFuelEntryAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("FUEL_CREATE");

    const raw = Object.fromEntries(formData.entries());
    const parsed = fuelEntrySchema.parse(raw);

    const vehicle = await prisma.vehicle.findUnique({ where: { id: parsed.vehicleId } });
    if (!vehicle) throw new Error("Vehicle not found.");

    if (parsed.driverId) {
      const driver = await prisma.driver.findUnique({ where: { id: parsed.driverId } });
      if (!driver) throw new Error("Selected driver was not found.");
    }

    const dateTime = new Date(`${parsed.date}T${parsed.time || "00:00"}`);
    if (Number.isNaN(dateTime.getTime())) throw new Error("Invalid date/time.");

    // Pure calculation lives in src/lib/services/fuel.ts — never reimplement it here.
    const derived = computeFuelDerivedFields({
      previousOdometerKm: parsed.previousOdometerKm,
      currentOdometerKm: parsed.currentOdometerKm,
      fuelQuantityLiters: parsed.fuelQuantityLiters,
      fuelRate: parsed.fuelRate,
      baselineMileageKmpl: vehicle.fuelEfficiencyTargetKmpl,
    });

    const file = formData.get("receipt");
    let uploaded: { storageKey: string; fileName: string; mimeType: string; sizeBytes: number } | null = null;
    if (file instanceof File && file.size > 0) {
      validateUpload({ type: file.type, size: file.size });
      const buffer = Buffer.from(await file.arrayBuffer());
      const { storageKey } = await uploadObject({
        buffer,
        mimeType: file.type,
        entityType: "FuelEntry",
        originalFileName: file.name,
      });
      uploaded = { storageKey, fileName: file.name, mimeType: file.type, sizeBytes: file.size };
    }

    const createdId = await prisma.$transaction(async (tx) => {
      const entry = await tx.fuelEntry.create({
        data: {
          vehicleId: parsed.vehicleId,
          date: dateTime,
          driverId: parsed.driverId || null,
          tripId: parsed.tripId || null,
          fuelStationVendor: parsed.fuelStationVendor,
          fuelType: parsed.fuelType,
          previousOdometerKm: parsed.previousOdometerKm,
          currentOdometerKm: parsed.currentOdometerKm,
          distanceKm: derived.distanceKm,
          fuelQuantityLiters: parsed.fuelQuantityLiters,
          fuelRate: parsed.fuelRate,
          totalFuelCost: derived.totalFuelCost,
          mileageKmpl: derived.mileageKmpl,
          fuelCostPerKm: derived.fuelCostPerKm,
          isAnomaly: derived.isAnomaly,
          anomalyNote: derived.anomalyNote,
          remarks: parsed.remarks || null,
          enteredById: user.id,
        },
      });

      if (uploaded) {
        await tx.attachment.create({
          data: {
            fileName: uploaded.fileName,
            storageKey: uploaded.storageKey,
            mimeType: uploaded.mimeType,
            sizeBytes: uploaded.sizeBytes,
            entityType: "FuelEntry",
            entityId: entry.id,
            documentType: "FUEL_RECEIPT",
            uploadedById: user.id,
            fuelEntryFk: entry.id,
          },
        });
      }

      if (new Prisma.Decimal(parsed.currentOdometerKm).gt(vehicle.odometerKm)) {
        await tx.vehicle.update({
          where: { id: vehicle.id },
          data: { odometerKm: parsed.currentOdometerKm },
        });
      }

      return entry.id;
    });

    // The vehicle's odometer may have just advanced — keep its maintenanceState fresh.
    await recomputeVehicleMaintenanceState(vehicle.id);

    if (derived.isAnomaly) {
      await notifyRoleByName("Vehicle Manager", {
        type: "FUEL_ANOMALY",
        title: "Unusual fuel consumption detected",
        message: derived.anomalyNote ?? "Unusual fuel consumption detected.",
        entityType: "FuelEntry",
        entityId: createdId,
      });
    }

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "FuelEntry",
      entityId: createdId,
      newValues: { ...parsed, isAnomaly: derived.isAnomaly },
    });

    revalidatePath("/fuel");
    revalidatePath("/maintenance");
    return { ok: true, data: { id: createdId } };
  } catch (error) {
    return actionError(error);
  }
}

export async function getFuelAttachmentUrlAction(attachmentId: string): Promise<ActionResult<{ url: string }>> {
  try {
    const user = await requirePermission("FUEL_VIEW");
    const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
    if (!attachment || attachment.entityType !== "FuelEntry" || attachment.isDeleted) {
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

export async function voidFuelEntryAction(id: string, reason: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("FUEL_ARCHIVE");
    if (!reason || !reason.trim()) throw new Error("A reason is required to void a fuel entry.");

    const existing = await prisma.fuelEntry.findUnique({ where: { id } });
    if (!existing) throw new Error("Fuel entry not found.");
    if (existing.isVoided) throw new Error("This fuel entry is already voided.");

    await prisma.fuelEntry.update({
      where: { id },
      data: {
        isVoided: true,
        voidReason: reason.trim(),
        voidedById: user.id,
        voidedAt: new Date(),
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "VOID",
      entityType: "FuelEntry",
      entityId: id,
      oldValues: existing,
      newValues: { voidReason: reason.trim() },
    });

    revalidatePath("/fuel");
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}
