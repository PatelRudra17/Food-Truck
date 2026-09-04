import { Plus, Users } from "lucide-react";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { listCustomersAction } from "@/lib/actions/customer-actions";
import { PageHeader } from "@/components/shared/page-header";
import { TableSearchInput } from "@/components/shared/table-search-input";
import { StatusFilterSelect } from "@/components/shared/status-filter-select";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { CustomersTable } from "@/components/customers/customers-table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata = { title: "Customers" };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("CUSTOMER_VIEW");
  const user = await getSessionUser();
  const params = await searchParams;

  const q = typeof params.q === "string" ? params.q : undefined;
  const status = typeof params.status === "string" ? params.status : undefined;

  const canCreate = hasPermission(user, "CUSTOMER_CREATE");
  const canEdit = hasPermission(user, "CUSTOMER_EDIT");
  const canArchive = hasPermission(user, "CUSTOMER_ARCHIVE");

  const newCustomerAction = canCreate ? (
    <CustomerFormDialog
      trigger={
        <Button size="sm">
          <Plus className="h-4 w-4" /> New Customer
        </Button>
      }
    />
  ) : undefined;

  const result = await listCustomersAction({ page: params.page, pageSize: params.pageSize, q, status });

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <PageHeader title="Customers" description="Manage customer master records." actions={newCustomerAction} />
        <EmptyState icon={Users} title="Unable to load customers" description={result.error} />
      </div>
    );
  }

  const { rows, pagination } = result.data;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customers"
        description="Manage customer master records used across sales orders, trips, and crates."
        actions={newCustomerAction}
      />

      <div className="flex flex-wrap items-center gap-2">
        <TableSearchInput placeholder="Search by name, code, or phone..." />
        <StatusFilterSelect
          options={[
            { value: "ACTIVE", label: "Active" },
            { value: "INACTIVE", label: "Inactive" },
          ]}
        />
      </div>

      <CustomersTable data={rows} pagination={pagination} canEdit={canEdit} canArchive={canArchive} />
    </div>
  );
}
