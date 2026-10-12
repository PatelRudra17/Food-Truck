"use client";

import { useMemo } from "react";
import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { format } from "date-fns";
import { AlertTriangle, Paperclip } from "lucide-react";
import { DataTable, type PaginationMeta } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VoidFuelDialog } from "@/components/fuel/void-fuel-dialog";
import { getFuelAttachmentUrlAction } from "@/lib/actions/fuel-actions";
import { toast } from "sonner";

export type FuelRow = {
  id: string;
  date: string;
  vehicleNumber: string;
  driverName: string | null;
  tripNumber: string | null;
  distanceKm: number;
  fuelQuantityLiters: number;
  totalFuelCost: number;
  mileageKmpl: number | null;
  fuelCostPerKm: number | null;
  isAnomaly: boolean;
  isVoided: boolean;
  hasAttachment: boolean;
  attachmentId: string | null;
};

async function openAttachment(attachmentId: string) {
  const result = await getFuelAttachmentUrlAction(attachmentId);
  if (result.ok) {
    window.open(result.data.url, "_blank", "noopener,noreferrer");
  } else {
    toast.error(result.error);
  }
}

export function FuelTable({
  rows,
  pagination,
  canVoid,
}: {
  rows: FuelRow[];
  pagination: PaginationMeta;
  canVoid: boolean;
}) {
  const columns = useMemo<ColumnDef<FuelRow>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => format(new Date(row.original.date), "dd MMM yyyy"),
      },
      { accessorKey: "vehicleNumber", header: "Vehicle" },
      {
        accessorKey: "driverName",
        header: "Driver",
        cell: ({ row }) => row.original.driverName ?? "—",
      },
      {
        accessorKey: "tripNumber",
        header: "Trip",
        cell: ({ row }) => row.original.tripNumber ?? "—",
      },
      {
        accessorKey: "distanceKm",
        header: "Distance",
        cell: ({ row }) => `${row.original.distanceKm.toLocaleString("en-IN")} km`,
      },
      {
        accessorKey: "fuelQuantityLiters",
        header: "Fuel Qty",
        cell: ({ row }) => `${row.original.fuelQuantityLiters.toLocaleString("en-IN")} L`,
      },
      {
        accessorKey: "totalFuelCost",
        header: "Total Cost",
        cell: ({ row }) => `₹${row.original.totalFuelCost.toLocaleString("en-IN")}`,
      },
      {
        accessorKey: "mileageKmpl",
        header: "Mileage",
        cell: ({ row }) => (row.original.mileageKmpl != null ? `${row.original.mileageKmpl.toFixed(2)} km/L` : "—"),
      },
      {
        accessorKey: "fuelCostPerKm",
        header: "Cost / km",
        cell: ({ row }) => (row.original.fuelCostPerKm != null ? `₹${row.original.fuelCostPerKm.toFixed(2)}` : "—"),
      },
      {
        id: "flags",
        header: "Status",
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1.5">
            {row.original.isAnomaly && (
              <Badge variant="outline" className="gap-1 border-transparent bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                <AlertTriangle className="h-3 w-3" /> Anomaly
              </Badge>
            )}
            {row.original.isVoided && (
              <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
                Voided
              </Badge>
            )}
            {row.original.hasAttachment && row.original.attachmentId && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-1.5 text-xs"
                onClick={() => openAttachment(row.original.attachmentId!)}
              >
                <Paperclip className="h-3 w-3" /> Receipt
              </Button>
            )}
          </div>
        ),
      },
      ...(canVoid
        ? [
            {
              id: "actions",
              header: "",
              cell: ({ row }: { row: { original: FuelRow } }) =>
                !row.original.isVoided && (
                  <VoidFuelDialog
                    fuelEntryId={row.original.id}
                    trigger={
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                        Void
                      </Button>
                    }
                  />
                ),
            } as ColumnDef<FuelRow>,
          ]
        : []),
    ],
    [canVoid],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      pagination={pagination}
      emptyTitle="No fuel entries found."
      emptyDescription="Log a fuel entry to start tracking consumption and cost."
    />
  );
}
