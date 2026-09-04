import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { SalesOrderFilters } from "@/components/sales-orders/so-filters";
import { SalesOrdersTable } from "@/components/sales-orders/so-table";
import { listSalesOrdersAction } from "@/lib/actions/sales-order-actions";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata = { title: "Sales Orders" };

export default async function SalesOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("SALES_ORDER_VIEW");
  const user = await getSessionUser();
  const params = await searchParams;

  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

  const result = await listSalesOrdersAction({
    page: str(params.page),
    pageSize: str(params.pageSize),
    q: str(params.q),
    status: str(params.status),
    customerId: str(params.customerId),
    dateFrom: str(params.dateFrom),
    dateTo: str(params.dateTo),
  });

  const customers = await prisma.customer.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const canCreate = hasPermission(user, "SALES_ORDER_CREATE");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sales Orders"
        description="Raise, approve and track customer sales orders."
        actions={
          canCreate && (
            <Button size="sm" asChild>
              <Link href="/sales/orders/new">
                <Plus className="h-4 w-4" /> New Sales Order
              </Link>
            </Button>
          )
        }
      />

      <SalesOrderFilters
        customerOptions={customers}
        initial={{ dateFrom: str(params.dateFrom) ?? "", dateTo: str(params.dateTo) ?? "" }}
      />

      {result.ok ? (
        <SalesOrdersTable data={result.data.rows} pagination={result.data.pagination} />
      ) : (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {result.error}
        </div>
      )}
    </div>
  );
}
