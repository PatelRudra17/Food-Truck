import { requirePermission } from "@/lib/auth/guard";
import { paginationSchema } from "@/lib/validators/common";
import { listVehicles, listActiveDriversForSelect } from "@/lib/services/vehicle";
import { PageHeader } from "@/components/shared/page-header";
import { TableSearchInput } from "@/components/shared/table-search-input";
import { TableFilterSelect } from "@/components/shared/table-filter-select";
import { VehicleTable } from "@/components/vehicles/vehicle-table";
import { VehicleFormDialog } from "@/components/vehicles/vehicle-form-dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { VEHICLE_STATUSES } from "@/lib/validators/vehicle";

export const metadata = { title: "Vehicles" };

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission("VEHICLE_VIEW");
  const sp = await searchParams;

  const pagination = paginationSchema.parse({
    page: sp.page,
    pageSize: sp.pageSize,
  });
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const vehicleType = typeof sp.vehicleType === "string" ? sp.vehicleType : undefined;

  const [{ rows, pagination: meta, vehicleTypes }, drivers] = await Promise.all([
    listVehicles(pagination, { q, status, vehicleType }),
    listActiveDriversForSelect(),
  ]);

  const canCreate = user.permissions.includes("VEHICLE_CREATE");
  const canArchive = user.permissions.includes("VEHICLE_ARCHIVE");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Vehicles"
        description="Fleet master data, status and key document expiry at a glance."
        actions={
          canCreate ? (
            <VehicleFormDialog
              mode="create"
              drivers={drivers}
              trigger={
                <Button size="sm">
                  <Plus className="h-4 w-4" /> New Vehicle
                </Button>
              }
            />
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <TableSearchInput placeholder="Search by vehicle number..." />
        <TableFilterSelect
          paramKey="status"
          placeholder="All Statuses"
          options={VEHICLE_STATUSES.map((s) => ({ value: s, label: s.replaceAll("_", " ") }))}
        />
        <TableFilterSelect
          paramKey="vehicleType"
          placeholder="All Types"
          options={vehicleTypes.map((t) => ({ value: t, label: t }))}
        />
      </div>

      <VehicleTable data={rows} pagination={meta} canArchive={canArchive} />
    </div>
  );
}
