import { Plus } from "lucide-react";
import { format } from "date-fns";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { paginationSchema, paginationMeta, isOneOf } from "@/lib/validators/common";
import { PageHeader } from "@/components/shared/page-header";
import { TableSearchInput } from "@/components/shared/table-search-input";
import { StatusFilterSelect } from "@/components/shared/status-filter-select";
import { ProcurementTable } from "@/components/procurement/procurement-table";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata = { title: "Procurement" };

export default async function ProcurementPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("PROCUREMENT_VIEW");
  const user = await getSessionUser();
  const params = await searchParams;

  const pagination = paginationSchema.parse({
    page: params.page,
    pageSize: params.pageSize,
  });
  const q = typeof params.q === "string" ? params.q : undefined;
  const status = typeof params.status === "string" ? params.status : undefined;

  const where: Prisma.ProcurementWhereInput = {
    ...(isOneOf(status, ["DRAFT", "SUBMITTED", "CANCELLED"] as const) ? { status } : {}),
    ...(q
      ? {
          OR: [
            { procurementNumber: { contains: q, mode: "insensitive" } },
            { supplier: { companyName: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, procurements] = await Promise.all([
    prisma.procurement.count({ where }),
    prisma.procurement.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
      select: {
        id: true,
        procurementNumber: true,
        date: true,
        status: true,
        supplier: { select: { companyName: true } },
        warehouse: { select: { name: true } },
        vehicle: { select: { vehicleNumber: true } },
        _count: { select: { items: true } },
      },
    }),
  ]);

  const canCreate = hasPermission(user, "PROCUREMENT_CREATE");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Procurement"
        description="Record produce received from suppliers and track it through unloading and sorting."
        actions={
          canCreate ? (
            <Button size="sm" asChild>
              <Link href="/procurement/new">
                <Plus className="h-4 w-4" /> New Procurement
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <TableSearchInput placeholder="Search by procurement number or supplier..." />
        <StatusFilterSelect
          options={[
            { value: "DRAFT", label: "Draft" },
            { value: "SUBMITTED", label: "Submitted" },
            { value: "CANCELLED", label: "Cancelled" },
          ]}
        />
      </div>

      <ProcurementTable
        data={procurements.map((p) => ({
          id: p.id,
          procurementNumber: p.procurementNumber,
          supplierName: p.supplier.companyName,
          warehouseName: p.warehouse.name,
          date: format(p.date, "dd MMM yyyy"),
          vehicleNumber: p.vehicle?.vehicleNumber ?? null,
          itemCount: p._count.items,
          status: p.status,
        }))}
        pagination={paginationMeta(total, pagination)}
      />
    </div>
  );
}
