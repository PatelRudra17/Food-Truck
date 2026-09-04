"use client";

import Link from "next/link";
import { format } from "date-fns";
import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { ApprovalActionButtons } from "@/components/approvals/approval-action-buttons";
import type { PendingApproval } from "@/lib/services/approvals";

export function PendingApprovalsTable({ rows }: { rows: PendingApproval[] }) {
  const columns: ColumnDef<PendingApproval>[] = [
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
      cell: ({ row }) => (
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
    { accessorKey: "requestedByName", header: "Requester" },
    {
      accessorKey: "requestedAt",
      header: "Requested",
      cell: ({ row }) => format(row.original.requestedAt, "dd MMM yyyy, HH:mm"),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) =>
        row.original.actionable ? (
          <ApprovalActionButtons kind={row.original.kind} entityId={row.original.entityId} label={row.original.label} />
        ) : (
          <span className="text-xs text-muted-foreground">No approval action available</span>
        ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyTitle="No pending approvals."
      emptyDescription="Everything requiring approval has been decided."
    />
  );
}
