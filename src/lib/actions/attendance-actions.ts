"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { markAttendanceSchema } from "@/lib/validators/attendance";
import type { Prisma } from "@prisma/client";

/**
 * Upserts a single Attendance row (one person, one date). Gated behind
 * ATTENDANCE_CREATE for both the initial mark and any same-day correction,
 * since it is one action driving a quick per-row picker on the attendance
 * grid rather than a separate create/edit flow.
 */
export async function markAttendanceAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("ATTENDANCE_CREATE");
    const data = markAttendanceSchema.parse(input);

    const date = new Date(data.date);
    const isEmployee = Boolean(data.employeeId);

    if (isEmployee) {
      const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } });
      if (!employee) return { ok: false, error: "Employee not found." };
    } else {
      const labour = await prisma.labour.findUnique({ where: { id: data.labourId } });
      if (!labour) return { ok: false, error: "Labour record not found." };
    }

    const where: Prisma.AttendanceWhereUniqueInput = isEmployee
      ? { date_employeeId: { date, employeeId: data.employeeId! } }
      : { date_labourId: { date, labourId: data.labourId! } };

    const existing = await prisma.attendance.findUnique({ where });

    const record = await prisma.attendance.upsert({
      where,
      create: {
        date,
        employeeId: data.employeeId ?? null,
        labourId: data.labourId ?? null,
        shiftId: data.shiftId ?? null,
        status: data.status,
        overtimeHours: data.overtimeHours,
        remarks: data.remarks ?? null,
      },
      update: {
        shiftId: data.shiftId ?? null,
        status: data.status,
        overtimeHours: data.overtimeHours,
        remarks: data.remarks ?? null,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: existing ? "EDIT" : "CREATE",
      entityType: "Attendance",
      entityId: record.id,
      oldValues: existing
        ? { status: existing.status, overtimeHours: existing.overtimeHours ? Number(existing.overtimeHours) : null }
        : undefined,
      newValues: { date: data.date, status: data.status, overtimeHours: data.overtimeHours },
    });

    revalidatePath("/attendance");
    if (data.employeeId) revalidatePath(`/employees/${data.employeeId}`);
    if (data.labourId) revalidatePath(`/labour/${data.labourId}`);

    return { ok: true, data: { id: record.id } };
  } catch (error) {
    return actionError(error);
  }
}
