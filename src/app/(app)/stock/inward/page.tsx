import Link from "next/link";
import { Plus } from "lucide-react";
import { InwardStatus, type Prisma } from "@prisma/client";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { paginationSchema, paginationMeta } from "@/lib/validators/common";
import { PageHeader } from "@/components/shared/page-header";
import { TableSearchInput } from "@/components/shared/table-search-input";
import { UrlSelectFilter } from "@/components/shared/url-select-filter";
import { InwardListTable, type InwardRow } from "@/components/stock-inward/inward-list-table";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Stock Inward" };

export default async function StockInwardListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission("STOCK_INWARD_VIEW");
  const sp = await searchParams;
  const pagination = paginationSchema.parse({ page: sp.page, pageSize: sp.pageSize });
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const warehouseId = typeof sp.warehouseId === "string" ? sp.warehouseId : undefined;

  const where: Prisma.StockInwardWhereInput = {
    ...(status ? { status: status as InwardStatus } : {}),
    ...(warehouseId ? { warehouseId } : {}),
    ...(q
      ? {
          OR: [
            { inwardNumber: { contains: q, mode: "insensitive" as const } },
            { supplier: { is: { companyName: { contains: q, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  };

  const [total, inwards, warehouses] = await Promise.all([
    prisma.stockInward.count({ where }),
    prisma.stockInward.findMany({
      where,
      include: {
        supplier: true,
        warehouse: true,
        receivedBy: true,
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    prisma.warehouse.findMany({ orderBy: { name: "asc" } }),
  ]);

  const rows: InwardRow[] = inwards.map((inward) => ({
    id: inward.id,
    inwardNumber: inward.inwardNumber,
    date: inward.date.toISOString(),
    supplierName: inward.supplier?.companyName ?? null,
    warehouseName: inward.warehouse.name,
    status: inward.status,
    itemCount: inward._count.items,
    receivedByName: inward.receivedBy?.name ?? "—",
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Inward"
        description="Receive stock from suppliers and purchase orders into your warehouses."
        actions={
          hasPermission(user, "STOCK_INWARD_CREATE") ? (
            <Button asChild>
              <Link href="/stock/inward/new">
                <Plus className="mr-2 h-4 w-4" /> New Inward
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <TableSearchInput placeholder="Search by inward number or supplier..." />
        <UrlSelectFilter
          paramKey="status"
          placeholder="All Statuses"
          options={Object.values(InwardStatus).map((s) => ({ value: s, label: s }))}
        />
        <UrlSelectFilter
          paramKey="warehouseId"
          placeholder="All Warehouses"
          options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
        />
      </div>
      <InwardListTable data={rows} pagination={paginationMeta(total, pagination)} />
    </div>
  );
}
