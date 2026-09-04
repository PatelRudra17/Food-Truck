import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { paginationSchema, paginationMeta } from "@/lib/validators/common";
import { PendingSortingTable } from "@/components/sorting/pending-sorting-table";

export const metadata = { title: "Sorting / Grading" };

export default async function SortingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("SORTING_VIEW");
  const user = await getSessionUser();
  const sp = await searchParams;
  const get = (key: string) => {
    const v = sp[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const pagination = paginationSchema.parse({ page: get("page"), pageSize: get("pageSize") });

  const [total, batches] = await Promise.all([
    prisma.procurementBatch.count({ where: { status: "PENDING_SORTING" } }),
    prisma.procurementBatch.findMany({
      where: { status: "PENDING_SORTING" },
      include: {
        item: { select: { name: true, unit: true } },
        supplier: { select: { companyName: true } },
        warehouse: { select: { name: true } },
      },
      orderBy: { date: "asc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
  ]);

  const rows = batches.map((b) => ({
    id: b.id,
    batchNumber: b.batchNumber,
    date: b.date.toISOString(),
    itemName: b.item.name,
    itemUnit: b.item.unit,
    supplierName: b.supplier.companyName,
    warehouseName: b.warehouse.name,
    rawWeight: Number(b.rawWeight),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sorting / Grading"
        description="Batches awaiting sorting into Grade A/B/C/Other. Wastage recorded during grading is logged automatically."
      />
      <PendingSortingTable
        rows={rows}
        pagination={paginationMeta(total, pagination)}
        canSort={hasPermission(user, "SORTING_CREATE")}
      />
    </div>
  );
}
