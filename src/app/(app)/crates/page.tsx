import { Plus } from "lucide-react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { paginationSchema, paginationMeta } from "@/lib/validators/common";
import { CRATE_STATUS_OPTIONS } from "@/lib/validators/crate";
import { checkOverdueCratesAndNotify } from "@/lib/services/crate-alerts";
import { PageHeader } from "@/components/shared/page-header";
import { TableSearchInput } from "@/components/shared/table-search-input";
import { StatusFilterSelect } from "@/components/shared/status-filter-select";
import { Button } from "@/components/ui/button";
import { CrateFormDialog } from "@/components/crates/crate-form-dialog";
import { CratesTable } from "@/components/crates/crates-table";
import { CrateKpiRow, type CrateStatusCounts } from "@/components/crates/crate-kpi-row";

export const metadata = { title: "Crates" };

function humanize(status: string) {
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export default async function CratesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("CRATE_VIEW");
  const user = await getSessionUser();
  const params = await searchParams;

  // Fire-and-forget, best-effort overdue-crate check: opportunistically runs
  // whenever someone views this list. Never allowed to break page rendering.
  void checkOverdueCratesAndNotify().catch((err) => {
    console.error("checkOverdueCratesAndNotify failed:", err);
  });

  const pagination = paginationSchema.parse({ page: params.page, pageSize: params.pageSize });
  const q = typeof params.q === "string" ? params.q : undefined;
  const status = typeof params.status === "string" ? params.status : undefined;

  const where: Prisma.CrateWhereInput = {
    ...(status ? { status: status as (typeof CRATE_STATUS_OPTIONS)[number] } : {}),
    ...(q
      ? {
          OR: [
            { crateCode: { contains: q, mode: "insensitive" } },
            { crateType: { contains: q, mode: "insensitive" } },
            { currentLocation: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, crates, customers, statusGroups] = await Promise.all([
    prisma.crate.count({ where }),
    prisma.crate.findMany({
      where,
      orderBy: { crateCode: "asc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
      include: { customer: { select: { id: true, name: true } } },
    }),
    prisma.customer.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, customerCode: true },
    }),
    prisma.crate.groupBy({ by: ["status"], _count: { status: true } }),
  ]);

  const rows = crates.map((c) => ({
    id: c.id,
    crateCode: c.crateCode,
    crateType: c.crateType,
    capacity: c.capacity,
    currentLocation: c.currentLocation,
    customerId: c.customerId,
    customerName: c.customer?.name ?? null,
    condition: c.condition,
    status: c.status,
  }));

  const counts: CrateStatusCounts = {};
  for (const g of statusGroups) {
    counts[g.status as keyof CrateStatusCounts] = g._count.status;
  }

  const canCreate = hasPermission(user, "CRATE_CREATE");
  const canEdit = hasPermission(user, "CRATE_EDIT");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Crates"
        description="Track physical crates, their current location and status."
        actions={
          canCreate ? (
            <CrateFormDialog
              customers={customers}
              trigger={
                <Button size="sm">
                  <Plus /> New Crate
                </Button>
              }
            />
          ) : undefined
        }
      />

      <CrateKpiRow counts={counts} />

      <div className="flex flex-wrap items-center gap-2">
        <TableSearchInput placeholder="Search by code, type, or location..." />
        <StatusFilterSelect
          options={CRATE_STATUS_OPTIONS.map((s) => ({ value: s, label: humanize(s) }))}
        />
      </div>

      <CratesTable data={rows} pagination={paginationMeta(total, pagination)} customers={customers} canEdit={canEdit} />
    </div>
  );
}
