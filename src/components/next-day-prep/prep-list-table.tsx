"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { format } from "date-fns";
import { DataTable, type PaginationMeta } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export type PrepListRow = {
  id: string;
  date: string;
  createdByName: string;
  totalItems: number;
  completeItems: number;
  remarks: string | null;
};

export function PrepListTable({ rows, pagination }: { rows: PrepListRow[]; pagination: PaginationMeta }) {
  const columns = useMemo<ColumnDef<PrepListRow>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => format(new Date(row.original.date), "dd MMM yyyy"),
      },
      { accessorKey: "createdByName", header: "Created By" },
      {
        id: "progress",
        header: "Checklist Progress",
        cell: ({ row }) => {
          const pct = row.original.totalItems > 0 ? Math.round((row.original.completeItems / row.original.totalItems) * 100) : 0;
          return (
            <div className="flex items-center gap-2">
              <Progress value={pct} className="h-2 w-28" />
              <span className="text-xs tabular-nums text-muted-foreground">
                {row.original.completeItems}/{row.original.totalItems}
              </span>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/operations/next-day/${row.original.id}`}>View checklist</Link>
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      pagination={pagination}
      emptyTitle="No preparation checklists found."
      emptyDescription="Create tomorrow's preparation checklist to get started."
    />
  );
}
