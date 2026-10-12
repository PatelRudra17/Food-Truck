import { Plus, Download } from "lucide-react";
import { format } from "date-fns";
import { Prisma, POStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { paginationSchema, paginationMeta } from "@/lib/validators/common";
import { PageHeader } from "@/components/shared/page-header";
import { TableSearchInput } from "@/components/shared/table-search-input";
import { StatusFilterSelect } from "@/components/shared/status-filter-select";
import { PurchaseOrdersTable } from "@/components/purchase-orders/po-table";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata = { title: "Purchase Orders" };

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("PURCHASE_ORDER_VIEW");
  const user = await getSessionUser();
  const params = await searchParams;

  const pagination = paginationSchema.parse({
    page: params.page,
    pageSize: params.pageSize,
  });
  const q = typeof params.q === "string" ? params.q : undefined;
  // Ignore unknown status values instead of letting Prisma throw on an invalid enum.
  const status =
    typeof params.status === "string" && (Object.values(POStatus) as string[]).includes(params.status)
      ? (params.status as POStatus)
      : undefined;

  const where: Prisma.PurchaseOrderWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { poNumber: { contains: q, mode: "insensitive" } },
            { supplier: { companyName: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, orders] = await Promise.all([
    prisma.purchaseOrder.count({ where }),
    prisma.purchaseOrder.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
      select: {
        id: true,
        poNumber: true,
        date: true,
        expectedDelivery: true,
        totalAmount: true,
        status: true,
        supplier: { select: { companyName: true } },
      },
    }),
  ]);

  const canCreate = hasPermission(user, "PURCHASE_ORDER_CREATE");
  const canExport = hasPermission(user, "PURCHASE_ORDER_EXPORT");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Purchase Orders"
        description="Raise, approve and track purchase orders to suppliers."
        actions={
          <>
            {canExport && (
              <Button size="sm" variant="outline" asChild>
                <a href="/api/exports/purchase-orders">
                  <Download className="h-4 w-4" /> Export
                </a>
              </Button>
            )}
            {canCreate && (
              <Button size="sm" asChild>
                <Link href="/purchase-orders/new">
                  <Plus className="h-4 w-4" /> New Purchase Order
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <TableSearchInput placeholder="Search by PO number or supplier..." />
        <StatusFilterSelect
          options={[
            { value: "DRAFT", label: "Draft" },
            { value: "PENDING_APPROVAL", label: "Pending Approval" },
            { value: "APPROVED", label: "Approved" },
            { value: "PARTIALLY_RECEIVED", label: "Partially Received" },
            { value: "RECEIVED", label: "Received" },
            { value: "CANCELLED", label: "Cancelled" },
          ]}
        />
      </div>

      <PurchaseOrdersTable
        data={orders.map((po) => ({
          id: po.id,
          poNumber: po.poNumber,
          supplierName: po.supplier.companyName,
          date: format(po.date, "dd MMM yyyy"),
          expectedDelivery: po.expectedDelivery ? format(po.expectedDelivery, "dd MMM yyyy") : null,
          totalAmount: Number(po.totalAmount),
          status: po.status,
        }))}
        pagination={paginationMeta(total, pagination)}
      />
    </div>
  );
}
