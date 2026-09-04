import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma, AttendanceStatus } from "@prisma/client";

export type AttendanceGridRow = {
  personType: "EMPLOYEE" | "LABOUR";
  personId: string;
  code: string;
  name: string;
  group: string | null; // department (Employee) or workType (Labour)
  shiftId: string | null;
  shiftName: string | null;
  attendanceId: string | null;
  status: AttendanceStatus | null;
  overtimeHours: number | null;
  remarks: string | null;
};

export type AttendanceGridFilters = {
  q?: string;
  personType?: string; // "EMPLOYEE" | "LABOUR"
  shiftId?: string;
  group?: string;
  status?: string; // AttendanceStatus | "NOT_MARKED"
};

/**
 * Builds one row per active Employee/Labour for the given date, joined
 * against any existing Attendance row for that exact date. Filtering by
 * attendance `status` (including the synthetic "NOT_MARKED") is applied
 * after the join since it depends on the merged result, not either source
 * table alone.
 */
export async function listAttendanceForDate(date: Date, filters: AttendanceGridFilters) {
  const employeeWhere: Prisma.EmployeeWhereInput = { status: { not: "INACTIVE" } };
  const labourWhere: Prisma.LabourWhereInput = { status: { not: "INACTIVE" } };

  if (filters.q) {
    employeeWhere.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { employeeCode: { contains: filters.q, mode: "insensitive" } },
    ];
    labourWhere.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { labourCode: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  if (filters.shiftId) {
    employeeWhere.shiftId = filters.shiftId;
    labourWhere.shiftId = filters.shiftId;
  }
  if (filters.group) {
    employeeWhere.department = filters.group;
    labourWhere.workType = filters.group;
  }

  const includeEmployees = filters.personType !== "LABOUR";
  const includeLabour = filters.personType !== "EMPLOYEE";

  const [employees, labourers] = await Promise.all([
    includeEmployees
      ? prisma.employee.findMany({
          where: employeeWhere,
          orderBy: { name: "asc" },
          include: { shift: { select: { shiftName: true } } },
        })
      : Promise.resolve([]),
    includeLabour
      ? prisma.labour.findMany({
          where: labourWhere,
          orderBy: { name: "asc" },
          include: { shift: { select: { shiftName: true } } },
        })
      : Promise.resolve([]),
  ]);

  const employeeIds = employees.map((e) => e.id);
  const labourIds = labourers.map((l) => l.id);

  const attendances =
    employeeIds.length || labourIds.length
      ? await prisma.attendance.findMany({
          where: {
            date,
            OR: [
              ...(employeeIds.length ? [{ employeeId: { in: employeeIds } }] : []),
              ...(labourIds.length ? [{ labourId: { in: labourIds } }] : []),
            ],
          },
        })
      : [];

  const byEmployee = new Map(attendances.filter((a) => a.employeeId).map((a) => [a.employeeId as string, a]));
  const byLabour = new Map(attendances.filter((a) => a.labourId).map((a) => [a.labourId as string, a]));

  const rows: AttendanceGridRow[] = [
    ...employees.map((e) => {
      const a = byEmployee.get(e.id);
      return {
        personType: "EMPLOYEE" as const,
        personId: e.id,
        code: e.employeeCode,
        name: e.name,
        group: e.department,
        shiftId: e.shiftId,
        shiftName: e.shift?.shiftName ?? null,
        attendanceId: a?.id ?? null,
        status: a?.status ?? null,
        overtimeHours: a?.overtimeHours ? Number(a.overtimeHours) : null,
        remarks: a?.remarks ?? null,
      };
    }),
    ...labourers.map((l) => {
      const a = byLabour.get(l.id);
      return {
        personType: "LABOUR" as const,
        personId: l.id,
        code: l.labourCode,
        name: l.name,
        group: l.workType,
        shiftId: l.shiftId,
        shiftName: l.shift?.shiftName ?? null,
        attendanceId: a?.id ?? null,
        status: a?.status ?? null,
        overtimeHours: a?.overtimeHours ? Number(a.overtimeHours) : null,
        remarks: a?.remarks ?? null,
      };
    }),
  ];

  const filtered =
    filters.status
      ? rows.filter((r) => (filters.status === "NOT_MARKED" ? r.status === null : r.status === filters.status))
      : rows;

  filtered.sort((a, b) => a.name.localeCompare(b.name));

  return filtered;
}

export async function listAttendanceGroups() {
  const [departments, workTypes] = await Promise.all([
    prisma.employee.findMany({
      where: { department: { not: null } },
      select: { department: true },
      distinct: ["department"],
    }),
    prisma.labour.findMany({
      where: { workType: { not: null } },
      select: { workType: true },
      distinct: ["workType"],
    }),
  ]);
  const set = new Set<string>();
  departments.forEach((d) => d.department && set.add(d.department));
  workTypes.forEach((w) => w.workType && set.add(w.workType));
  return Array.from(set).sort();
}
