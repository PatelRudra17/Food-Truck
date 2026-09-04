"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { payrollSchema } from "@/lib/validators/payroll";
import { computeSuggestedLabourEarnings } from "@/lib/services/payroll";

export async function getSuggestedLabourEarningsAction(
  labourId: string,
  periodStart: string,
  periodEnd: string,
): Promise<ActionResult<{ presentDays: number; dailyWage: number; earnings: number }>> {
  try {
    await requirePermission("PAYROLL_CREATE");
    if (!labourId || !periodStart || !periodEnd) {
      return { ok: false, error: "Labour and both period dates are required." };
    }
    const result = await computeSuggestedLabourEarnings(labourId, new Date(periodStart), new Date(periodEnd));
    if (!result) return { ok: false, error: "Labour record not found." };
    return { ok: true, data: result };
  } catch (error) {
    return actionError(error);
  }
}

export async function createPayrollAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("PAYROLL_CREATE");
    const data = payrollSchema.parse(input);

    const periodStart = new Date(data.periodStart);
    const periodEnd = new Date(data.periodEnd);

    if (data.personType === "EMPLOYEE") {
      const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } });
      if (!employee) return { ok: false, error: "Employee not found." };
    } else {
      const labour = await prisma.labour.findUnique({ where: { id: data.labourId } });
      if (!labour) return { ok: false, error: "Labour record not found." };
    }

    const netSalary = data.earnings + data.overtimeAmount - data.advances - data.deductions;

    const created = await prisma.salary.create({
      data: {
        employeeId: data.personType === "EMPLOYEE" ? data.employeeId : null,
        labourId: data.personType === "LABOUR" ? data.labourId : null,
        periodStart,
        periodEnd,
        earnings: data.earnings,
        overtimeAmount: data.overtimeAmount,
        advances: data.advances,
        deductions: data.deductions,
        netSalary,
        paymentStatus: "PENDING",
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "Salary",
      entityId: created.id,
      newValues: { ...data, netSalary },
    });

    revalidatePath("/payroll");
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function updatePayrollAction(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("PAYROLL_EDIT");
    const data = payrollSchema.parse(input);

    const existing = await prisma.salary.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Salary record not found." };
    if (existing.paymentStatus === "PAID") {
      return { ok: false, error: "A paid salary record cannot be edited." };
    }

    const periodStart = new Date(data.periodStart);
    const periodEnd = new Date(data.periodEnd);
    const netSalary = data.earnings + data.overtimeAmount - data.advances - data.deductions;

    const updated = await prisma.salary.update({
      where: { id },
      data: {
        periodStart,
        periodEnd,
        earnings: data.earnings,
        overtimeAmount: data.overtimeAmount,
        advances: data.advances,
        deductions: data.deductions,
        netSalary,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Salary",
      entityId: updated.id,
      oldValues: {
        earnings: Number(existing.earnings),
        overtimeAmount: Number(existing.overtimeAmount),
        advances: Number(existing.advances),
        deductions: Number(existing.deductions),
        netSalary: Number(existing.netSalary),
      },
      newValues: { ...data, netSalary },
    });

    revalidatePath("/payroll");
    revalidatePath(`/payroll/${id}`);
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function markPayrollPaidAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("PAYROLL_APPROVE");
    const existing = await prisma.salary.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Salary record not found." };
    if (existing.paymentStatus === "PAID") return { ok: false, error: "Already marked as paid." };

    await prisma.salary.update({
      where: { id },
      data: { paymentStatus: "PAID", paidAt: new Date() },
    });

    await writeAuditLog({
      userId: user.id,
      action: "APPROVE",
      entityType: "Salary",
      entityId: id,
      oldValues: { paymentStatus: existing.paymentStatus },
      newValues: { paymentStatus: "PAID" },
    });

    revalidatePath("/payroll");
    revalidatePath(`/payroll/${id}`);
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}
