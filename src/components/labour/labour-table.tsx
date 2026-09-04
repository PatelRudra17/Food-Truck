"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { Archive } from "lucide-react";
import { DataTable, type PaginationMeta } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { archiveLabourAction } from "@/lib/actions/labour-actions";

export type LabourRow = {
  id: string;
  labourCode: string;
  name: string;
  mobile: string;
  workType: string | null;
  dailyWage: number;
  status: string;
  shiftName: string | null;
};

export function LabourTable({
  data,
  pagination,
  canArchive,
}: {
  data: LabourRow[];
  pagination: PaginationMeta;
  canArchive: boolean;
}) {
  const router = useRouter();

  const columns = useMemo<ColumnDef<LabourRow>[]>(
    () => [
      { accessorKey: "labourCode", header: "Code" },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <Link href={`/labour/${row.original.id}`} className="font-medium hover:underline">
            {row.original.name}
          </Link>
        ),
      },
      { accessorKey: "mobile", header: "Mobile" },
      {
        accessorKey: "workType",
        header: "Work Type",
        cell: ({ row }) => row.original.workType ?? "—",
      },
      {
        accessorKey: "dailyWage",
        header: "Daily Wage",
        cell: ({ row }) => row.original.dailyWage.toLocaleString(),
      },
      {
        accessorKey: "shiftName",
        header: "Shift",
        cell: ({ row }) => row.original.shiftName ?? "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      ...(canArchive
        ? [
            {
              id: "actions",
              header: "",
              cell: ({ row }: { row: { original: LabourRow } }) => (
                <div onClick={(e) => e.stopPropagation()}>
                  {row.original.status !== "INACTIVE" && (
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="icon-sm" title="Archive">
                          <Archive className="h-4 w-4" />
                        </Button>
                      }
                      title="Archive this labour record?"
                      description="This sets the status to Inactive."
                      confirmLabel="Archive"
                      destructive
                      onConfirm={() => archiveLabourAction(row.original.id)}
                      onSuccess={() => router.refresh()}
                    />
                  )}
                </div>
              ),
            },
          ]
        : []),
    ],
    [canArchive, router],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      pagination={pagination}
      emptyTitle="No labour records found."
      emptyDescription="Try adjusting your filters or add a new labour record."
    />
  );
}
