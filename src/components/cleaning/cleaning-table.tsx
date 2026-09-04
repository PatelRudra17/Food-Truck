"use client";

import { useMemo } from "react";
import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { format } from "date-fns";
import { DataTable, type PaginationMeta } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CleaningEditDialog } from "@/components/cleaning/cleaning-edit-dialog";
import { advanceCleaningStatusAction } from "@/lib/actions/cleaning-actions";
import { CLEANING_ENTITY_TYPE_LABELS, type CleaningEntityType } from "@/lib/validators/cleaning";

export type CleaningRow = {
  id: string;
  entityType: CleaningEntityType;
  subject: string;
  cleaningType: string | null;
  staffId: string | null;
  staffName: string | null;
  startTime: string | null;
  endTime: string | null;
  status: string;
  remarks: string | null;
};

type Option = { id: string; label: string };

const NEXT_ACTION_LABEL: Record<string, string> = {
  PENDING: "Start",
  IN_PROGRESS: "Complete",
};

export function CleaningTable({
  rows,
  pagination,
  canEdit,
  staffOptions,
}: {
  rows: CleaningRow[];
  pagination: PaginationMeta;
  canEdit: boolean;
  staffOptions: Option[];
}) {
  const columns = useMemo<ColumnDef<CleaningRow>[]>(
    () => [
      {
        id: "entity",
        header: "Cleaning subject",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.subject}</p>
            <p className="text-xs text-muted-foreground">{CLEANING_ENTITY_TYPE_LABELS[row.original.entityType]}</p>
          </div>
        ),
      },
      {
        accessorKey: "cleaningType",
        header: "Type",
        cell: ({ row }) => row.original.cleaningType ?? "—",
      },
      {
        accessorKey: "staffName",
        header: "Staff",
        cell: ({ row }) => row.original.staffName ?? "Unassigned",
      },
      {
        accessorKey: "startTime",
        header: "Start",
        cell: ({ row }) => (row.original.startTime ? format(new Date(row.original.startTime), "dd MMM yyyy HH:mm") : "—"),
      },
      {
        accessorKey: "endTime",
        header: "End",
        cell: ({ row }) => (row.original.endTime ? format(new Date(row.original.endTime), "dd MMM yyyy HH:mm") : "—"),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      ...(canEdit
        ? [
            {
              id: "actions",
              header: "",
              cell: ({ row }: { row: { original: CleaningRow } }) => {
                const nextLabel = NEXT_ACTION_LABEL[row.original.status];
                return (
                  <div className="flex items-center justify-end gap-1.5">
                    {nextLabel && (
                      <ConfirmDialog
                        trigger={
                          <Button variant="outline" size="sm">
                            {nextLabel}
                          </Button>
                        }
                        title={`${nextLabel} cleaning`}
                        description={`Mark this cleaning record as ${
                          row.original.status === "PENDING" ? "in progress" : "completed"
                        }?`}
                        confirmLabel={nextLabel}
                        onConfirm={() => advanceCleaningStatusAction(row.original.id)}
                      />
                    )}
                    <CleaningEditDialog
                      cleaningId={row.original.id}
                      staffOptions={staffOptions}
                      initial={{
                        cleaningType: row.original.cleaningType ?? "",
                        staffId: row.original.staffId ?? "",
                        remarks: row.original.remarks ?? "",
                      }}
                      trigger={
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      }
                    />
                  </div>
                );
              },
            } as ColumnDef<CleaningRow>,
          ]
        : []),
    ],
    [canEdit, staffOptions],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      pagination={pagination}
      emptyTitle="No cleaning records found."
      emptyDescription="Log a cleaning task for a vehicle, crate, or location to start tracking it."
    />
  );
}
