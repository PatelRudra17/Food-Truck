"use client";

import { useRouter } from "next/navigation";
import { type LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { DataTable, type PaginationMeta } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";

export type BatchRow = {
  id: string;
  batchNumber: string;
  itemName: string;
  supplierName: string;
  warehouseName: string;
  rawWeight: number;
  date: string;
  status: string;
};

export function BatchTable({ data, pagination }: { data: BatchRow[]; pagination: PaginationMeta }) {
  const router = useRouter();

  const columns: ColumnDef<BatchRow>[] = [
    { accessorKey: "batchNumber", header: "Batch #" },
    { accessorKey: "itemName", header: "Item" },
    { accessorKey: "supplierName", header: "Supplier" },
    { accessorKey: "warehouseName", header: "Warehouse" },
    {
      accessorKey: "rawWeight",
      header: "Raw Weight (kg)",
      cell: ({ row }) => <span className="tabular-nums">{row.original.rawWeight.toLocaleString()}</span>,
    },
    { accessorKey: "date", header: "Date" },
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
      onRowClick={(row) => router.push(`/procurement/batches/${row.id}`)}
      emptyTitle="No procurement batches found."
      emptyDescription="Batches are created automatically when a procurement is submitted."
    />
  );
}
