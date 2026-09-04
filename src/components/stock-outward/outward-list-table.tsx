"use client";

import Link from "next/link";
import { format } from "date-fns";
import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { DataTable, type PaginationMeta } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";

export type OutwardRow = {
  id: string;
  outwardNumber: string;
  date: string;
  department: string | null;
  project: string | null;
  warehouseName: string;
  status: string;
  requestedByName: string;
  approvedByName: string | null;
};

const columns: ColumnDef<OutwardRow>[] = [
  {
    accessorKey: "outwardNumber",
    header: "Outward #",
    cell: ({ row }) => (
      <Link href={`/stock/outward/${row.original.id}`} className="font-medium hover:underline">
        {row.original.outwardNumber}
      </Link>
    ),
  },
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => format(new Date(row.original.date), "dd MMM yyyy"),
  },
  {
    accessorKey: "department",
    header: "Department / Project",
    cell: ({ row }) =>
      [row.original.department, row.original.project].filter(Boolean).join(" / ") || "—",
  },
  { accessorKey: "warehouseName", header: "Warehouse" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  { accessorKey: "requestedByName", header: "Requested By" },
  {
    accessorKey: "approvedByName",
    header: "Approved By",
    cell: ({ row }) => row.original.approvedByName ?? "—",
  },
];

export function OutwardListTable({
  data,
  pagination,
}: {
  data: OutwardRow[];
  pagination: PaginationMeta;
}) {
  return (
    <DataTable
      columns={columns}
      data={data}
      pagination={pagination}
      emptyTitle="No stock outward records found."
      emptyDescription="Create a new outward request to issue stock to a department or project."
    />
  );
}
