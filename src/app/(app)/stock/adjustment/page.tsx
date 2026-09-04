import Link from "next/link";
import { Plus } from "lucide-react";
import { AdjustmentStatus, type Prisma } from "@prisma/client";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { paginationSchema, paginationMeta } from "@/lib/validators/common";
import { PageHeader } from "@/components/shared/page-header";
import { TableSearchInput } from "@/components/shared/table-search-input";
import { UrlSelectFilter } from "@/components/shared/url-select-filter";
import { AdjustmentListTable, type AdjustmentRow } from "@/components/stock-adjustment/adjustment-list-table";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Stock Adjustment" };

export default async function StockAdjustmentListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission("STOCK_ADJUSTMENT_VIEW");
  const sp = await searchParams;
  const pagination = paginationSchema.parse({ page: sp.page, pageSize: sp.pageSize });
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const warehouseId = typeof sp.warehouseId === "string" ? sp.warehouseId : undefined;
  const itemId = typeof sp.itemId === "string" ? sp.itemId : undefined;

  const where: Prisma.StockAdjustmentWhereInput = {
    ...(status ? { status: status as AdjustmentStatus } : {}),
    ...(warehouseId ? { warehouseId } : {}),
    ...(itemId ? { itemId } : {}),
    ...(q
      ? {
          OR: [
            { adjustmentNumber: { contains: q, mode: "insensitive" as const } },
            { reason: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, adjustments, warehouses, items] = await Promise.all([
    prisma.stockAdjustment.count({ where }),
    prisma.stockAdjustment.findMany({
      where,
      include: { item: true, warehouse: true },
      orderBy: { createdAt: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    prisma.warehouse.findMany({ orderBy: { name: "asc" } }),
    prisma.item.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const rows: AdjustmentRow[] = adjustments.map((a) => ({
    id: a.id,
    adjustmentNumber: a.adjustmentNumber,
    itemName: a.item.name,
    warehouseName: a.warehouse.name,
    currentQty: Number(a.currentQty),
    physicalQty: Number(a.physicalQty),
    difference: Number(a.difference),
    status: a.status,
    reason: a.reason,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Adjustment"
        description="Correct stock discrepancies from physical counts, damage, loss or data corrections. Every adjustment requires approval."
        actions={
          hasPermission(user, "STOCK_ADJUSTMENT_CREATE") ? (
            <Button asChild>
              <Link href="/stock/adjustment/new">
                <Plus className="mr-2 h-4 w-4" /> New Adjustment
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <TableSearchInput placeholder="Search by adjustment number or reason..." />
        <UrlSelectFilter
          paramKey="status"
          placeholder="All Statuses"
          options={Object.values(AdjustmentStatus).map((s) => ({ value: s, label: s }))}
        />
        <UrlSelectFilter
          paramKey="warehouseId"
          placeholder="All Warehouses"
          options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
        />
        <UrlSelectFilter
          paramKey="itemId"
          placeholder="All Items"
          options={items.map((i) => ({ value: i.id, label: i.name }))}
        />
      </div>
      <AdjustmentListTable data={rows} pagination={paginationMeta(total, pagination)} />
    </div>
  );
}
