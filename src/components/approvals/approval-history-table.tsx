"use client";

import Link from "next/link";
import { format } from "date-fns";
import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { DataTable, type PaginationMeta } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import type { ApprovalHistoryRow } from "@/lib/services/approvals";

export function ApprovalHistoryTable({ rows, pagination }: { rows: ApprovalHistoryRow[]; pagination: PaginationMeta }) {
  const columns: ColumnDef<ApprovalHistoryRow>[] = [
    {
      accessorKey: "moduleLabel",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="outline" className="border-transparent bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
          {row.original.moduleLabel}
        </Badge>
      ),
    },
    {
      accessorKey: "label",
      header: "Document",
      cell: ({ row }) =>
        row.original.href === "#" ? (
          <span>{row.original.label}</span>
        ) : (
          <Link href={row.original.href} className="font-medium hover:underline">
            {row.original.label}
          </Link>
        ),
    },
    {
      accessorKey: "summary",
      header: "Details",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.summary}</span>,
    },
    { accessorKey: "requestedByName", header: "Requested By" },
    {
      accessorKey: "requestedAt",
      header: "Requested",
      cell: ({ row }) => format(row.original.requestedAt, "dd MMM yyyy, HH:mm"),
    },
    {
      accessorKey: "decision",
      header: "Decision",
      cell: ({ row }) => <StatusBadge status={row.original.decision} />,
    },
    {
      accessorKey: "decidedByName",
      header: "Decided By",
      cell: ({ row }) => row.original.decidedByName ?? "—",
    },
    {
      accessorKey: "decidedAt",
      header: "Decided",
      cell: ({ row }) => (row.original.decidedAt ? format(row.original.decidedAt, "dd MMM yyyy, HH:mm") : "—"),
    },
    {
      accessorKey: "comment",
      header: "Comment",
      cell: ({ row }) => <span className="max-w-xs truncate text-sm">{row.original.comment ?? "—"}</span>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      pagination={pagination}
      emptyTitle="No approval history found"
      emptyDescription="Try adjusting the filters or date range."
    />
  );
}
