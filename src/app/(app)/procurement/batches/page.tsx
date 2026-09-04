import { format } from "date-fns";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { paginationSchema, paginationMeta } from "@/lib/validators/common";
import { PageHeader } from "@/components/shared/page-header";
import { TableSearchInput } from "@/components/shared/table-search-input";
import { StatusFilterSelect } from "@/components/shared/status-filter-select";
import { TableFilterSelect } from "@/components/shared/table-filter-select";
import { BatchTable } from "@/components/procurement/batch-table";

export const metadata = { title: "Procurement Batches" };

export default async function ProcurementBatchesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("PROCUREMENT_VIEW");
  const params = await searchParams;

  const pagination = paginationSchema.parse({
    page: params.page,
    pageSize: params.pageSize,
  });
  const q = typeof params.q === "string" ? params.q : undefined;
  const status = typeof params.status === "string" ? params.status : undefined;
  const itemId = typeof params.itemId === "string" ? params.itemId : undefined;
  const supplierId = typeof params.supplierId === "string" ? params.supplierId : undefined;

  const where: Prisma.ProcurementBatchWhereInput = {
    ...(status
      ? { status: status as "PENDING_UNLOADING" | "PENDING_SORTING" | "SORTED" | "CLOSED" }
      : {}),
    ...(itemId ? { itemId } : {}),
    ...(supplierId ? { supplierId } : {}),
    ...(q ? { batchNumber: { contains: q, mode: "insensitive" } } : {}),
  };

  const [total, batches, items, suppliers] = await Promise.all([
    prisma.procurementBatch.count({ where }),
    prisma.procurementBatch.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
      select: {
        id: true,
        batchNumber: true,
        rawWeight: true,
        date: true,
        status: true,
        item: { select: { name: true } },
        supplier: { select: { companyName: true } },
        warehouse: { select: { name: true } },
      },
    }),
    prisma.item.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.supplier.findMany({
      where: { status: "ACTIVE" },
      orderBy: { companyName: "asc" },
      select: { id: true, companyName: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Procurement Batches"
        description="Traceable produce batches created when a procurement is submitted."
      />

      <div className="flex flex-wrap items-center gap-2">
        <TableSearchInput placeholder="Search by batch number..." />
        <StatusFilterSelect
          options={[
            { value: "PENDING_UNLOADING", label: "Pending Unloading" },
            { value: "PENDING_SORTING", label: "Pending Sorting" },
            { value: "SORTED", label: "Sorted" },
            { value: "CLOSED", label: "Closed" },
          ]}
        />
        <TableFilterSelect
          paramKey="itemId"
          placeholder="All items"
          options={items.map((i) => ({ value: i.id, label: i.name }))}
        />
        <TableFilterSelect
          paramKey="supplierId"
          placeholder="All suppliers"
          options={suppliers.map((s) => ({ value: s.id, label: s.companyName }))}
        />
      </div>

      <BatchTable
        data={batches.map((b) => ({
          id: b.id,
          batchNumber: b.batchNumber,
          itemName: b.item.name,
          supplierName: b.supplier.companyName,
          warehouseName: b.warehouse.name,
          rawWeight: Number(b.rawWeight),
          date: format(b.date, "dd MMM yyyy"),
          status: b.status,
        }))}
        pagination={paginationMeta(total, pagination)}
      />
    </div>
  );
}
