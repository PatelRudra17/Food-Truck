import "server-only";
import { prisma } from "@/lib/prisma";
import type { Pagination } from "@/lib/validators/common";
import { paginationMeta } from "@/lib/validators/common";
import { PersonStatus, type Prisma } from "@prisma/client";

export type EmployeeListFilters = {
  q?: string;
  status?: string;
  department?: string;
};

export async function listEmployees(pagination: Pagination, filters: EmployeeListFilters) {
  const where: Prisma.EmployeeWhereInput = {};
  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { employeeCode: { contains: filters.q, mode: "insensitive" } },
      { mobile: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  if (filters.status && (Object.values(PersonStatus) as string[]).includes(filters.status)) {
    where.status = filters.status as PersonStatus;
  }
  if (filters.department) {
    where.department = filters.department;
  }

  const [total, employees] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
      include: { shift: { select: { id: true, shiftName: true } } },
    }),
  ]);

  return { rows: employees, pagination: paginationMeta(total, pagination) };
}

export async function listEmployeeDepartments() {
  const rows = await prisma.employee.findMany({
    where: { department: { not: null } },
    select: { department: true },
    distinct: ["department"],
    orderBy: { department: "asc" },
  });
  return rows.map((r) => r.department!).filter(Boolean);
}

export async function getEmployeeById(id: string) {
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: { shift: { select: { id: true, shiftName: true, date: true } } },
  });
  if (!employee) return null;

  const salaries = await prisma.salary.findMany({
    where: { employeeId: id },
    orderBy: { periodStart: "desc" },
    take: 20,
  });

  return { ...employee, salaries };
}
