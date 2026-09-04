import Link from "next/link";
import { Plus, Download, Upload } from "lucide-react";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { TableSearchInput } from "@/components/shared/table-search-input";
import { Button } from "@/components/ui/button";
import { paginationSchema, paginationMeta } from "@/lib/validators/common";
import { buildItemOrderBy, buildItemWhere, parseItemListParams } from "@/lib/queries/item-list";
import { ItemFilters } from "@/components/items/item-filters";
import { ItemsTable } from "@/components/items/items-table";
import { BulkImportDialog } from "@/components/items/bulk-import-dialog";

export const metadata = { title: "Item Master" };

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("ITEM_VIEW");
  const user = await getSessionUser();
  const sp = await searchParams;

  const listParams = parseItemListParams(sp);
  const pagination = paginationSchema.parse({ page: sp.page, pageSize: sp.pageSize });
  const where = buildItemWhere(listParams);
  const orderBy = buildItemOrderBy(listParams);

  const [items, total, categories, warehouses] = await Promise.all([
    prisma.item.findMany({
      where,
      orderBy,
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
      include: { category: true, warehouse: true },
    }),
    prisma.item.count({ where }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.warehouse.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
  ]);

  const rows = items.map((i) => ({
    id: i.id,
    sku: i.sku,
    itemCode: i.itemCode,
    name: i.name,
    categoryName: i.category.name,
    warehouseName: i.warehouse?.name ?? null,
    currentStock: Number(i.currentStock),
    reorderLevel: Number(i.reorderLevel),
    unit: i.unit,
    isActive: i.isActive,
  }));

  const exportHref = `/api/exports/items?${new URLSearchParams(
    Object.entries(listParams).filter(([, v]) => v !== undefined) as [string, string][],
  ).toString()}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Item Master"
        description="Search, filter and manage every item in the catalog."
        actions={
          <>
            {hasPermission(user, "ITEM_EXPORT") && (
              <Button variant="outline" size="sm" asChild>
                <a href={exportHref}>
                  <Download /> Export
                </a>
              </Button>
            )}
            {hasPermission(user, "ITEM_CREATE") && <BulkImportDialog />}
            {hasPermission(user, "ITEM_CREATE") && (
              <Button size="sm" asChild>
                <Link href="/items/new">
                  <Plus /> New Item
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TableSearchInput placeholder="Search by name, SKU, item code or barcode..." />
        <ItemFilters categories={categories} warehouses={warehouses} />
      </div>

      <ItemsTable items={rows} pagination={paginationMeta(total, pagination)} />
    </div>
  );
}
