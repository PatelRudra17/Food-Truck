import "server-only";
import { prisma } from "@/lib/prisma";
import type { Pagination } from "@/lib/validators/common";
import { paginationMeta } from "@/lib/validators/common";
import type { Prisma, PersonStatus } from "@prisma/client";

export type LabourListFilters = {
  q?: string;
  status?: string;
  workType?: string;
};

export async function listLabour(pagination: Pagination, filters: LabourListFilters) {
  const where: Prisma.LabourWhereInput = {};
  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { labourCode: { contains: filters.q, mode: "insensitive" } },
      { mobile: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  if (filters.status) {
    where.status = filters.status as PersonStatus;
  }
  if (filters.workType) {
    where.workType = filters.workType;
  }

  const [total, labourers] = await Promise.all([
    prisma.labour.count({ where }),
    prisma.labour.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
      include: { shift: { select: { id: true, shiftName: true } } },
    }),
  ]);

  return { rows: labourers, pagination: paginationMeta(total, pagination) };
}

export async function listLabourWorkTypes() {
  const rows = await prisma.labour.findMany({
    where: { workType: { not: null } },
    select: { workType: true },
    distinct: ["workType"],
    orderBy: { workType: "asc" },
  });
  return rows.map((r) => r.workType!).filter(Boolean);
}

export async function getLabourById(id: string) {
  const labour = await prisma.labour.findUnique({
    where: { id },
    include: { shift: { select: { id: true, shiftName: true, date: true } } },
  });
  if (!labour) return null;

  const [attendances, salaries] = await Promise.all([
    prisma.attendance.findMany({
      where: { labourId: id },
      orderBy: { date: "desc" },
      take: 30,
      include: { shift: { select: { shiftName: true } } },
    }),
    prisma.salary.findMany({
      where: { labourId: id },
      orderBy: { periodStart: "desc" },
      take: 20,
    }),
  ]);

  return { ...labour, attendances, salaries };
}
