"use server";

import type { CleaningStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { cleaningSchema, updateCleaningSchema } from "@/lib/validators/cleaning";

const CLEANING_LIST_PATH = "/operations/cleaning";

export async function createCleaningAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("OPERATIONS_CREATE");
    const data = cleaningSchema.parse(input);

    if (data.entityType === "VEHICLE") {
      const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } });
      if (!vehicle) throw new Error("Selected vehicle not found.");
    }
    if (data.entityType === "CRATE") {
      const crate = await prisma.crate.findUnique({ where: { id: data.crateId } });
      if (!crate) throw new Error("Selected crate not found.");
    }

    const created = await prisma.cleaning.create({
      data: {
        entityType: data.entityType,
        vehicleId: data.entityType === "VEHICLE" ? data.vehicleId : null,
        crateId: data.entityType === "CRATE" ? data.crateId : null,
        locationText: data.entityType === "LOCATION" ? data.locationText.trim() : null,
        cleaningType: data.cleaningType.trim() || null,
        startTime: data.startTime ? new Date(data.startTime) : null,
        endTime: data.endTime ? new Date(data.endTime) : null,
        staffId: data.staffId || null,
        remarks: data.remarks.trim() || null,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "Cleaning",
      entityId: created.id,
      newValues: data,
    });

    revalidatePath(CLEANING_LIST_PATH);
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateCleaningAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("OPERATIONS_EDIT");
    const data = updateCleaningSchema.parse(input);

    const existing = await prisma.cleaning.findUnique({ where: { id: data.id } });
    if (!existing) throw new Error("Cleaning record not found.");

    const updated = await prisma.cleaning.update({
      where: { id: data.id },
      data: {
        cleaningType: data.cleaningType.trim() || null,
        staffId: data.staffId || null,
        remarks: data.remarks.trim() || null,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Cleaning",
      entityId: data.id,
      oldValues: { cleaningType: existing.cleaningType, staffId: existing.staffId, remarks: existing.remarks },
      newValues: { cleaningType: updated.cleaningType, staffId: updated.staffId, remarks: updated.remarks },
    });

    revalidatePath(CLEANING_LIST_PATH);
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}

const NEXT_CLEANING_STATUS: Record<CleaningStatus, CleaningStatus | null> = {
  PENDING: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED",
  COMPLETED: null,
};

/** Advances a cleaning record one step forward: PENDING -> IN_PROGRESS -> COMPLETED. */
export async function advanceCleaningStatusAction(
  id: string,
  remarks?: string,
): Promise<ActionResult<{ id: string; status: CleaningStatus }>> {
  try {
    const user = await requirePermission("OPERATIONS_EDIT");
    const existing = await prisma.cleaning.findUnique({ where: { id } });
    if (!existing) throw new Error("Cleaning record not found.");

    const next = NEXT_CLEANING_STATUS[existing.status];
    if (!next) throw new Error("This cleaning record is already completed.");

    const now = new Date();
    const updated = await prisma.cleaning.update({
      where: { id },
      data: {
        status: next,
        startTime: next === "IN_PROGRESS" && !existing.startTime ? now : existing.startTime,
        endTime: next === "COMPLETED" && !existing.endTime ? now : existing.endTime,
        remarks: remarks?.trim() ? remarks.trim() : existing.remarks,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Cleaning",
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status: updated.status },
    });

    revalidatePath(CLEANING_LIST_PATH);
    return { ok: true, data: { id: updated.id, status: updated.status } };
  } catch (error) {
    return actionError(error);
  }
}
