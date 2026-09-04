"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { Archive } from "lucide-react";
import { DataTable, type PaginationMeta } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ExpiryDot } from "@/components/shared/expiry-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { archiveVehicleAction } from "@/lib/actions/vehicle-actions";
import type { ExpiryStatus } from "@/lib/expiry";

export type VehicleRow = {
  id: string;
  vehicleNumber: string;
  vehicleType: string;
  manufacturer: string | null;
  model: string | null;
  status: string;
  currentDriverName: string | null;
  documentFlag: ExpiryStatus;
};

const FLAG_LABEL: Record<ExpiryStatus, string> = {
  EXPIRED: "One or more key documents have expired",
  DUE_SOON: "One or more key documents expire within 30 days",
  VALID: "All key documents valid",
  NONE: "No document dates on file",
};

export function VehicleTable({
  data,
  pagination,
  canArchive,
}: {
  data: VehicleRow[];
  pagination: PaginationMeta;
  canArchive: boolean;
}) {
  const router = useRouter();

  const columns = useMemo<ColumnDef<VehicleRow>[]>(
    () => [
      {
        accessorKey: "vehicleNumber",
        header: "Vehicle Number",
        cell: ({ row }) => (
          <Link href={`/vehicles/${row.original.id}`} className="font-medium hover:underline">
            {row.original.vehicleNumber}
          </Link>
        ),
      },
      { accessorKey: "vehicleType", header: "Type" },
      {
        id: "manufacturerModel",
        header: "Manufacturer / Model",
        cell: ({ row }) =>
          [row.original.manufacturer, row.original.model].filter(Boolean).join(" / ") || "—",
      },
      {
        accessorKey: "currentDriverName",
        header: "Current Driver",
        cell: ({ row }) => row.original.currentDriverName ?? "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "documentFlag",
        header: "Documents",
        cell: ({ row }) =>
          row.original.documentFlag === "NONE" ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1.5">
                  <ExpiryDot status={row.original.documentFlag} />
                  <span className="text-xs text-muted-foreground">
                    {row.original.documentFlag === "EXPIRED" ? "Expired" : row.original.documentFlag === "DUE_SOON" ? "Expiring soon" : "Valid"}
                  </span>
                </span>
              </TooltipTrigger>
              <TooltipContent>{FLAG_LABEL[row.original.documentFlag]}</TooltipContent>
            </Tooltip>
          ),
      },
      ...(canArchive
        ? [
            {
              id: "actions",
              header: "",
              cell: ({ row }: { row: { original: VehicleRow } }) => (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {row.original.status !== "INACTIVE" && (
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="icon-sm" title="Archive">
                          <Archive className="h-4 w-4" />
                        </Button>
                      }
                      title="Archive this vehicle?"
                      description="This sets the vehicle status to Inactive. It can be edited back later."
                      confirmLabel="Archive"
                      destructive
                      onConfirm={() => archiveVehicleAction(row.original.id)}
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
      emptyTitle="No vehicles found."
      emptyDescription="Try adjusting your filters or add a new vehicle."
    />
  );
}
