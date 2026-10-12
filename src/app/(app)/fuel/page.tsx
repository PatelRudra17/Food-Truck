import Link from "next/link";
import { Prisma } from "@prisma/client";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { TableSearchInput } from "@/components/shared/table-search-input";
import { KpiCard } from "@/components/shared/kpi-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { paginationSchema, paginationMeta, dateParam } from "@/lib/validators/common";
import { FuelFilters } from "@/components/fuel/fuel-filters";
import { FuelTable } from "@/components/fuel/fuel-table";
import { fuelTripLabels } from "@/lib/services/fuel-trips";
import { Fuel as FuelIcon, IndianRupee, Gauge, TrendingUp, CalendarClock } from "lucide-react";
import { startOfMonth } from "date-fns";

export const metadata = { title: "Fuel Management" };

export default async function FuelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("FUEL_VIEW");
  const user = await getSessionUser();
  const sp = await searchParams;

  const get = (key: string) => {
    const v = sp[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const pagination = paginationSchema.parse({ page: get("page"), pageSize: get("pageSize") });
  const q = get("q")?.trim() || "";
  const vehicleId = get("vehicleId") || "";
  const driverId = get("driverId") || "";
  const fuelType = get("fuelType") || "";
  const fuelStation = get("fuelStation")?.trim() || "";
  const dateFrom = dateParam(get("dateFrom"));
  const dateTo = dateParam(get("dateTo"));
  const showVoided = get("showVoided") === "1";

  const where: Prisma.FuelEntryWhereInput = {
    ...(showVoided ? {} : { isVoided: false }),
    ...(q ? { vehicle: { vehicleNumber: { contains: q, mode: "insensitive" } } } : {}),
    ...(vehicleId ? { vehicleId } : {}),
    ...(driverId ? { driverId } : {}),
    ...(fuelType ? { fuelType } : {}),
    ...(fuelStation ? { fuelStationVendor: { contains: fuelStation, mode: "insensitive" } } : {}),
    ...(dateFrom || dateTo
      ? {
          date: {
            ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00`) } : {}),
            ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999`) } : {}),
          },
        }
      : {}),
  };

  const [total, entries, vehicles, drivers] = await Promise.all([
    prisma.fuelEntry.count({ where }),
    prisma.fuelEntry.findMany({
      where,
      include: {
        vehicle: { select: { vehicleNumber: true } },
        driver: { select: { fullName: true } },
        attachments: { where: { isDeleted: false }, select: { id: true } },
      },
      orderBy: { date: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    prisma.vehicle.findMany({ select: { id: true, vehicleNumber: true }, orderBy: { vehicleNumber: "asc" } }),
    prisma.driver.findMany({ select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
  ]);

  const tripLabels = await fuelTripLabels(entries.map((e) => e.tripId));

  const rows = entries.map((e) => ({
    id: e.id,
    date: e.date.toISOString(),
    vehicleNumber: e.vehicle.vehicleNumber,
    driverName: e.driver?.fullName ?? null,
    tripNumber: e.tripId ? (tripLabels.get(e.tripId) ?? e.tripId) : null,
    distanceKm: Number(e.distanceKm),
    fuelQuantityLiters: Number(e.fuelQuantityLiters),
    totalFuelCost: Number(e.totalFuelCost),
    mileageKmpl: e.mileageKmpl != null ? Number(e.mileageKmpl) : null,
    fuelCostPerKm: e.fuelCostPerKm != null ? Number(e.fuelCostPerKm) : null,
    isAnomaly: e.isAnomaly,
    isVoided: e.isVoided,
    hasAttachment: e.attachments.length > 0,
    attachmentId: e.attachments[0]?.id ?? null,
  }));

  // Dashboard aggregates always exclude voided entries, regardless of the list's "show voided" toggle.
  const monthStart = startOfMonth(new Date());
  const [agg, monthAgg, topVehicles] = await Promise.all([
    prisma.fuelEntry.aggregate({
      where: { isVoided: false },
      _sum: { fuelQuantityLiters: true, totalFuelCost: true },
      _avg: { mileageKmpl: true, fuelCostPerKm: true },
    }),
    prisma.fuelEntry.aggregate({
      where: { isVoided: false, date: { gte: monthStart } },
      _sum: { totalFuelCost: true },
    }),
    prisma.fuelEntry.groupBy({
      by: ["vehicleId"],
      where: { isVoided: false },
      _sum: { fuelQuantityLiters: true },
      orderBy: { _sum: { fuelQuantityLiters: "desc" } },
      take: 5,
    }),
  ]);

  const topVehicleRows = await Promise.all(
    topVehicles.map(async (t) => {
      const v = await prisma.vehicle.findUnique({ where: { id: t.vehicleId }, select: { vehicleNumber: true } });
      return { vehicleNumber: v?.vehicleNumber ?? "—", liters: Number(t._sum.fuelQuantityLiters ?? 0) };
    }),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fuel Management"
        description="Track fuel consumption, cost, and mileage anomalies across the fleet."
        actions={
          hasPermission(user, "FUEL_CREATE") ? (
            <Button asChild>
              <Link href="/fuel/new">Log Fuel Entry</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="Total Fuel Consumed"
          value={`${Number(agg._sum.fuelQuantityLiters ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} L`}
          icon={FuelIcon}
        />
        <KpiCard
          label="Total Fuel Cost"
          value={`₹${Number(agg._sum.totalFuelCost ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={IndianRupee}
        />
        <KpiCard
          label="Average Mileage"
          value={`${Number(agg._avg.mileageKmpl ?? 0).toFixed(2)} km/L`}
          icon={Gauge}
        />
        <KpiCard
          label="Average Cost / km"
          value={`₹${Number(agg._avg.fuelCostPerKm ?? 0).toFixed(2)}`}
          icon={TrendingUp}
        />
        <KpiCard
          label="This Month's Expense"
          value={`₹${Number(monthAgg._sum.totalFuelCost ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={CalendarClock}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Top 5 Fuel-Consuming Vehicles</CardTitle>
        </CardHeader>
        <CardContent>
          {topVehicleRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No fuel entries recorded yet.</p>
          ) : (
            <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {topVehicleRows.map((v, i) => (
                <li
                  key={v.vehicleNumber + i}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span className="font-medium">
                    {i + 1}. {v.vehicleNumber}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{v.liters.toLocaleString()} L</span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <TableSearchInput placeholder="Search by vehicle number..." />
        </div>
        {hasPermission(user, "FUEL_EXPORT") && (
          <Button variant="outline" asChild>
            <a
              href={`/api/exports/fuel?${new URLSearchParams({
                q,
                vehicleId,
                driverId,
                fuelType,
                fuelStation,
                dateFrom,
                dateTo,
                showVoided: showVoided ? "1" : "",
              }).toString()}`}
            >
              Export to Excel
            </a>
          </Button>
        )}
      </div>

      <FuelFilters
        vehicleOptions={vehicles}
        driverOptions={drivers}
        initial={{ vehicleId, driverId, fuelType, fuelStation, dateFrom, dateTo, showVoided }}
      />

      <FuelTable
        rows={rows}
        pagination={paginationMeta(total, pagination)}
        canVoid={hasPermission(user, "FUEL_ARCHIVE")}
      />
    </div>
  );
}
