import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { PageHeader } from "@/components/shared/page-header";
import { TableSearchInput } from "@/components/shared/table-search-input";
import { TableFilterSelect } from "@/components/shared/table-filter-select";
import { paginationMeta, paginationSchema } from "@/lib/validators/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { History } from "lucide-react";

export const metadata = { title: "Audit Log" };

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("VIEW_AUDIT_LOG");
  const sp = await searchParams;

  const get = (key: string) => {
    const value = sp[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const pagination = paginationSchema.parse({ page: get("page"), pageSize: get("pageSize") });
  const q = get("q")?.trim() || "";
  const action = get("action") || "";
  const entityType = get("entityType") || "";
  const userId = get("userId") || "";
  const dateFrom = get("dateFrom") || "";
  const dateTo = get("dateTo") || "";

  const where = {
    ...(q
      ? {
          OR: [
            { entityType: { contains: q, mode: "insensitive" as const } },
            { entityId: { contains: q, mode: "insensitive" as const } },
            { action: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(action ? { action } : {}),
    ...(entityType ? { entityType } : {}),
    ...(userId ? { userId } : {}),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00.000`) } : {}),
            ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999`) } : {}),
          },
        }
      : {}),
  };

  const [total, rows, users, actions, entityTypes] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    prisma.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
  ]);

  const pager = paginationMeta(total, pagination);
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (action) params.set("action", action);
  if (entityType) params.set("entityType", entityType);
  if (userId) params.set("userId", userId);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);

  function pageHref(page: number) {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(page));
    next.set("pageSize", String(pagination.pageSize));
    return `?${next.toString()}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Review immutable activity history across authentication, exports, settings, and business workflows."
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <TableSearchInput placeholder="Search action, entity type, or entity ID..." />
          <TableFilterSelect
            paramKey="action"
            placeholder="All actions"
            options={actions.map((row) => ({ value: row.action, label: row.action.replaceAll("_", " ") }))}
          />
          <TableFilterSelect
            paramKey="entityType"
            placeholder="All entities"
            options={entityTypes.map((row) => ({ value: row.entityType, label: row.entityType }))}
          />
          <TableFilterSelect
            paramKey="userId"
            placeholder="All users"
            options={users.map((user) => ({ value: user.id, label: user.name }))}
          />
        </div>

        <form className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label htmlFor="dateFrom" className="text-xs text-muted-foreground">
              From
            </label>
            <Input id="dateFrom" name="dateFrom" type="date" defaultValue={dateFrom} />
          </div>
          <div className="space-y-1">
            <label htmlFor="dateTo" className="text-xs text-muted-foreground">
              To
            </label>
            <Input id="dateTo" name="dateTo" type="date" defaultValue={dateTo} />
          </div>
          {q && <input type="hidden" name="q" value={q} />}
          {action && <input type="hidden" name="action" value={action} />}
          {entityType && <input type="hidden" name="entityType" value={entityType} />}
          {userId && <input type="hidden" name="userId" value={userId} />}
          <Button type="submit" variant="outline">
            Apply Dates
          </Button>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={History}
          title="No audit entries found"
          description="Try widening the date range or removing some filters."
        />
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Entity ID</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Changes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{format(row.createdAt, "dd MMM yyyy, HH:mm:ss")}</TableCell>
                    <TableCell>{row.user?.name ?? "System"}</TableCell>
                    <TableCell>{row.action.replaceAll("_", " ")}</TableCell>
                    <TableCell>{row.entityType}</TableCell>
                    <TableCell>{row.entityId ?? "—"}</TableCell>
                    <TableCell>{row.ipAddress ?? "—"}</TableCell>
                    <TableCell className="max-w-xs">
                      <div className="space-y-1 text-xs">
                        {row.oldValues && (
                          <pre className="overflow-auto rounded bg-muted p-2">{JSON.stringify(row.oldValues, null, 2)}</pre>
                        )}
                        {row.newValues && (
                          <pre className="overflow-auto rounded bg-muted p-2">{JSON.stringify(row.newValues, null, 2)}</pre>
                        )}
                        {!row.oldValues && !row.newValues && "—"}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>
              Showing {(pager.page - 1) * pager.pageSize + 1}–
              {Math.min(pager.page * pager.pageSize, pager.total)} of {pager.total}
            </p>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" disabled={pager.page <= 1}>
                <Link href={pageHref(pager.page - 1)}>Previous</Link>
              </Button>
              <Button asChild variant="outline" size="sm" disabled={pager.page >= pager.pageCount}>
                <Link href={pageHref(pager.page + 1)}>Next</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
