"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { shiftSchema, assignSupervisorSchema } from "@/lib/validators/shift";

const SHIFT_LIST_PATH = "/operations/shifts";
const DAY_MS = 24 * 60 * 60 * 1000;

function combineDateAndTime(dateStr: string, timeStr: string): Date {
  const combined = new Date(`${dateStr}T${timeStr}`);
  if (Number.isNaN(combined.getTime())) throw new Error("Invalid date/time.");
  return combined;
}

export async function createShiftAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("OPERATIONS_CREATE");
    const data = shiftSchema.parse(input);

    const date = new Date(`${data.date}T00:00:00`);
    if (Number.isNaN(date.getTime())) throw new Error("Invalid date.");

    const startTime = combineDateAndTime(data.date, data.startTime);
    let endTime = combineDateAndTime(data.date, data.endTime);
    // Overnight shift (e.g. 22:00 -> 06:00): roll the end time to the next day.
    if (endTime <= startTime) endTime = new Date(endTime.getTime() + DAY_MS);

    if (data.supervisorId) {
      const supervisor = await prisma.user.findUnique({ where: { id: data.supervisorId } });
      if (!supervisor) throw new Error("Selected supervisor not found.");
    }

    const created = await prisma.shift.create({
      data: {
        shiftName: data.shiftName.trim(),
        date,
        startTime,
        endTime,
        supervisorId: data.supervisorId || null,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "Shift",
      entityId: created.id,
      newValues: data,
    });

    revalidatePath(SHIFT_LIST_PATH);
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function assignShiftSupervisorAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("OPERATIONS_EDIT");
    const data = assignSupervisorSchema.parse(input);

    const existing = await prisma.shift.findUnique({ where: { id: data.shiftId } });
    if (!existing) throw new Error("Shift not found.");

    if (data.supervisorId) {
      const supervisor = await prisma.user.findUnique({ where: { id: data.supervisorId } });
      if (!supervisor) throw new Error("Selected supervisor not found.");
    }

    const updated = await prisma.shift.update({
      where: { id: data.shiftId },
      data: { supervisorId: data.supervisorId || null },
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Shift",
      entityId: data.shiftId,
      oldValues: { supervisorId: existing.supervisorId },
      newValues: { supervisorId: updated.supervisorId },
    });

    revalidatePath(SHIFT_LIST_PATH);
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function closeShiftAction(shiftId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("OPERATIONS_EDIT");
    const existing = await prisma.shift.findUnique({ where: { id: shiftId } });
    if (!existing) throw new Error("Shift not found.");
    if (existing.status === "CLOSED") throw new Error("This shift is already closed.");

    await prisma.shift.update({ where: { id: shiftId }, data: { status: "CLOSED" } });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Shift",
      entityId: shiftId,
      oldValues: { status: existing.status },
      newValues: { status: "CLOSED" },
    });

    revalidatePath(SHIFT_LIST_PATH);
    return { ok: true, data: { id: shiftId } };
  } catch (error) {
    return actionError(error);
  }
}

export async function reopenShiftAction(shiftId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("OPERATIONS_EDIT");
    const existing = await prisma.shift.findUnique({ where: { id: shiftId } });
    if (!existing) throw new Error("Shift not found.");
    if (existing.status === "ACTIVE") throw new Error("This shift is already active.");

    await prisma.shift.update({ where: { id: shiftId }, data: { status: "ACTIVE" } });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Shift",
      entityId: shiftId,
      oldValues: { status: existing.status },
      newValues: { status: "ACTIVE" },
    });

    revalidatePath(SHIFT_LIST_PATH);
    return { ok: true, data: { id: shiftId } };
  } catch (error) {
    return actionError(error);
  }
}
