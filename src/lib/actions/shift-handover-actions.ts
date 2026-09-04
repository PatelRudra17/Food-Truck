"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { notifyUser } from "@/lib/services/notifications";
import { getVehiclesInsideCount } from "@/lib/services/gate";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { shiftHandoverSchema } from "@/lib/validators/shift-handover";

const HANDOVER_PATH = "/operations/shifts/handover";

export async function createHandoverAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("OPERATIONS_CREATE");
    const data = shiftHandoverSchema.parse(input);

    const shift = await prisma.shift.findUnique({ where: { id: data.shiftId } });
    if (!shift) throw new Error("Shift not found.");

    if (data.previousSupervisorId) {
      const exists = await prisma.user.findUnique({ where: { id: data.previousSupervisorId } });
      if (!exists) throw new Error("Selected previous supervisor not found.");
    }
    if (data.newSupervisorId) {
      const exists = await prisma.user.findUnique({ where: { id: data.newSupervisorId } });
      if (!exists) throw new Error("Selected new supervisor not found.");
    }

    const created = await prisma.$transaction(async (tx) => {
      const handover = await tx.shiftHandover.create({
        data: {
          shiftId: data.shiftId,
          previousSupervisorId: data.previousSupervisorId || null,
          newSupervisorId: data.newSupervisorId || null,
          stockIssuesNote: data.stockIssuesNote.trim() || null,
          cleaningStatusNote: data.cleaningStatusNote.trim() || null,
          crateStatusNote: data.crateStatusNote.trim() || null,
          remarks: data.remarks.trim() || null,
        },
      });

      if (data.newSupervisorId) {
        await notifyUser(tx, {
          userId: data.newSupervisorId,
          type: "SYSTEM_ALERT",
          title: `Shift handover: ${shift.shiftName}`,
          message: `You have been handed over supervision of the "${shift.shiftName}" shift.`,
          entityType: "ShiftHandover",
          entityId: handover.id,
        });
      }

      return handover;
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "ShiftHandover",
      entityId: created.id,
      newValues: data,
    });

    revalidatePath(HANDOVER_PATH);
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return actionError(error);
  }
}

export type OperationsSnapshot = {
  pendingProcurementCount: number;
  pendingSortingCount: number;
  pendingDispatchCount: number;
  vehiclesInsideCount: number;
  vehiclesOutsideCount: number;
  activeShiftCount: number;
  cratesAvailableCount: number;
  cratesNeedingCleaningCount: number;
  pendingCleaningCount: number;
};

/**
 * Assembles the handover dashboard summary entirely from live queries — per
 * the ShiftHandover model's design, none of these counts are ever stored.
 */
export async function getOperationsSnapshot(): Promise<OperationsSnapshot> {
  await requirePermission("OPERATIONS_VIEW");

  const [
    pendingProcurementCount,
    pendingSortingCount,
    pendingDispatchCount,
    vehiclesInsideCount,
    totalVehicleCount,
    activeShiftCount,
    cratesAvailableCount,
    cratesNeedingCleaningCount,
    pendingCleaningCount,
  ] = await Promise.all([
    prisma.procurement.count({ where: { status: "DRAFT" } }),
    prisma.procurementBatch.count({ where: { status: "PENDING_SORTING" } }),
    prisma.trip.count({ where: { status: { in: ["CREATED", "APPROVED", "LOADING", "LOADED"] } } }),
    getVehiclesInsideCount(),
    prisma.vehicle.count(),
    prisma.shift.count({ where: { status: "ACTIVE" } }),
    prisma.crate.count({ where: { status: "AVAILABLE" } }),
    prisma.crate.count({ where: { status: "CLEANING" } }),
    prisma.cleaning.count({ where: { status: { in: ["PENDING", "IN_PROGRESS"] } } }),
  ]);

  return {
    pendingProcurementCount,
    pendingSortingCount,
    pendingDispatchCount,
    vehiclesInsideCount,
    vehiclesOutsideCount: Math.max(0, totalVehicleCount - vehiclesInsideCount),
    activeShiftCount,
    cratesAvailableCount,
    cratesNeedingCleaningCount,
    pendingCleaningCount,
  };
}
