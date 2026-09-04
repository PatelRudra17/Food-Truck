"use client";

import { useRouter } from "next/navigation";
import { type LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { DataTable, type PaginationMeta } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";

export type PurchaseOrderRow = {
  id: string;
  poNumber: string;
  supplierName: string;
  date: string;
  expectedDelivery: string | null;
  totalAmount: number;
  status: string;
};

export function PurchaseOrdersTable({
  data,
  pagination,
}: {
  data: PurchaseOrderRow[];
  pagination: PaginationMeta;
}) {
  const router = useRouter();

  const columns: ColumnDef<PurchaseOrderRow>[] = [
    { accessorKey: "poNumber", header: "PO Number" },
    { accessorKey: "supplierName", header: "Supplier" },
    { accessorKey: "date", header: "Date" },
    {
      accessorKey: "expectedDelivery",
      header: "Expected Delivery",
      cell: ({ row }) => row.original.expectedDelivery ?? "—",
    },
    {
      accessorKey: "totalAmount",
      header: "Total Amount",
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.totalAmount.toLocaleString()}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      pagination={pagination}
      onRowClick={(row) => router.push(`/purchase-orders/${row.id}`)}
      emptyTitle="No purchase orders found."
      emptyDescription="Create a purchase order to start procuring stock from a supplier."
    />
  );
}
