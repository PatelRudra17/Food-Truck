"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { Archive } from "lucide-react";
import { DataTable, type PaginationMeta } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { archiveDriverAction } from "@/lib/actions/driver-actions";

export type DriverRow = {
  id: string;
  employeeId: string | null;
  fullName: string;
  mobile: string;
  status: string;
  joiningDate: string | null;
};

export function DriverTable({
  data,
  pagination,
  canArchive,
}: {
  data: DriverRow[];
  pagination: PaginationMeta;
  canArchive: boolean;
}) {
  const router = useRouter();

  const columns = useMemo<ColumnDef<DriverRow>[]>(
    () => [
      {
        accessorKey: "employeeId",
        header: "Employee ID",
        cell: ({ row }) => row.original.employeeId ?? "—",
      },
      {
        accessorKey: "fullName",
        header: "Full Name",
        cell: ({ row }) => (
          <Link href={`/drivers/${row.original.id}`} className="font-medium hover:underline">
            {row.original.fullName}
          </Link>
        ),
      },
      { accessorKey: "mobile", header: "Mobile" },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "joiningDate",
        header: "Joining Date",
        cell: ({ row }) => (row.original.joiningDate ? format(new Date(row.original.joiningDate), "dd MMM yyyy") : "—"),
      },
      ...(canArchive
        ? [
            {
              id: "actions",
              header: "",
              cell: ({ row }: { row: { original: DriverRow } }) => (
                <div onClick={(e) => e.stopPropagation()}>
                  {row.original.status !== "INACTIVE" && (
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="icon-sm" title="Archive">
                          <Archive className="h-4 w-4" />
                        </Button>
                      }
                      title="Archive this driver?"
                      description="This sets the driver status to Inactive."
                      confirmLabel="Archive"
                      destructive
                      onConfirm={() => archiveDriverAction(row.original.id)}
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
      emptyTitle="No drivers found."
      emptyDescription="Try adjusting your filters or add a new driver."
    />
  );
}
