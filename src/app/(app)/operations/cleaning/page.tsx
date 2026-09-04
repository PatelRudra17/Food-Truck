import type { Prisma, CleaningStatus } from "@prisma/client";
import { PageHeader } from "@/components/shared/page-header";
import { TableSearchInput } from "@/components/shared/table-search-input";
import { KpiCard } from "@/components/shared/kpi-card";
import { Button } from "@/components/ui/button";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { paginationSchema, paginationMeta } from "@/lib/validators/common";
import { CleaningFormDialog } from "@/components/cleaning/cleaning-form-dialog";
import { CleaningFilters } from "@/components/cleaning/cleaning-filters";
import { CleaningTable, type CleaningRow } from "@/components/cleaning/cleaning-table";
import { SprayCan, Clock, CircleCheck, Hourglass } from "lucide-react";

export const metadata = { title: "Cleaning" };

export default async function CleaningPage({
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
  const status = get("status") || "";
  const entityType = get("entityType") || "";

  const where: Prisma.CleaningWhereInput = {
    ...(status ? { status: status as CleaningStatus } : {}),
    ...(entityType ? { entityType } : {}),
    ...(q
      ? {
          OR: [
            { locationText: { contains: q, mode: "insensitive" } },
            { cleaningType: { contains: q, mode: "insensitive" } },
            { vehicle: { vehicleNumber: { contains: q, mode: "insensitive" } } },
            { crate: { crateCode: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, records, pendingCount, inProgressCount, completedTodayCount, staff] = await Promise.all([
    prisma.cleaning.count({ where }),
    prisma.cleaning.findMany({
      where,
      include: {
        vehicle: { select: { vehicleNumber: true } },
        crate: { select: { crateCode: true } },
        staff: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    prisma.cleaning.count({ where: { status: "PENDING" } }),
    prisma.cleaning.count({ where: { status: "IN_PROGRESS" } }),
    prisma.cleaning.count({
      where: { status: "COMPLETED", endTime: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const [vehicles, crates] = await Promise.all([
    prisma.vehicle.findMany({ select: { id: true, vehicleNumber: true }, orderBy: { vehicleNumber: "asc" } }),
    prisma.crate.findMany({ select: { id: true, crateCode: true }, orderBy: { crateCode: "asc" } }),
  ]);

  const rows: CleaningRow[] = records.map((r) => ({
    id: r.id,
    entityType: r.entityType as CleaningRow["entityType"],
    subject: r.vehicle?.vehicleNumber ?? r.crate?.crateCode ?? r.locationText ?? "—",
    cleaningType: r.cleaningType,
    staffId: r.staffId,
    staffName: r.staff?.name ?? null,
    startTime: r.startTime ? r.startTime.toISOString() : null,
    endTime: r.endTime ? r.endTime.toISOString() : null,
    status: r.status,
    remarks: r.remarks,
  }));

  const staffOptions = staff.map((s) => ({ id: s.id, label: s.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cleaning"
        description="Track cleaning tasks for vehicles, crates, and locations."
        actions={
          canCreate ? (
            <CleaningFormDialog
              vehicleOptions={vehicles.map((v) => ({ id: v.id, label: v.vehicleNumber }))}
              crateOptions={crates.map((c) => ({ id: c.id, label: c.crateCode }))}
              staffOptions={staffOptions}
              trigger={<Button>Log Cleaning</Button>}
            />
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Pending" value={pendingCount} icon={Hourglass} tone={pendingCount > 0 ? "warning" : "default"} />
        <KpiCard label="In Progress" value={inProgressCount} icon={Clock} />
        <KpiCard label="Completed Today" value={completedTodayCount} icon={CircleCheck} />
        <KpiCard label="Total Records" value={total} icon={SprayCan} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TableSearchInput placeholder="Search by vehicle, crate, type, or location..." />
        <CleaningFilters />
      </div>

      <CleaningTable rows={rows} pagination={paginationMeta(total, pagination)} canEdit={canEdit} staffOptions={staffOptions} />
    </div>
  );
}
