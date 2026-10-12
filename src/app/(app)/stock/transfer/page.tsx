import Link from "next/link";
import { Plus } from "lucide-react";
import { TransferStatus, type Prisma } from "@prisma/client";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { paginationSchema, paginationMeta, isOneOf } from "@/lib/validators/common";
import { PageHeader } from "@/components/shared/page-header";
import { TableSearchInput } from "@/components/shared/table-search-input";
import { UrlSelectFilter } from "@/components/shared/url-select-filter";
import { TransferListTable, type TransferRow } from "@/components/stock-transfer/transfer-list-table";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Stock Transfer" };

export default async function StockTransferListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission("STOCK_TRANSFER_VIEW");
  const sp = await searchParams;
  const pagination = paginationSchema.parse({ page: sp.page, pageSize: sp.pageSize });
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const sourceWarehouseId = typeof sp.sourceWarehouseId === "string" ? sp.sourceWarehouseId : undefined;
  const destWarehouseId = typeof sp.destWarehouseId === "string" ? sp.destWarehouseId : undefined;

  const where: Prisma.StockTransferWhereInput = {
    ...(isOneOf(status, Object.values(TransferStatus)) ? { status } : {}),
    ...(sourceWarehouseId ? { sourceWarehouseId } : {}),
    ...(destWarehouseId ? { destWarehouseId } : {}),
    ...(q ? { transferNumber: { contains: q, mode: "insensitive" as const } } : {}),
  };

  const [total, transfers, warehouses] = await Promise.all([
    prisma.stockTransfer.count({ where }),
    prisma.stockTransfer.findMany({
      where,
      include: {
        sourceWarehouse: true,
        destWarehouse: true,
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    prisma.warehouse.findMany({ orderBy: { name: "asc" } }),
  ]);

  const rows: TransferRow[] = transfers.map((t) => ({
    id: t.id,
    transferNumber: t.transferNumber,
    sourceWarehouseName: t.sourceWarehouse.name,
    destWarehouseName: t.destWarehouse.name,
    status: t.status,
    dispatchDate: t.dispatchDate ? t.dispatchDate.toISOString() : null,
    receivedDate: t.receivedDate ? t.receivedDate.toISOString() : null,
    itemCount: t._count.items,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Transfer"
        description="Move stock between warehouses with approval and dispatch/receive tracking."
        actions={
          hasPermission(user, "STOCK_TRANSFER_CREATE") ? (
            <Button asChild>
              <Link href="/stock/transfer/new">
                <Plus className="mr-2 h-4 w-4" /> New Transfer
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <TableSearchInput placeholder="Search by transfer number..." />
        <UrlSelectFilter
          paramKey="status"
          placeholder="All Statuses"
          options={Object.values(TransferStatus).map((s) => ({ value: s, label: s }))}
        />
        <UrlSelectFilter
          paramKey="sourceWarehouseId"
          placeholder="Any Source Warehouse"
          options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
        />
        <UrlSelectFilter
          paramKey="destWarehouseId"
          placeholder="Any Destination Warehouse"
          options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
        />
      </div>
      <TransferListTable data={rows} pagination={paginationMeta(total, pagination)} />
    </div>
  );
}
