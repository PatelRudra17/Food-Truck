"use client";

import { useRouter } from "next/navigation";
import { type LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { DataTable, type PaginationMeta } from "@/components/shared/data-table";

export type CrateReturnRow = {
  id: string;
  tripId: string;
  returnNumber: string;
  tripNumber: string;
  customerName: string;
  cratesDispatched: number;
  cratesReturned: number;
  cratesDamaged: number;
  cratesMissing: number;
  pending: number;
  returnDate: string | null;
};

export function CrateReturnsTable({ data, pagination }: { data: CrateReturnRow[]; pagination: PaginationMeta }) {
  const router = useRouter();

  const columns: ColumnDef<CrateReturnRow>[] = [
    { accessorKey: "returnNumber", header: "Return Number" },
    { accessorKey: "tripNumber", header: "Trip" },
    { accessorKey: "customerName", header: "Customer" },
    {
      accessorKey: "cratesDispatched",
      header: "Dispatched",
      cell: ({ row }) => <span className="tabular-nums">{row.original.cratesDispatched}</span>,
    },
    {
      accessorKey: "cratesReturned",
      header: "Returned",
      cell: ({ row }) => <span className="tabular-nums">{row.original.cratesReturned}</span>,
    },
    {
      accessorKey: "cratesDamaged",
      header: "Damaged",
      cell: ({ row }) => <span className="tabular-nums">{row.original.cratesDamaged}</span>,
    },
    {
      accessorKey: "cratesMissing",
      header: "Missing",
      cell: ({ row }) => <span className="tabular-nums">{row.original.cratesMissing}</span>,
    },
    {
      accessorKey: "pending",
      header: "Pending",
      cell: ({ row }) => (
        <span className={row.original.pending > 0 ? "font-medium text-amber-600 tabular-nums" : "tabular-nums"}>
          {row.original.pending}
        </span>
      ),
    },
    { accessorKey: "returnDate", header: "Return Date", cell: ({ row }) => row.original.returnDate ?? "—" },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      pagination={pagination}
      onRowClick={(row) => router.push(`/dispatch/trips/${row.tripId}`)}
      emptyTitle="No crate returns recorded yet."
      emptyDescription="Record a crate return once a vehicle comes back from a customer delivery."
    />
  );
}
