"use client";

import { useMemo } from "react";
import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { RejectDialog } from "@/components/shared/reject-dialog";
import { AssignItemDialog } from "@/components/next-day-prep/assign-item-dialog";
import { CompleteItemDialog } from "@/components/next-day-prep/complete-item-dialog";
import { RemarkItemDialog } from "@/components/next-day-prep/remark-item-dialog";
import { reopenChecklistItemAction } from "@/lib/actions/next-day-prep-actions";

export type ChecklistItemRow = {
  id: string;
  label: string;
  status: string;
  assignedToId: string | null;
  assignedToName: string | null;
  remark: string | null;
};

type Option = { id: string; label: string };

export function ChecklistTable({
  rows,
  canEdit,
  userOptions,
}: {
  rows: ChecklistItemRow[];
  canEdit: boolean;
  userOptions: Option[];
}) {
  const columns = useMemo<ColumnDef<ChecklistItemRow>[]>(
    () => [
      { accessorKey: "label", header: "Checklist item" },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "assignedToName",
        header: "Assigned To",
        cell: ({ row }) => row.original.assignedToName ?? "Unassigned",
      },
      {
        accessorKey: "remark",
        header: "Remark",
        cell: ({ row }) => row.original.remark ?? "—",
      },
      ...(canEdit
        ? [
            {
              id: "actions",
              header: "",
              cell: ({ row }: { row: { original: ChecklistItemRow } }) => (
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <AssignItemDialog
                    itemId={row.original.id}
                    itemLabel={row.original.label}
                    currentAssignedToId={row.original.assignedToId}
                    userOptions={userOptions}
                    trigger={
                      <Button variant="ghost" size="sm">
                        Assign
                      </Button>
                    }
                  />
                  {row.original.status !== "COMPLETE" && (
                    <CompleteItemDialog
                      itemId={row.original.id}
                      itemLabel={row.original.label}
                      trigger={
                        <Button variant="outline" size="sm">
                          Complete
                        </Button>
                      }
                    />
                  )}
                  {row.original.status === "COMPLETE" && (
                    <RejectDialog
                      trigger={
                        <Button variant="outline" size="sm">
                          Reopen
                        </Button>
                      }
                      title="Reopen checklist item"
                      description={row.original.label}
                      confirmLabel="Reopen"
                      successMessage="Item reopened."
                      reasonPlaceholder="Explain why this item is being reopened..."
                      onConfirm={(reason) => reopenChecklistItemAction({ itemId: row.original.id, reason })}
                    />
                  )}
                  <RemarkItemDialog
                    itemId={row.original.id}
                    itemLabel={row.original.label}
                    currentRemark={row.original.remark ?? ""}
                    trigger={
                      <Button variant="ghost" size="sm">
                        Remark
                      </Button>
                    }
                  />
                </div>
              ),
            } as ColumnDef<ChecklistItemRow>,
          ]
        : []),
    ],
    [canEdit, userOptions],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyTitle="No checklist items."
      emptyDescription="This preparation has no checklist items."
    />
  );
}
