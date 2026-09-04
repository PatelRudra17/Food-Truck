"use client";

import { useMemo } from "react";
import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { format } from "date-fns";
import { Paperclip } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type PaginationMeta } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { ArchiveMaintenanceDialog } from "@/components/maintenance/archive-maintenance-dialog";
import { getMaintenanceAttachmentUrlAction } from "@/lib/actions/maintenance-actions";
import { MAINTENANCE_TYPE_LABELS } from "@/lib/validators/maintenance";

export type MaintenanceRow = {
  id: string;
  serviceDate: string;
  vehicleNumber: string;
  maintenanceType: string;
  serviceCenterVendor: string | null;
  odometerKm: number;
  totalCost: number;
  maintenanceState: string;
  isArchived: boolean;
  hasAttachment: boolean;
  attachmentId: string | null;
};

async function openAttachment(attachmentId: string) {
  const result = await getMaintenanceAttachmentUrlAction(attachmentId);
  if (result.ok) {
    window.open(result.data.url, "_blank", "noopener,noreferrer");
  } else {
    toast.error(result.error);
  }
}

export function MaintenanceTable({
  rows,
  pagination,
  canArchive,
}: {
  rows: MaintenanceRow[];
  pagination: PaginationMeta;
  canArchive: boolean;
}) {
  const columns = useMemo<ColumnDef<MaintenanceRow>[]>(
    () => [
      {
        accessorKey: "serviceDate",
        header: "Service Date",
        cell: ({ row }) => format(new Date(row.original.serviceDate), "dd MMM yyyy"),
      },
      { accessorKey: "vehicleNumber", header: "Vehicle" },
      {
        accessorKey: "maintenanceType",
        header: "Type",
        cell: ({ row }) => MAINTENANCE_TYPE_LABELS[row.original.maintenanceType] ?? row.original.maintenanceType,
      },
      {
        accessorKey: "serviceCenterVendor",
        header: "Service Center",
        cell: ({ row }) => row.original.serviceCenterVendor ?? "—",
      },
      {
        accessorKey: "odometerKm",
        header: "Odometer",
        cell: ({ row }) => `${row.original.odometerKm.toLocaleString()} km`,
      },
      {
        accessorKey: "totalCost",
        header: "Total Cost",
        cell: ({ row }) => `₹${row.original.totalCost.toLocaleString()}`,
      },
      {
        id: "vehicleState",
        header: "Vehicle Status",
        cell: ({ row }) => <StatusBadge status={row.original.maintenanceState} />,
      },
      {
        id: "flags",
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            {row.original.isArchived && (
              <StatusBadge status="INACTIVE" className="text-xs" />
            )}
            {row.original.hasAttachment && row.original.attachmentId && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-1.5 text-xs"
                onClick={() => openAttachment(row.original.attachmentId!)}
              >
                <Paperclip className="h-3 w-3" /> Invoice
              </Button>
            )}
          </div>
        ),
      },
      ...(canArchive
        ? [
            {
              id: "actions",
              header: "",
              cell: ({ row }: { row: { original: MaintenanceRow } }) =>
                !row.original.isArchived && (
                  <ArchiveMaintenanceDialog
                    maintenanceId={row.original.id}
                    trigger={
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                        Archive
                      </Button>
                    }
                  />
                ),
            } as ColumnDef<MaintenanceRow>,
          ]
        : []),
    ],
    [canArchive],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      pagination={pagination}
      emptyTitle="No maintenance records found."
      emptyDescription="Log a maintenance record to start tracking service history."
    />
  );
}
