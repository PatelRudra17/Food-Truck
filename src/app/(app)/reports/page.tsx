import Link from "next/link";
import { format } from "date-fns";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guard";
import {
  REPORT_COLUMNS,
  REPORT_GROUPS,
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

function canSeeReport(type: ReportType, permissions: string[]) {
  if (type === "audit-log") return permissions.includes("VIEW_AUDIT_LOG");
  return permissions.includes("REPORT_VIEW");
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission("REPORT_VIEW");
  const sp = await searchParams;
  const rawSelected = Array.isArray(sp.type) ? sp.type[0] : sp.type;
  const filters = parseReportFilters(sp);

  if (rawSelected && !isReportType(rawSelected)) notFound();
  const selected: ReportType | undefined = rawSelected && isReportType(rawSelected) ? rawSelected : undefined;
  if (selected === "audit-log" && !user.permissions.includes("VIEW_AUDIT_LOG")) notFound();

  const report = selected ? await getReportRows(selected, filters) : null;
  const reportDef = selected ? getReportDef(selected) : null;
  const columns = selected ? REPORT_COLUMNS[selected] : [];

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
            .filter((reportDef) => canSeeReport(reportDef.type, user.permissions))
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
              <div className="flex flex-wrap items-center gap-2">
                <TableSearchInput placeholder="Search report rows..." />
              </div>
              <form className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="type" value={selected} />
                {filters.q && <input type="hidden" name="q" value={filters.q} />}
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
                {(selected === "driver-document-expiry" || selected === "vehicle-document-expiry") && (
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
                  <Button asChild variant="outline" size="sm" disabled={report.page <= 1}>
                    <Link href={pageHref(report.page - 1)}>Previous</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" disabled={report.page * report.pageSize >= report.total}>
                    <Link href={pageHref(report.page + 1)}>Next</Link>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
