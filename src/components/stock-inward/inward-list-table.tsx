"use client";

import Link from "next/link";
import { format } from "date-fns";
import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { DataTable, type PaginationMeta } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";

export type InwardRow = {
  id: string;
  inwardNumber: string;
  date: string;
  supplierName: string | null;
  warehouseName: string;
  status: string;
  itemCount: number;
  receivedByName: string;
};

const columns: ColumnDef<InwardRow>[] = [
  {
    accessorKey: "inwardNumber",
    header: "Inward #",
    cell: ({ row }) => (
      <Link href={`/stock/inward/${row.original.id}`} className="font-medium hover:underline">
        {row.original.inwardNumber}
      </Link>
    ),
  },
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => format(new Date(row.original.date), "dd MMM yyyy"),
  },
  {
    accessorKey: "supplierName",
    header: "Supplier",
    cell: ({ row }) => row.original.supplierName ?? "—",
  },
  { accessorKey: "warehouseName", header: "Warehouse" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  { accessorKey: "itemCount", header: "Items" },
  { accessorKey: "receivedByName", header: "Created / Received By" },
];

export function InwardListTable({
  data,
  pagination,
}: {
  data: InwardRow[];
  pagination: PaginationMeta;
}) {
  return (
    <DataTable
      columns={columns}
      data={data}
      pagination={pagination}
      emptyTitle="No stock inward records found."
      emptyDescription="Create a new inward to receive stock from a supplier or purchase order."
    />
  );
}
