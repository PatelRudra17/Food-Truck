import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/shared/table-search-input";
import { StatusFilterSelect } from "@/components/shared/status-filter-select";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { paginationSchema, paginationMeta } from "@/lib/validators/common";
import { ShiftFormDialog } from "@/components/shifts/shift-form-dialog";
import { ShiftTable, type ShiftRow } from "@/components/shifts/shift-table";
import { CalendarClock, Users2, PlayCircle, PauseCircle } from "lucide-react";
import { ShiftStatus, type Prisma } from "@prisma/client";

export const metadata = { title: "Shifts" };

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "CLOSED", label: "Closed" },
];

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission("OPERATIONS_VIEW");
  const canCreate = hasPermission(user, "OPERATIONS_CREATE");
  const canEdit = hasPermission(user, "OPERATIONS_EDIT");

  const sp = await searchParams;
  const get = (key: string) => {
    const v = sp[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const pagination = paginationSchema.parse({ page: get("page"), pageSize: get("pageSize") });
  const q = get("q")?.trim() || "";
  // Unknown ?status= values are ignored rather than passed through to Prisma.
  const rawStatus = get("status") || "";
  const status = (Object.values(ShiftStatus) as string[]).includes(rawStatus) ? rawStatus : "";

  const where: Prisma.ShiftWhereInput = {
    ...(status ? { status: status as ShiftStatus } : {}),
    ...(q ? { shiftName: { contains: q, mode: "insensitive" } } : {}),
  };

  // KPI cards are global (independent of the search/status filter and the
  // current page); only the table below is filter-scoped.
  const [total, shifts, activeCount, closedCount, allShiftsCount, employeesAssigned, labourAssigned, users] =
    await Promise.all([
      prisma.shift.count({ where }),
      prisma.shift.findMany({
        where,
        include: {
          supervisor: { select: { name: true } },
          _count: { select: { employees: true, labourers: true } },
        },
        orderBy: { date: "desc" },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      prisma.shift.count({ where: { status: "ACTIVE" } }),
      prisma.shift.count({ where: { status: "CLOSED" } }),
      prisma.shift.count(),
      prisma.employee.count({ where: { shiftId: { not: null } } }),
      prisma.labour.count({ where: { shiftId: { not: null } } }),
      prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);

  const rows: ShiftRow[] = shifts.map((s) => ({
    id: s.id,
    shiftName: s.shiftName,
    date: s.date.toISOString(),
    startTime: s.startTime.toISOString(),
    endTime: s.endTime.toISOString(),
    supervisorId: s.supervisorId,
    supervisorName: s.supervisor?.name ?? null,
    status: s.status,
    staffCount: s._count.employees + s._count.labourers,
  }));

  const supervisorOptions = users.map((u) => ({ id: u.id, label: u.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shifts"
        description="Manage shift schedules, supervisors, and staffing."
        actions={canCreate ? <ShiftFormDialog supervisorOptions={supervisorOptions} trigger={<Button>Create Shift</Button>} /> : undefined}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Active Shifts" value={activeCount} icon={PlayCircle} />
        <KpiCard label="Closed Shifts" value={closedCount} icon={PauseCircle} />
        <KpiCard label="Total Shifts" value={allShiftsCount} icon={CalendarClock} />
        <KpiCard
          label="Staff Assigned"
          value={employeesAssigned + labourAssigned}
          icon={Users2}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TableSearchInput placeholder="Search by shift name..." />
        <StatusFilterSelect options={STATUS_OPTIONS} placeholder="All statuses" />
      </div>

      <ShiftTable
        rows={rows}
        pagination={paginationMeta(total, pagination)}
        canEdit={canEdit}
        supervisorOptions={supervisorOptions}
      />
    </div>
  );
}
