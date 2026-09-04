"use client";

import { useRouter } from "next/navigation";
import { type LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { DataTable, type PaginationMeta } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";

export type TripRow = {
  id: string;
  tripNumber: string;
  customerName: string;
  vehicleNumber: string;
  driverName: string;
  routeName: string | null;
  itemCount: number;
  departureAt: string | null;
  status: string;
  eligibilityOverride: boolean;
};

export function TripsTable({ data, pagination }: { data: TripRow[]; pagination: PaginationMeta }) {
  const router = useRouter();

  const columns: ColumnDef<TripRow>[] = [
    { accessorKey: "tripNumber", header: "Trip Number" },
    { accessorKey: "customerName", header: "Customer" },
    { accessorKey: "vehicleNumber", header: "Vehicle" },
    { accessorKey: "driverName", header: "Driver" },
    { accessorKey: "routeName", header: "Route", cell: ({ row }) => row.original.routeName ?? "—" },
    {
      accessorKey: "itemCount",
      header: "Lines",
      cell: ({ row }) => <span className="tabular-nums">{row.original.itemCount}</span>,
    },
    { accessorKey: "departureAt", header: "Departure", cell: ({ row }) => row.original.departureAt ?? "—" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge status={row.original.status} />
          {row.original.eligibilityOverride && (
            <span className="text-xs font-medium text-amber-600" title="Dispatch eligibility was overridden">
              override
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      pagination={pagination}
      onRowClick={(row) => router.push(`/dispatch/trips/${row.id}`)}
      emptyTitle="No trips found."
      emptyDescription="Create a trip to dispatch stock to a customer."
    />
  );
}
