"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { employeeSchema } from "@/lib/validators/employee";

function toDateOrNull(value: string | undefined): Date | null {
  return value ? new Date(value) : null;
}

/** Master-data code — sequential, not via the transactional nextDocumentNumber sequence. */
async function nextEmployeeCode(): Promise<string> {
  const count = await prisma.employee.count();
  return `EMP-${String(count + 1).padStart(3, "0")}`;
}

export async function createEmployeeAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("EMPLOYEE_CREATE");
    const data = employeeSchema.parse(input);

    if (data.shiftId) {
      const shift = await prisma.shift.findUnique({ where: { id: data.shiftId } });
      if (!shift) return { ok: false, error: "Selected shift not found." };
    }

    const employeeCode = await nextEmployeeCode();

    const created = await prisma.employee.create({
      data: {
        employeeCode,
        name: data.name,
        mobile: data.mobile,
        department: data.department ?? null,
        roleTitle: data.roleTitle ?? null,
        joiningDate: toDateOrNull(data.joiningDate),
        shiftId: data.shiftId ?? null,
        status: data.status,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "Employee",
      entityId: created.id,
      newValues: data,
    });

    revalidatePath("/employees");
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateEmployeeAction(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("EMPLOYEE_EDIT");
    const data = employeeSchema.parse(input);

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Employee not found." };

    if (data.shiftId) {
      const shift = await prisma.shift.findUnique({ where: { id: data.shiftId } });
      if (!shift) return { ok: false, error: "Selected shift not found." };
    }

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        name: data.name,
        mobile: data.mobile,
        department: data.department ?? null,
        roleTitle: data.roleTitle ?? null,
        joiningDate: toDateOrNull(data.joiningDate),
        shiftId: data.shiftId ?? null,
        status: data.status,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Employee",
      entityId: updated.id,
      oldValues: {
        name: existing.name,
        mobile: existing.mobile,
        department: existing.department,
        roleTitle: existing.roleTitle,
        status: existing.status,
      },
      newValues: data,
    });

    revalidatePath("/employees");
    revalidatePath(`/employees/${id}`);
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function archiveEmployeeAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("EMPLOYEE_ARCHIVE");
    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Employee not found." };

    await prisma.employee.update({ where: { id }, data: { status: "INACTIVE" } });

    await writeAuditLog({
      userId: user.id,
      action: "ARCHIVE",
      entityType: "Employee",
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status: "INACTIVE" },
    });

    revalidatePath("/employees");
    revalidatePath(`/employees/${id}`);
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}
