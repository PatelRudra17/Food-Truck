import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { MaintenanceForm } from "@/components/maintenance/maintenance-form";

export const metadata = { title: "Log Maintenance" };

export default async function NewMaintenancePage() {
  await requirePermission("MAINTENANCE_CREATE");

  const vehicles = await prisma.vehicle.findMany({
    select: { id: true, vehicleNumber: true, odometerKm: true },
    orderBy: { vehicleNumber: "asc" },
  });

  const vehicleOptions = vehicles.map((v) => ({
    id: v.id,
    vehicleNumber: v.vehicleNumber,
    odometerKm: Number(v.odometerKm),
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Log Maintenance" description="Record a service or repair event for a vehicle." />
      <MaintenanceForm vehicleOptions={vehicleOptions} />
    </div>
  );
}
