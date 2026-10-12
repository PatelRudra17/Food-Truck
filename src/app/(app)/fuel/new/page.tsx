import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { FuelForm } from "@/components/fuel/fuel-form";
import { FUEL_LINKABLE_TRIP_STATUSES } from "@/lib/validators/fuel";
import { subDays } from "date-fns";

export const metadata = { title: "Log Fuel Entry" };

export default async function NewFuelEntryPage() {
  await requirePermission("FUEL_CREATE");

  const [vehicles, drivers, trips] = await Promise.all([
    prisma.vehicle.findMany({
      select: { id: true, vehicleNumber: true, odometerKm: true, fuelType: true },
      orderBy: { vehicleNumber: "asc" },
    }),
    prisma.driver.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    // Recent on-the-road trips; the form narrows these to the chosen vehicle.
    prisma.trip.findMany({
      where: {
        status: { in: [...FUEL_LINKABLE_TRIP_STATUSES] },
        createdAt: { gte: subDays(new Date(), 90) },
      },
      select: { id: true, tripNumber: true, vehicleId: true, status: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ]);

  const vehicleOptions = vehicles.map((v) => ({
    id: v.id,
    vehicleNumber: v.vehicleNumber,
    odometerKm: Number(v.odometerKm),
    fuelType: v.fuelType,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Log Fuel Entry" description="Record a refuelling event for a vehicle." />
      <FuelForm vehicleOptions={vehicleOptions} driverOptions={drivers} tripOptions={trips} />
    </div>
  );
}
