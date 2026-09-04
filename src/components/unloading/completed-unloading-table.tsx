"use client";

import { type LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { DataTable, type PaginationMeta } from "@/components/shared/data-table";

export type CompletedUnloadingRow = {
  id: string;
  gateEntryNumber: string;
  vehicleNumber: string;
  driverName: string;
  supplierName: string | null;
  weight: number | null;
  unloadingEndAt: string;
  staffName: string | null;
};

export function CompletedUnloadingTable({
  data,
  pagination,
}: {
  data: CompletedUnloadingRow[];
  pagination: PaginationMeta;
}) {
  const columns: ColumnDef<CompletedUnloadingRow>[] = [
    { accessorKey: "gateEntryNumber", header: "Gate Entry #" },
    { accessorKey: "vehicleNumber", header: "Vehicle" },
    { accessorKey: "driverName", header: "Driver" },
    {
      accessorKey: "supplierName",
      header: "Supplier",
      cell: ({ row }) => row.original.supplierName ?? "—",
    },
    {
      accessorKey: "weight",
      header: "Weight (kg)",
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.weight?.toLocaleString() ?? "—"}</span>
      ),
    },
    { accessorKey: "unloadingEndAt", header: "Completed At" },
    {
      accessorKey: "staffName",
      header: "Staff",
      cell: ({ row }) => row.original.staffName ?? "—",
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      pagination={pagination}
      emptyTitle="No completed unloadings yet."
    />
  );
}
