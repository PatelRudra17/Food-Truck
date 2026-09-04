"use client";

import { useMemo } from "react";
import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { format } from "date-fns";
import { DataTable, type PaginationMeta } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { WASTE_REASON_LABELS } from "@/lib/validators/wastage";

export type WastageRow = {
  id: string;
  wastageNumber: string;
  date: string;
  stage: string;
  itemName: string;
  itemUnit: string;
  warehouseName: string | null;
  batchNumber: string | null;
  quantity: number;
  reason: string;
  disposalMethod: string | null;
  recordedByName: string;
  approvalDecision: "PENDING" | "APPROVED" | "REJECTED" | null;
};

export function WastageTable({ rows, pagination }: { rows: WastageRow[]; pagination: PaginationMeta }) {
  const columns = useMemo<ColumnDef<WastageRow>[]>(
    () => [
      { accessorKey: "wastageNumber", header: "Wastage #" },
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => format(new Date(row.original.date), "dd MMM yyyy"),
      },
      {
        id: "stage",
        header: "Stage",
        cell: ({ row }) => <StatusBadge status={row.original.stage} />,
      },
      { accessorKey: "itemName", header: "Item" },
      {
        accessorKey: "warehouseName",
        header: "Warehouse",
        cell: ({ row }) => row.original.warehouseName ?? "—",
      },
      {
        accessorKey: "batchNumber",
        header: "Batch",
        cell: ({ row }) => row.original.batchNumber ?? "—",
      },
      {
        accessorKey: "quantity",
        header: "Quantity",
        cell: ({ row }) => `${row.original.quantity.toLocaleString()} ${row.original.itemUnit}`,
      },
      {
        accessorKey: "reason",
        header: "Reason",
        cell: ({ row }) => WASTE_REASON_LABELS[row.original.reason] ?? row.original.reason,
      },
      {
        accessorKey: "disposalMethod",
        header: "Disposal Method",
        cell: ({ row }) => row.original.disposalMethod ?? "—",
      },
      { accessorKey: "recordedByName", header: "Recorded By" },
      {
        id: "approvalDecision",
        header: "Review",
        cell: ({ row }) =>
          row.original.approvalDecision ? <StatusBadge status={row.original.approvalDecision} /> : "—",
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      pagination={pagination}
      emptyTitle="No wastage records found."
      emptyDescription="Sorting-floor waste and warehouse disposals will appear here."
    />
  );
}
