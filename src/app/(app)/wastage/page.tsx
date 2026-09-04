import { Prisma, WastageReason, WastageStage } from "@prisma/client";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { paginationSchema, paginationMeta } from "@/lib/validators/common";
import { WastageTable } from "@/components/wastage/wastage-table";
import { WastageFilters } from "@/components/wastage/wastage-filters";
import { RecordWastageDialog } from "@/components/wastage/record-wastage-dialog";

export const metadata = { title: "Wastage" };

export default async function WastagePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("WASTAGE_VIEW");
  const user = await getSessionUser();
  const sp = await searchParams;
  const get = (key: string) => {
    const v = sp[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const pagination = paginationSchema.parse({ page: get("page"), pageSize: get("pageSize") });
  const stage = get("stage") || "";
  const reason = get("reason") || "";
  const itemId = get("itemId") || "";
  const dateFrom = get("dateFrom") || "";
  const dateTo = get("dateTo") || "";

  const where: Prisma.WastageWhereInput = {
    ...(stage ? { stage: stage as WastageStage } : {}),
    ...(reason ? { reason: reason as WastageReason } : {}),
    ...(itemId ? { itemId } : {}),
    ...(dateFrom || dateTo
      ? {
          date: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59`) } : {}),
          },
        }
      : {}),
  };

  const [total, records, items, warehouses] = await Promise.all([
    prisma.wastage.count({ where }),
    prisma.wastage.findMany({
      where,
      include: {
        item: { select: { name: true, unit: true } },
        warehouse: { select: { name: true } },
        batch: { select: { batchNumber: true } },
        recordedBy: { select: { name: true } },
        approvals: { orderBy: { requestedAt: "desc" }, take: 1, select: { decision: true } },
      },
      orderBy: { date: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    prisma.item.findMany({ select: { id: true, name: true, unit: true, warehouseId: true }, orderBy: { name: "asc" } }),
    prisma.warehouse.findMany({ select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
  ]);

  const rows = records.map((r) => ({
    id: r.id,
    wastageNumber: r.wastageNumber,
    date: r.date.toISOString(),
    stage: r.stage,
    itemName: r.item.name,
    itemUnit: r.item.unit,
    warehouseName: r.warehouse?.name ?? null,
    batchNumber: r.batch?.batchNumber ?? null,
    quantity: Number(r.quantity),
    reason: r.reason,
    disposalMethod: r.disposalMethod,
    recordedByName: r.recordedBy.name,
    approvalDecision: r.approvals[0]?.decision ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wastage"
        description="Sorting-floor waste (recorded automatically during grading) and manual warehouse disposals."
        actions={
          hasPermission(user, "WASTAGE_CREATE") ? (
            <RecordWastageDialog
              trigger={<Button>Record Disposal</Button>}
              itemOptions={items}
              warehouseOptions={warehouses}
            />
          ) : undefined
        }
      />

      <WastageFilters itemOptions={items} initial={{ itemId, dateFrom, dateTo }} />

      <WastageTable rows={rows} pagination={paginationMeta(total, pagination)} />
    </div>
  );
}
