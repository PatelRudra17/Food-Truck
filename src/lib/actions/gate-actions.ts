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
      const vehicle = await tx.vehicle.findUnique({ where: { id: data.vehicleId } });
      if (!vehicle) throw new Error("Selected vehicle was not found.");

      const driver = await tx.driver.findUnique({ where: { id: data.driverId } });
      if (!driver) throw new Error("Selected driver was not found.");

      const openEntry = await tx.vehicleGateEntry.findFirst({
        where: { vehicleId: data.vehicleId, status: "INSIDE" },
      });
      if (openEntry) {
        throw new Error("Vehicle already recorded as inside.");
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

      await tx.vehicle.update({
        where: { id: data.vehicleId },
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
        include: { exit: true },
      });
      if (!entry) throw new Error("Gate entry was not found.");
      if (entry.status !== "INSIDE" || entry.exit) {
        throw new Error("This vehicle has already been recorded as out.");
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

      await tx.vehicle.update({
        where: { id: entry.vehicleId },
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
