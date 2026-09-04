"use client";

import Link from "next/link";
import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { DataTable, type PaginationMeta } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";

export type AdjustmentRow = {
  id: string;
  adjustmentNumber: string;
  itemName: string;
  warehouseName: string;
  currentQty: number;
  physicalQty: number;
  difference: number;
  status: string;
  reason: string;
};

const columns: ColumnDef<AdjustmentRow>[] = [
  {
    accessorKey: "adjustmentNumber",
    header: "Adjustment #",
    cell: ({ row }) => (
      <Link href={`/stock/adjustment/${row.original.id}`} className="font-medium hover:underline">
        {row.original.adjustmentNumber}
      </Link>
    ),
  },
  { accessorKey: "itemName", header: "Item" },
  { accessorKey: "warehouseName", header: "Warehouse" },
  {
    accessorKey: "currentQty",
    header: "Current Qty",
    cell: ({ row }) => <span className="tabular-nums">{row.original.currentQty.toLocaleString()}</span>,
  },
  {
    accessorKey: "physicalQty",
    header: "Physical Qty",
    cell: ({ row }) => <span className="tabular-nums">{row.original.physicalQty.toLocaleString()}</span>,
  },
  {
    accessorKey: "difference",
    header: "Difference",
    cell: ({ row }) => (
      <span
        className={cn(
          "tabular-nums font-medium",
          row.original.difference > 0 && "text-emerald-600 dark:text-emerald-400",
          row.original.difference < 0 && "text-red-600 dark:text-red-400",
        )}
      >
        {row.original.difference > 0 ? "+" : ""}
        {row.original.difference.toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "reason",
    header: "Reason",
    cell: ({ row }) => <span className="line-clamp-1 max-w-56">{row.original.reason}</span>,
  },
];

export function AdjustmentListTable({ data, pagination }: { data: AdjustmentRow[]; pagination: PaginationMeta }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      pagination={pagination}
      emptyTitle="No stock adjustments found."
      emptyDescription="Create a new adjustment to correct a stock discrepancy."
    />
  );
}
