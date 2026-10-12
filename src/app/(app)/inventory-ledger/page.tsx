import Link from "next/link";
import { format } from "date-fns";
import { LedgerTxnType } from "@prisma/client";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { paginationMeta, paginationSchema } from "@/lib/validators/common";
import { parseLedgerQuery, queryLedgerPage, referenceHref } from "@/lib/services/inventory-ledger";
import { PageHeader } from "@/components/shared/page-header";
import { TableSearchInput } from "@/components/shared/table-search-input";
import { TableFilterSelect } from "@/components/shared/table-filter-select";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { ScrollText } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Inventory Ledger" };

export default async function InventoryLedgerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("INVENTORY_LEDGER_VIEW");
  const user = await getSessionUser();
  const sp = await searchParams;

  const get = (key: string) => {
    const value = sp[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const filters = parseLedgerQuery(get);
  const pagination = paginationSchema.parse({ page: get("page"), pageSize: get("pageSize") });

  const [{ rows, total }, items, warehouses] = await Promise.all([
    queryLedgerPage(filters, pagination),
    prisma.item.findMany({ select: { id: true, name: true, sku: true }, orderBy: { name: "asc" } }),
    prisma.warehouse.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const pager = paginationMeta(total, pagination);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const exportHref = `/api/exports/inventory-ledger?${params.toString()}`;

  function pageHref(page: number) {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(page));
    next.set("pageSize", String(pagination.pageSize));
    return `?${next.toString()}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Ledger"
        description="Inspect every stock movement with before/after balances and source references."
        actions={
          hasPermission(user, "INVENTORY_LEDGER_EXPORT") ? (
            <Button variant="outline" asChild>
              <a href={exportHref}>Export</a>
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <TableSearchInput placeholder="Search by reference number..." />
          <TableFilterSelect
            paramKey="itemId"
            placeholder="All items"
            options={items.map((item) => ({ value: item.id, label: `${item.name} (${item.sku})` }))}
          />
          <TableFilterSelect
            paramKey="warehouseId"
            placeholder="All warehouses"
            options={warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name }))}
          />
          <TableFilterSelect
            paramKey="transactionType"
            placeholder="All movements"
            options={Object.values(LedgerTxnType).map((type) => ({ value: type, label: type.replaceAll("_", " ") }))}
          />
        </div>

        <form className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label htmlFor="dateFrom" className="text-xs text-muted-foreground">
              From
            </label>
            <Input id="dateFrom" name="dateFrom" type="date" defaultValue={filters.dateFrom ?? ""} />
          </div>
          <div className="space-y-1">
            <label htmlFor="dateTo" className="text-xs text-muted-foreground">
              To
            </label>
            <Input id="dateTo" name="dateTo" type="date" defaultValue={filters.dateTo ?? ""} />
          </div>
          {filters.q && <input type="hidden" name="q" value={filters.q} />}
          {filters.itemId && <input type="hidden" name="itemId" value={filters.itemId} />}
          {filters.warehouseId && <input type="hidden" name="warehouseId" value={filters.warehouseId} />}
          {filters.transactionType && <input type="hidden" name="transactionType" value={filters.transactionType} />}
          <Button type="submit" variant="outline">
            Apply Dates
          </Button>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No ledger entries found"
          description="Try adjusting the filters or perform stock movements to populate the ledger."
        />
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Before</TableHead>
                  <TableHead className="text-right">Movement</TableHead>
                  <TableHead className="text-right">After</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>User</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const href = referenceHref(row.referenceType, row.referenceId, row.referenceNumber);
                  return (
                    <TableRow key={row.id}>
                      <TableCell>{format(row.createdAt, "dd MMM yyyy, HH:mm")}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{row.item.name}</p>
                          <p className="text-xs text-muted-foreground">{row.item.sku}</p>
                        </div>
                      </TableCell>
                      <TableCell>{row.warehouse.name}</TableCell>
                      <TableCell>
                        <StatusBadge status={row.transactionType} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{Number(row.beforeQty).toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(row.quantity).toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(row.afterQty).toLocaleString()}</TableCell>
                      <TableCell>
                        {href ? (
                          <Link href={href} className="text-primary hover:underline">
                            {row.referenceNumber}
                          </Link>
                        ) : (
                          row.referenceNumber
                        )}
                      </TableCell>
                      <TableCell>{row.user.name}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>
              Showing {(pager.page - 1) * pager.pageSize + 1}–
              {Math.min(pager.page * pager.pageSize, pager.total)} of {pager.total}
            </p>
            <div className="flex gap-2">
              {/* `disabled` has no effect on a Link, so render a plain disabled button at the ends. */}
              {pager.page <= 1 ? (
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link href={pageHref(pager.page - 1)}>Previous</Link>
                </Button>
              )}
              {pager.page >= pager.pageCount ? (
                <Button variant="outline" size="sm" disabled>
                  Next
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link href={pageHref(pager.page + 1)}>Next</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
