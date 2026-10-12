"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { nextDocumentNumber } from "@/lib/numbering";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import {
  recordVehicleInSchema,
  recordVehicleOutSchema,
} from "@/lib/validators/gate";

export async function recordVehicleInAction(
  input: unknown,
): Promise<ActionResult<{ id: string; gateEntryNumber: string }>> {
  try {
    const user = await requirePermission("GATE_ENTRY_CREATE");
    const data = recordVehicleInSchema.parse(input);

    const created = await prisma.$transaction(async (tx) => {
      // Lock the vehicle (then driver) row so two simultaneous "Record In"
      // requests serialize here: the second one waits, then sees the first's
      // INSIDE entry below instead of creating a duplicate. Always vehicle
      // before driver so concurrent requests can't deadlock.
      await tx.$queryRaw`SELECT id FROM "Vehicle" WHERE id = ${data.vehicleId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Driver" WHERE id = ${data.driverId} FOR UPDATE`;

      const vehicle = await tx.vehicle.findUnique({ where: { id: data.vehicleId } });
      if (!vehicle) throw new Error("Selected vehicle was not found.");
      if (vehicle.status === "INACTIVE") {
        throw new Error("This vehicle is inactive and cannot be recorded in.");
      }
      if (vehicle.status === "INSIDE") {
        throw new Error("Vehicle already recorded as inside.");
      }

      const driver = await tx.driver.findUnique({ where: { id: data.driverId } });
      if (!driver) throw new Error("Selected driver was not found.");

      const openEntry = await tx.vehicleGateEntry.findFirst({
        where: { vehicleId: data.vehicleId, status: "INSIDE" },
      });
      if (openEntry) {
        throw new Error("Vehicle already recorded as inside.");
      }

      const driverInside = await tx.vehicleGateEntry.findFirst({
        where: { driverId: data.driverId, status: "INSIDE" },
        include: { vehicle: { select: { vehicleNumber: true } } },
      });
      if (driverInside) {
        throw new Error(`This driver is already recorded inside with vehicle ${driverInside.vehicle.vehicleNumber}.`);
      }

      if (data.supplierId) {
        const supplier = await tx.supplier.findUnique({ where: { id: data.supplierId } });
        if (!supplier) throw new Error("Selected supplier was not found.");
      }

      const gateEntryNumber = await nextDocumentNumber(tx, "GATE_ENTRY");

      const entry = await tx.vehicleGateEntry.create({
        data: {
          gateEntryNumber,
          vehicleId: data.vehicleId,
          driverId: data.driverId,
          supplierId: data.supplierId ?? undefined,
          purpose: data.purpose ?? undefined,
          material: data.material ?? undefined,
          securityStaffId: user.id,
          remarks: data.remarks ?? undefined,
          timeIn: new Date(),
          status: "INSIDE",
        },
      });

      // A vehicle under maintenance can come through the gate (e.g. to the workshop) but
      // stays MAINTENANCE; the gate entry itself records that it is inside.
      await tx.vehicle.updateMany({
        where: { id: data.vehicleId, status: { not: "MAINTENANCE" } },
        data: { status: "INSIDE" },
      });

      return entry;
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "VehicleGateEntry",
      entityId: created.id,
      newValues: { ...data, gateEntryNumber: created.gateEntryNumber },
    });

    revalidatePath("/gate");
    return { ok: true, data: { id: created.id, gateEntryNumber: created.gateEntryNumber } };
  } catch (error) {
    return actionError(error);
  }
}

export async function recordVehicleOutAction(
  input: unknown,
): Promise<ActionResult<{ id: string; gateExitNumber: string }>> {
  try {
    const user = await requirePermission("GATE_ENTRY_CREATE");
    const data = recordVehicleOutSchema.parse(input);

    const created = await prisma.$transaction(async (tx) => {
      const entry = await tx.vehicleGateEntry.findUnique({
        where: { id: data.gateEntryId },
        include: {
          exit: true,
          unloading: { select: { unloadingEndAt: true } },
          procurements: { where: { status: "DRAFT" }, select: { procurementNumber: true } },
          _count: { select: { procurementBatches: { where: { status: "PENDING_UNLOADING" } } } },
        },
      });
      if (!entry) throw new Error("Gate entry was not found.");
      if (entry.status !== "INSIDE" || entry.exit) {
        throw new Error("This vehicle has already been recorded as out.");
      }
      // Batches only move on when this truck is unloaded, so it can't leave mid-procurement.
      if (entry.procurements.length > 0) {
        throw new Error(
          `Submit or cancel ${entry.procurements.map((p) => p.procurementNumber).join(", ")} before this vehicle leaves.`,
        );
      }
      if (entry.unloading && !entry.unloading.unloadingEndAt) {
        throw new Error("Unloading is still in progress for this vehicle.");
      }
      if (entry._count.procurementBatches > 0) {
        throw new Error("This vehicle still has produce waiting to be unloaded.");
      }

      const timeOut = new Date();
      const totalTimeInsideMinutes = Math.max(
        0,
        Math.round((timeOut.getTime() - entry.timeIn.getTime()) / 60000),
      );

      const gateExitNumber = await nextDocumentNumber(tx, "GATE_EXIT");

      const exit = await tx.vehicleGateExit.create({
        data: {
          gateExitNumber,
          gateEntryId: entry.id,
          vehicleId: entry.vehicleId,
          driverId: entry.driverId,
          timeOut,
          destination: data.destination ?? undefined,
          material: data.material ?? undefined,
          receiver: data.receiver ?? undefined,
          remarks: data.remarks ?? undefined,
          totalTimeInsideMinutes,
        },
      });

      await tx.vehicleGateEntry.update({
        where: { id: entry.id },
        data: { status: "OUT" },
      });

      // Only undo the INSIDE status set at record-in; a vehicle moved to
      // MAINTENANCE (or anything else) while inside keeps that status.
      await tx.vehicle.updateMany({
        where: { id: entry.vehicleId, status: "INSIDE" },
        data: { status: "AVAILABLE" },
      });

      return exit;
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "VehicleGateExit",
      entityId: created.id,
      newValues: { ...data, gateExitNumber: created.gateExitNumber },
    });

    revalidatePath("/gate");
    return { ok: true, data: { id: created.id, gateExitNumber: created.gateExitNumber } };
  } catch (error) {
    return actionError(error);
  }
}
