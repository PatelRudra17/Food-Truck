import Link from "next/link";
import { format } from "date-fns";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guard";
import { LedgerTxnType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  REPORT_COLUMNS,
  REPORT_FILTER_CONFIG,
  REPORT_GROUPS,
  canAccessReport,
  formatExportValue,
  getReportDef,
  getReportRows,
  isReportType,
  parseReportFilters,
  type ReportType,
} from "@/lib/services/reports";
import { PageHeader } from "@/components/shared/page-header";
import { TableSearchInput } from "@/components/shared/table-search-input";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3 } from "lucide-react";

export const metadata = { title: "Reports" };

/** Plain <select> so the GET filter form submits it natively; "" means "All". */
function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={`filter-${name}`} className="text-xs text-muted-foreground">
        {label}
      </label>
      <select
        id={`filter-${name}`}
        name={name}
        defaultValue={value ?? ""}
        className="h-8 max-w-52 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission("REPORT_VIEW");
  const sp = await searchParams;
  const rawSelected = Array.isArray(sp.type) ? sp.type[0] : sp.type;
  const parsedFilters = parseReportFilters(sp);
  // On screen a page holds at most 100 rows; only the export route asks for larger pages.
  const filters = {
    ...parsedFilters,
    pageSize: parsedFilters.pageSize ? String(Math.min(100, Math.max(1, Number(parsedFilters.pageSize) || 20))) : undefined,
  };

  if (rawSelected && !isReportType(rawSelected)) notFound();
  const selected: ReportType | undefined = rawSelected && isReportType(rawSelected) ? rawSelected : undefined;
  if (selected && !canAccessReport(selected, user.permissions)) notFound();

  const report = selected ? await getReportRows(selected, filters) : null;
  const filterConfig = selected ? REPORT_FILTER_CONFIG[selected] : {};

  // Option lists only for the filters this report supports.
  const [warehouseOptions, categoryOptions, supplierOptions, itemOptions, customerOptions] = await Promise.all([
    filterConfig.warehouse
      ? prisma.warehouse.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
      : [],
    filterConfig.category
      ? prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
      : [],
    filterConfig.supplier
      ? prisma.supplier.findMany({ orderBy: { companyName: "asc" }, select: { id: true, companyName: true } })
      : [],
    filterConfig.item
      ? prisma.item.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } })
      : [],
    filterConfig.customer
      ? prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
      : [],
  ]);
  const reportDef = selected ? getReportDef(selected) : null;
  const columns = report?.columns ?? (selected ? REPORT_COLUMNS[selected] : []);

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  if (selected) params.set("type", selected);

  function pageHref(page: number) {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(page));
    next.set("pageSize", String(report?.pageSize ?? (Number(filters.pageSize) || 20)));
    return `?${next.toString()}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Run operational, stock, fleet, procurement, and compliance reports from live database data."
        actions={
          selected ? (
            <Button variant="outline" asChild>
              <a href={`/api/exports/reports?${params.toString()}`}>Export Current Report</a>
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {REPORT_GROUPS.map((group) =>
          group.reports
            .filter((reportDef) => canAccessReport(reportDef.type, user.permissions))
            .map((reportDef) => (
              <Link key={reportDef.type} href={`/reports?type=${reportDef.type}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader>
                    <CardTitle className="text-base">{reportDef.label}</CardTitle>
                    <CardDescription>{reportDef.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            )),
        )}
      </div>

      {selected && reportDef && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{reportDef.label}</CardTitle>
              <CardDescription>{reportDef.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {filterConfig.q && (
                <div className="flex flex-wrap items-center gap-2">
                  <TableSearchInput placeholder="Search report rows..." />
                </div>
              )}
              {/* Filters come from REPORT_FILTER_CONFIG, so each report shows only what it supports
                  and submitting keeps every chosen filter. */}
              <form className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="type" value={selected} />
                {filterConfig.q && filters.q && <input type="hidden" name="q" value={filters.q} />}
                {filters.userId && <input type="hidden" name="userId" value={filters.userId} />}
                {filterConfig.warehouse && (
                  <FilterSelect
                    name="warehouseId"
                    label="Warehouse"
                    value={filters.warehouseId}
                    options={warehouseOptions.map((w) => ({ value: w.id, label: w.name }))}
                  />
                )}
                {filterConfig.category && (
                  <FilterSelect
                    name="categoryId"
                    label="Category"
                    value={filters.categoryId}
                    options={categoryOptions.map((c) => ({ value: c.id, label: c.name }))}
                  />
                )}
                {filterConfig.supplier && (
                  <FilterSelect
                    name="supplierId"
                    label="Supplier"
                    value={filters.supplierId}
                    options={supplierOptions.map((s) => ({ value: s.id, label: s.companyName }))}
                  />
                )}
                {filterConfig.item && (
                  <FilterSelect
                    name="itemId"
                    label="Item"
                    value={filters.itemId}
                    options={itemOptions.map((i) => ({ value: i.id, label: i.name }))}
                  />
                )}
                {filterConfig.customer && (
                  <FilterSelect
                    name="customerId"
                    label="Customer"
                    value={filters.customerId}
                    options={customerOptions.map((c) => ({ value: c.id, label: c.name }))}
                  />
                )}
                {filterConfig.status && (
                  <FilterSelect
                    name="status"
                    label="Status"
                    value={filters.status}
                    options={filterConfig.status.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))}
                  />
                )}
                {filterConfig.ledgerType && (
                  <FilterSelect
                    name="ledgerType"
                    label="Movement"
                    value={filters.ledgerType}
                    options={Object.values(LedgerTxnType).map((t) => ({ value: t, label: t.replace(/_/g, " ") }))}
                  />
                )}
                {filterConfig.auditAction && (
                  <div className="space-y-1">
                    <label htmlFor="action" className="text-xs text-muted-foreground">
                      Action
                    </label>
                    <Input id="action" name="action" defaultValue={filters.action ?? ""} className="w-36" />
                  </div>
                )}
                {filterConfig.auditEntityType && (
                  <div className="space-y-1">
                    <label htmlFor="entityType" className="text-xs text-muted-foreground">
                      Entity Type
                    </label>
                    <Input id="entityType" name="entityType" defaultValue={filters.entityType ?? ""} className="w-36" />
                  </div>
                )}
                {filterConfig.dateRange && (
                  <>
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
                  </>
                )}
                {filterConfig.windowDays && (
                  <div className="space-y-1">
                    <label htmlFor="windowDays" className="text-xs text-muted-foreground">
                      Window Days
                    </label>
                    <Input id="windowDays" name="windowDays" type="number" defaultValue={filters.windowDays ?? "30"} />
                  </div>
                )}
                <Button type="submit" variant="outline">
                  Apply Filters
                </Button>
              </form>
            </CardContent>
          </Card>

          {!report || report.rows.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No report rows found"
              description="Try adjusting the report filters or choosing a different report."
            />
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.map((column) => (
                        <TableHead key={column.key}>{column.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.rows.map((row, index) => (
                      <TableRow key={String(row.id ?? index)}>
                        {columns.map((column) => {
                          const value = row[column.key];
                          const display =
                            value instanceof Date
                              ? format(value, "dd MMM yyyy")
                              : typeof value === "string" || typeof value === "number"
                                ? value
                                : formatExportValue(value);
                          return <TableCell key={column.key}>{display as string | number}</TableCell>;
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <p>
                  Showing {(report.page - 1) * report.pageSize + 1}–
                  {Math.min(report.page * report.pageSize, report.total)} of {report.total}
                </p>
                <div className="flex gap-2">
                  {/* `disabled` has no effect on a Link, so render a plain disabled button at the ends. */}
                  {report.page <= 1 ? (
                    <Button variant="outline" size="sm" disabled>
                      Previous
                    </Button>
                  ) : (
                    <Button asChild variant="outline" size="sm">
                      <Link href={pageHref(report.page - 1)}>Previous</Link>
                    </Button>
                  )}
                  {report.page * report.pageSize >= report.total ? (
                    <Button variant="outline" size="sm" disabled>
                      Next
                    </Button>
                  ) : (
                    <Button asChild variant="outline" size="sm">
                      <Link href={pageHref(report.page + 1)}>Next</Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
