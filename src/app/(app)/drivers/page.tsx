import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { paginationSchema } from "@/lib/validators/common";
import { listDrivers } from "@/lib/services/driver";
import { PageHeader } from "@/components/shared/page-header";
import { TableSearchInput } from "@/components/shared/table-search-input";
import { TableFilterSelect } from "@/components/shared/table-filter-select";
import { Button } from "@/components/ui/button";
import { DriverTable } from "@/components/drivers/driver-table";
import { DriverFormDialog } from "@/components/drivers/driver-form-dialog";

export const metadata = { title: "Drivers" };

export default async function DriversPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("DRIVER_VIEW");
  const user = await getSessionUser();
  const sp = await searchParams;

  const get = (key: string) => {
    const value = sp[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const pagination = paginationSchema.parse({ page: get("page"), pageSize: get("pageSize") });
  const q = get("q")?.trim();
  const status = get("status")?.trim();

  const { rows, pagination: paginationMeta } = await listDrivers(pagination, {
    q: q || undefined,
    status: status || undefined,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Drivers"
        description="Manage drivers, their employment status, and compliance documents."
        actions={
          hasPermission(user, "DRIVER_CREATE") ? (
            <DriverFormDialog
              mode="create"
              trigger={<Button size="sm">New Driver</Button>}
            />
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <TableSearchInput placeholder="Search by driver name or employee ID..." />
          <TableFilterSelect
            paramKey="status"
            placeholder="All statuses"
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "ON_LEAVE", label: "On Leave" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
          />
        </div>
      </div>

      <DriverTable
        data={rows.map((driver) => ({
          ...driver,
          status: driver.status,
          joiningDate: driver.joiningDate ? driver.joiningDate.toISOString() : null,
        }))}
        pagination={paginationMeta}
        canArchive={hasPermission(user, "DRIVER_ARCHIVE")}
      />
    </div>
  );
}
