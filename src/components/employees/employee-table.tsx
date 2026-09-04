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
import { archiveEmployeeAction } from "@/lib/actions/employee-actions";

export type EmployeeRow = {
  id: string;
  employeeCode: string;
  name: string;
  mobile: string;
  department: string | null;
  roleTitle: string | null;
  status: string;
  joiningDate: string | null;
  shiftName: string | null;
};

export function EmployeeTable({
  data,
  pagination,
  canArchive,
}: {
  data: EmployeeRow[];
  pagination: PaginationMeta;
  canArchive: boolean;
}) {
  const router = useRouter();

  const columns = useMemo<ColumnDef<EmployeeRow>[]>(
    () => [
      { accessorKey: "employeeCode", header: "Code" },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <Link href={`/employees/${row.original.id}`} className="font-medium hover:underline">
            {row.original.name}
          </Link>
        ),
      },
      { accessorKey: "mobile", header: "Mobile" },
      {
        accessorKey: "department",
        header: "Department",
        cell: ({ row }) => row.original.department ?? "—",
      },
      {
        accessorKey: "roleTitle",
        header: "Role",
        cell: ({ row }) => row.original.roleTitle ?? "—",
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
      {
        accessorKey: "joiningDate",
        header: "Joining Date",
        cell: ({ row }) =>
          row.original.joiningDate ? format(new Date(row.original.joiningDate), "dd MMM yyyy") : "—",
      },
      ...(canArchive
        ? [
            {
              id: "actions",
              header: "",
              cell: ({ row }: { row: { original: EmployeeRow } }) => (
                <div onClick={(e) => e.stopPropagation()}>
                  {row.original.status !== "INACTIVE" && (
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="icon-sm" title="Archive">
                          <Archive className="h-4 w-4" />
                        </Button>
                      }
                      title="Archive this employee?"
                      description="This sets the employee status to Inactive."
                      confirmLabel="Archive"
                      destructive
                      onConfirm={() => archiveEmployeeAction(row.original.id)}
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
      emptyTitle="No employees found."
      emptyDescription="Try adjusting your filters or add a new employee."
    />
  );
}
