"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError, isOneOf } from "@/lib/validators/common";
import { fuelEntrySchema, FUEL_LINKABLE_TRIP_STATUSES } from "@/lib/validators/fuel";
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

    // tripId must reference a real trip run by this vehicle (stores Trip.id).
    if (parsed.tripId) {
      const trip = await prisma.trip.findUnique({
        where: { id: parsed.tripId },
        select: { vehicleId: true, status: true },
      });
      if (!trip) throw new Error("Selected trip was not found.");
      if (trip.vehicleId !== vehicle.id) throw new Error("Selected trip does not belong to this vehicle.");
      if (!isOneOf(trip.status, FUEL_LINKABLE_TRIP_STATUSES)) {
        throw new Error("Only dispatched, delivered, or returned trips can be linked to a fuel entry.");
      }
    }

    const dateTime = new Date(`${parsed.date}T${parsed.time || "00:00"}`);
    if (Number.isNaN(dateTime.getTime())) throw new Error("Invalid date/time.");
    if (dateTime.getTime() > Date.now()) throw new Error("Fuel entry date/time cannot be in the future.");

    // Readings must continue from the vehicle's recorded odometer. The very
    // first fill-up for a vehicle is exempt since there's nothing to continue from.
    const hasPriorEntries = await prisma.fuelEntry.count({
      where: { vehicleId: vehicle.id, isVoided: false },
    });
    if (hasPriorEntries > 0 && new Prisma.Decimal(parsed.previousOdometerKm).lt(vehicle.odometerKm)) {
      throw new Error(
        `Previous odometer reading cannot be lower than the vehicle's recorded odometer (${vehicle.odometerKm.toString()} km).`,
      );
    }

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

    await prisma.$transaction(async (tx) => {
      await tx.fuelEntry.update({
        where: { id },
        data: {
          isVoided: true,
          voidReason: reason.trim(),
          voidedById: user.id,
          voidedAt: new Date(),
        },
      });

      // If this entry is what advanced the vehicle's odometer, roll it back to
      // the latest remaining reading (or this entry's own starting reading).
      const vehicle = await tx.vehicle.findUnique({ where: { id: existing.vehicleId } });
      if (vehicle && vehicle.odometerKm.eq(existing.currentOdometerKm)) {
        const latest = await tx.fuelEntry.aggregate({
          where: { vehicleId: existing.vehicleId, isVoided: false },
          _max: { currentOdometerKm: true },
        });
        const restored = latest._max.currentOdometerKm ?? existing.previousOdometerKm;
        if (!restored.eq(vehicle.odometerKm)) {
          await tx.vehicle.update({ where: { id: vehicle.id }, data: { odometerKm: restored } });
        }
      }
    });

    await recomputeVehicleMaintenanceState(existing.vehicleId);

    await writeAuditLog({
      userId: user.id,
      action: "VOID",
      entityType: "FuelEntry",
      entityId: id,
      oldValues: existing,
      newValues: { voidReason: reason.trim() },
    });

    revalidatePath("/fuel");
    revalidatePath("/maintenance");
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}
