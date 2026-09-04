import Link from "next/link";
import { Plus } from "lucide-react";
import { OutwardStatus, type Prisma } from "@prisma/client";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { paginationSchema, paginationMeta } from "@/lib/validators/common";
import { PageHeader } from "@/components/shared/page-header";
import { TableSearchInput } from "@/components/shared/table-search-input";
import { UrlSelectFilter } from "@/components/shared/url-select-filter";
import { OutwardListTable, type OutwardRow } from "@/components/stock-outward/outward-list-table";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Stock Outward" };

export default async function StockOutwardListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission("STOCK_OUTWARD_VIEW");
  const sp = await searchParams;
  const pagination = paginationSchema.parse({ page: sp.page, pageSize: sp.pageSize });
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const warehouseId = typeof sp.warehouseId === "string" ? sp.warehouseId : undefined;
  const department = typeof sp.department === "string" ? sp.department : undefined;

  const where: Prisma.StockOutwardWhereInput = {
    ...(status ? { status: status as OutwardStatus } : {}),
    ...(warehouseId ? { warehouseId } : {}),
    ...(department ? { department } : {}),
    ...(q
      ? {
          OR: [
            { outwardNumber: { contains: q, mode: "insensitive" as const } },
            { department: { contains: q, mode: "insensitive" as const } },
            { project: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, outwards, warehouses, departments] = await Promise.all([
    prisma.stockOutward.count({ where }),
    prisma.stockOutward.findMany({
      where,
      include: { warehouse: true, requestedBy: true, approvedBy: true },
      orderBy: { createdAt: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    prisma.warehouse.findMany({ orderBy: { name: "asc" } }),
    prisma.stockOutward.findMany({
      where: { department: { not: null } },
      select: { department: true },
      distinct: ["department"],
    }),
  ]);

  const rows: OutwardRow[] = outwards.map((outward) => ({
    id: outward.id,
    outwardNumber: outward.outwardNumber,
    date: outward.date.toISOString(),
    department: outward.department,
    project: outward.project,
    warehouseName: outward.warehouse.name,
    status: outward.status,
    requestedByName: outward.requestedBy.name,
    approvedByName: outward.approvedBy?.name ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Outward"
        description="Issue stock to departments, projects and external destinations."
        actions={
          hasPermission(user, "STOCK_OUTWARD_CREATE") ? (
            <Button asChild>
              <Link href="/stock/outward/new">
                <Plus className="mr-2 h-4 w-4" /> New Outward
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <TableSearchInput placeholder="Search by outward number, department or project..." />
        <UrlSelectFilter
          paramKey="status"
          placeholder="All Statuses"
          options={Object.values(OutwardStatus).map((s) => ({ value: s, label: s }))}
        />
        <UrlSelectFilter
          paramKey="warehouseId"
          placeholder="All Warehouses"
          options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
        />
        {departments.length > 0 && (
          <UrlSelectFilter
            paramKey="department"
            placeholder="All Departments"
            options={departments
              .filter((d) => d.department)
              .map((d) => ({ value: d.department as string, label: d.department as string }))}
          />
        )}
      </div>
      <OutwardListTable data={rows} pagination={paginationMeta(total, pagination)} />
    </div>
  );
}
