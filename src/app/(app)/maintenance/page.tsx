import Link from "next/link";
import { Prisma, MaintenanceType } from "@prisma/client";
import { startOfMonth, startOfYear } from "date-fns";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { TableSearchInput } from "@/components/shared/table-search-input";
import { KpiCard } from "@/components/shared/kpi-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { paginationSchema, paginationMeta, dateParam } from "@/lib/validators/common";
import { recomputeVehicleMaintenanceState } from "@/lib/actions/maintenance-actions";
import { MaintenanceFilters } from "@/components/maintenance/maintenance-filters";
import { MaintenanceTable } from "@/components/maintenance/maintenance-table";
import { DueVehiclesCard } from "@/components/maintenance/due-vehicles-card";
import { Wrench, IndianRupee, AlertTriangle, CalendarRange, Car } from "lucide-react";

export const metadata = { title: "Vehicle Maintenance" };

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("MAINTENANCE_VIEW");
  const user = await getSessionUser();
  const sp = await searchParams;

  const get = (key: string) => {
    const v = sp[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const pagination = paginationSchema.parse({ page: get("page"), pageSize: get("pageSize") });
  const q = get("q")?.trim() || "";
  const vehicleId = get("vehicleId") || "";
  const maintenanceType = get("maintenanceType") || "";
  const validMaintenanceType = (Object.values(MaintenanceType) as string[]).includes(
    maintenanceType,
  )
    ? (maintenanceType as MaintenanceType)
    : undefined;
  const dateFrom = dateParam(get("dateFrom"));
  const dateTo = dateParam(get("dateTo"));
  const showArchived = get("showArchived") === "1";

  // Keep every vehicle's live maintenanceState fresh before we read it for the badges/summary
  // below — the field only reflects reality once recomputed against the current odometer/date.
  const allVehicleIds = await prisma.vehicle.findMany({ select: { id: true } });
  await Promise.all(allVehicleIds.map((v) => recomputeVehicleMaintenanceState(v.id)));

  const where: Prisma.VehicleMaintenanceWhereInput = {
    ...(showArchived ? {} : { isArchived: false }),
    ...(q ? { vehicle: { vehicleNumber: { contains: q, mode: "insensitive" } } } : {}),
    ...(vehicleId ? { vehicleId } : {}),
    ...(validMaintenanceType ? { maintenanceType: validMaintenanceType } : {}),
    ...(dateFrom || dateTo
      ? {
          serviceDate: {
            ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00`) } : {}),
            ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999`) } : {}),
          },
        }
      : {}),
  };

  const [total, records, vehicles] = await Promise.all([
    prisma.vehicleMaintenance.count({ where }),
    prisma.vehicleMaintenance.findMany({
      where,
      include: {
        vehicle: { select: { vehicleNumber: true, maintenanceState: true } },
        attachments: { where: { isDeleted: false }, select: { id: true } },
      },
      orderBy: { serviceDate: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    prisma.vehicle.findMany({ select: { id: true, vehicleNumber: true }, orderBy: { vehicleNumber: "asc" } }),
  ]);

  const rows = records.map((r) => ({
    id: r.id,
    serviceDate: r.serviceDate.toISOString(),
    vehicleNumber: r.vehicle.vehicleNumber,
    maintenanceType: r.maintenanceType,
    serviceCenterVendor: r.serviceCenterVendor,
    odometerKm: Number(r.odometerKm),
    totalCost: Number(r.totalCost),
    maintenanceState: r.vehicle.maintenanceState,
    isArchived: r.isArchived,
    hasAttachment: r.attachments.length > 0,
    attachmentId: r.attachments[0]?.id ?? null,
  }));

  const monthStart = startOfMonth(new Date());
  const yearStart = startOfYear(new Date());

  const [dueOverdueVehicles, monthCost, yearCost, topCostGroups, underMaintenanceCount] = await Promise.all([
    prisma.vehicle.findMany({
      where: { maintenanceState: { in: ["DUE", "OVERDUE"] } },
      select: {
        id: true,
        vehicleNumber: true,
        maintenanceState: true,
        maintenanceOverride: true,
        nextServiceDate: true,
        nextServiceKm: true,
      },
      orderBy: { vehicleNumber: "asc" },
    }),
    prisma.vehicleMaintenance.aggregate({
      where: { isArchived: false, serviceDate: { gte: monthStart } },
      _sum: { totalCost: true },
    }),
    prisma.vehicleMaintenance.aggregate({
      where: { isArchived: false, serviceDate: { gte: yearStart } },
      _sum: { totalCost: true },
    }),
    prisma.vehicleMaintenance.groupBy({
      by: ["vehicleId"],
      where: { isArchived: false },
      _sum: { totalCost: true },
      orderBy: { _sum: { totalCost: "desc" } },
      take: 5,
    }),
    prisma.vehicle.count({ where: { status: "MAINTENANCE" } }),
  ]);

  const topCostRows = await Promise.all(
    topCostGroups.map(async (g) => {
      const v = await prisma.vehicle.findUnique({ where: { id: g.vehicleId }, select: { vehicleNumber: true } });
      return { vehicleNumber: v?.vehicleNumber ?? "—", cost: Number(g._sum.totalCost ?? 0) };
    }),
  );

  const dueVehicleRows = dueOverdueVehicles.map((v) => ({
    id: v.id,
    vehicleNumber: v.vehicleNumber,
    maintenanceState: v.maintenanceState,
    maintenanceOverride: v.maintenanceOverride,
    nextServiceDate: v.nextServiceDate ? v.nextServiceDate.toISOString() : null,
    nextServiceKm: v.nextServiceKm != null ? Number(v.nextServiceKm) : null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vehicle Maintenance"
        description="Track service history, upcoming/overdue maintenance, and cost across the fleet."
        actions={
          hasPermission(user, "MAINTENANCE_CREATE") ? (
            <Button asChild>
              <Link href="/maintenance/new">Log Maintenance</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Due / Overdue"
          value={dueOverdueVehicles.length}
          icon={AlertTriangle}
          tone={dueOverdueVehicles.length > 0 ? "danger" : "default"}
        />
        <KpiCard label="Under Maintenance" value={underMaintenanceCount} icon={Wrench} />
        <KpiCard
          label="Cost This Month"
          value={`₹${Number(monthCost._sum.totalCost ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={IndianRupee}
        />
        <KpiCard
          label="Cost This Year"
          value={`₹${Number(yearCost._sum.totalCost ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={CalendarRange}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DueVehiclesCard
          vehicles={dueVehicleRows}
          canOverride={hasPermission(user, "OVERRIDE_MAINTENANCE_BLOCK")}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Highest Maintenance-Cost Vehicles</CardTitle>
          </CardHeader>
          <CardContent>
            {topCostRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No maintenance records yet.</p>
            ) : (
              <ol className="space-y-2">
                {topCostRows.map((v, i) => (
                  <li key={v.vehicleNumber + i} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      <Car className="h-3.5 w-3.5 text-muted-foreground" />
                      {i + 1}. {v.vehicleNumber}
                    </span>
                    <span className="tabular-nums text-muted-foreground">₹{v.cost.toLocaleString()}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TableSearchInput placeholder="Search by vehicle number..." />
        {hasPermission(user, "MAINTENANCE_EXPORT") && (
          <Button variant="outline" asChild>
            <a
              href={`/api/exports/maintenance?${new URLSearchParams({
                q,
                vehicleId,
                maintenanceType,
                dateFrom,
                dateTo,
                showArchived: showArchived ? "1" : "",
              }).toString()}`}
            >
              Export to Excel
            </a>
          </Button>
        )}
      </div>

      <MaintenanceFilters
        vehicleOptions={vehicles}
        initial={{ vehicleId, maintenanceType, dateFrom, dateTo, showArchived }}
      />

      <MaintenanceTable
        rows={rows}
        pagination={paginationMeta(total, pagination)}
        canArchive={hasPermission(user, "MAINTENANCE_ARCHIVE")}
      />
    </div>
  );
}
