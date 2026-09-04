"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { format } from "date-fns";
import { DataTable, type PaginationMeta } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { AssignSupervisorDialog } from "@/components/shifts/assign-supervisor-dialog";
import { closeShiftAction, reopenShiftAction } from "@/lib/actions/shift-actions";

export type ShiftRow = {
  id: string;
  shiftName: string;
  date: string;
  startTime: string;
  endTime: string;
  supervisorId: string | null;
  supervisorName: string | null;
  status: string;
  staffCount: number;
};

type Option = { id: string; label: string };

export function ShiftTable({
  rows,
  pagination,
  canEdit,
  supervisorOptions,
}: {
  rows: ShiftRow[];
  pagination: PaginationMeta;
  canEdit: boolean;
  supervisorOptions: Option[];
}) {
  const columns = useMemo<ColumnDef<ShiftRow>[]>(
    () => [
      { accessorKey: "shiftName", header: "Shift" },
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => format(new Date(row.original.date), "dd MMM yyyy"),
      },
      {
        id: "time",
        header: "Time",
        cell: ({ row }) =>
          `${format(new Date(row.original.startTime), "HH:mm")} – ${format(new Date(row.original.endTime), "HH:mm")}`,
      },
      {
        accessorKey: "supervisorName",
        header: "Supervisor",
        cell: ({ row }) => row.original.supervisorName ?? "Unassigned",
      },
      {
        accessorKey: "staffCount",
        header: "Staff",
        cell: ({ row }) => row.original.staffCount.toLocaleString(),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1.5">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/operations/shifts/handover?shiftId=${row.original.id}`}>Handover</Link>
            </Button>
            {canEdit && (
              <>
                <AssignSupervisorDialog
                  shiftId={row.original.id}
                  currentSupervisorId={row.original.supervisorId}
                  supervisorOptions={supervisorOptions}
                  trigger={
                    <Button variant="ghost" size="sm">
                      Supervisor
                    </Button>
                  }
                />
                {row.original.status === "ACTIVE" ? (
                  <ConfirmDialog
                    trigger={
                      <Button variant="outline" size="sm">
                        Close
                      </Button>
                    }
                    title="Close shift"
                    description="This shift will be marked closed. It can be reopened later if needed."
                    confirmLabel="Close shift"
                    onConfirm={() => closeShiftAction(row.original.id)}
                  />
                ) : (
                  <ConfirmDialog
                    trigger={
                      <Button variant="outline" size="sm">
                        Reopen
                      </Button>
                    }
                    title="Reopen shift"
                    description="This shift will be marked active again."
                    confirmLabel="Reopen shift"
                    onConfirm={() => reopenShiftAction(row.original.id)}
                  />
                )}
              </>
            )}
          </div>
        ),
      },
    ],
    [canEdit, supervisorOptions],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      pagination={pagination}
      emptyTitle="No shifts found."
      emptyDescription="Create a shift to start scheduling supervisors and staff."
    />
  );
}
