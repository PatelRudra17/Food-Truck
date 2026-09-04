import "server-only";
import { prisma } from "@/lib/prisma";
import type { Pagination } from "@/lib/validators/common";
import { paginationMeta } from "@/lib/validators/common";
import type { Prisma, PaymentStatus } from "@prisma/client";

export type PayrollListFilters = {
  q?: string;
  personType?: string; // "EMPLOYEE" | "LABOUR"
  paymentStatus?: string;
};

export async function listPayroll(pagination: Pagination, filters: PayrollListFilters) {
  const where: Prisma.SalaryWhereInput = {};
  if (filters.paymentStatus) {
    where.paymentStatus = filters.paymentStatus as PaymentStatus;
  }
  if (filters.personType === "EMPLOYEE") {
    where.employeeId = { not: null };
  } else if (filters.personType === "LABOUR") {
    where.labourId = { not: null };
  }
  if (filters.q) {
    where.OR = [
      { employee: { name: { contains: filters.q, mode: "insensitive" } } },
      { labour: { name: { contains: filters.q, mode: "insensitive" } } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.salary.count({ where }),
    prisma.salary.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
      include: {
        employee: { select: { id: true, name: true, employeeCode: true } },
        labour: { select: { id: true, name: true, labourCode: true } },
      },
    }),
  ]);

  return { rows, pagination: paginationMeta(total, pagination) };
}

export async function getSalaryById(id: string) {
  return prisma.salary.findUnique({
    where: { id },
    include: {
      employee: { select: { id: true, name: true, employeeCode: true, department: true } },
      labour: { select: { id: true, name: true, labourCode: true, workType: true, dailyWage: true } },
    },
  });
}

/**
 * Suggested (not enforced) earnings for a Labour pay period:
 * dailyWage x presentDays, where PRESENT counts as 1 day and HALF_DAY as 0.5.
 * The caller (Run Payroll form) shows this as an editable starting default.
 */
export async function computeSuggestedLabourEarnings(labourId: string, periodStart: Date, periodEnd: Date) {
  const labour = await prisma.labour.findUnique({ where: { id: labourId } });
  if (!labour) return null;

  const attendances = await prisma.attendance.findMany({
    where: { labourId, date: { gte: periodStart, lte: periodEnd } },
    select: { status: true },
  });

  const presentDays = attendances.reduce((sum, a) => {
    if (a.status === "PRESENT") return sum + 1;
    if (a.status === "HALF_DAY") return sum + 0.5;
    return sum;
  }, 0);

  const dailyWage = Number(labour.dailyWage);
  return { presentDays, dailyWage, earnings: presentDays * dailyWage };
}
