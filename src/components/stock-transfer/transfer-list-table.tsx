"use client";

import Link from "next/link";
import { format } from "date-fns";
import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { ArrowRight } from "lucide-react";
import { DataTable, type PaginationMeta } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";

export type TransferRow = {
  id: string;
  transferNumber: string;
  sourceWarehouseName: string;
  destWarehouseName: string;
  status: string;
  dispatchDate: string | null;
  receivedDate: string | null;
  itemCount: number;
};

const columns: ColumnDef<TransferRow>[] = [
  {
    accessorKey: "transferNumber",
    header: "Transfer #",
    cell: ({ row }) => (
      <Link href={`/stock/transfer/${row.original.id}`} className="font-medium hover:underline">
        {row.original.transferNumber}
      </Link>
    ),
  },
  {
    id: "route",
    header: "Source -> Destination",
    cell: ({ row }) => (
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        {row.original.sourceWarehouseName}
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        {row.original.destWarehouseName}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "dispatchDate",
    header: "Dispatched",
    cell: ({ row }) => (row.original.dispatchDate ? format(new Date(row.original.dispatchDate), "dd MMM yyyy") : "—"),
  },
  {
    accessorKey: "receivedDate",
    header: "Received",
    cell: ({ row }) => (row.original.receivedDate ? format(new Date(row.original.receivedDate), "dd MMM yyyy") : "—"),
  },
  {
    accessorKey: "itemCount",
    header: "Items",
    cell: ({ row }) => <span className="tabular-nums">{row.original.itemCount}</span>,
  },
];

export function TransferListTable({ data, pagination }: { data: TransferRow[]; pagination: PaginationMeta }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      pagination={pagination}
      emptyTitle="No stock transfers found."
      emptyDescription="Create a new transfer to move stock between warehouses."
    />
  );
}
