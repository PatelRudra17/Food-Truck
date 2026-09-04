"use client";

import { useMemo } from "react";
import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { format } from "date-fns";
import Link from "next/link";
import { DataTable, type PaginationMeta } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";

export type TemperatureLogRow = {
  id: string;
  itemId: string;
  itemName: string;
  itemSku: string;
  itemUnit: string;
  batchNumber: string | null;
  warehouseName: string;
  locationLabel: string | null;
  recordedTempC: number;
  minTempC: number | null;
  maxTempC: number | null;
  status: string;
  source: string;
  recordedByName: string;
  recordedAt: string;
};

export function TemperatureLogTable({ rows, pagination }: { rows: TemperatureLogRow[]; pagination: PaginationMeta }) {
  const columns = useMemo<ColumnDef<TemperatureLogRow>[]>(
    () => [
      {
        accessorKey: "itemName",
        header: "Item",
        cell: ({ row }) => (
          <div>
            <Link href={`/storage-temperature/${row.original.itemId}`} className="font-medium hover:underline">
              {row.original.itemName}
            </Link>
            <p className="text-xs text-muted-foreground">{row.original.itemSku}</p>
          </div>
        ),
      },
      {
        accessorKey: "batchNumber",
        header: "Batch",
        cell: ({ row }) => row.original.batchNumber ?? "—",
      },
      {
        id: "location",
        header: "Warehouse / Location",
        cell: ({ row }) => (
          <div>
            <p>{row.original.warehouseName}</p>
            {row.original.locationLabel && (
              <p className="text-xs text-muted-foreground">{row.original.locationLabel}</p>
            )}
          </div>
        ),
      },
      {
        accessorKey: "recordedTempC",
        header: "Recorded",
        cell: ({ row }) => `${row.original.recordedTempC}°C`,
      },
      {
        id: "range",
        header: "Recommended Range",
        cell: ({ row }) =>
          row.original.minTempC != null && row.original.maxTempC != null
            ? `${row.original.minTempC}–${row.original.maxTempC}°C`
            : "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "recordedByName",
        header: "Recorded By",
      },
      {
        accessorKey: "recordedAt",
        header: "Recorded At",
        cell: ({ row }) => format(new Date(row.original.recordedAt), "dd MMM yyyy, HH:mm"),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      pagination={pagination}
      emptyTitle="No temperature readings found."
      emptyDescription="Record a reading, or adjust your filters."
    />
  );
}
