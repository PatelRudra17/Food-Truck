"use client";

import Link from "next/link";
import { format } from "date-fns";
import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { DataTable, type PaginationMeta } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import type { GateActivityRow } from "@/lib/services/gate";

export function RecentActivityTable({
  rows,
  pagination,
  canPrint,
}: {
  rows: GateActivityRow[];
  pagination: PaginationMeta;
  canPrint: boolean;
}) {
  const columns: ColumnDef<GateActivityRow>[] = [
    {
      accessorKey: "kind",
      header: "Type",
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={
            row.original.kind === "IN"
              ? "border-transparent bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
              : "border-transparent bg-muted text-muted-foreground"
          }
        >
          {row.original.kind === "IN" ? "Gate In" : "Gate Out"}
        </Badge>
      ),
    },
    {
      accessorKey: "documentNumber",
      header: "Document #",
      cell: ({ row }) => <span className="font-medium">{row.original.documentNumber}</span>,
    },
    {
      accessorKey: "vehicleNumber",
      header: "Vehicle",
      cell: ({ row }) => (
        <Link href={`/vehicles/${row.original.vehicleId}`} className="hover:underline">
          {row.original.vehicleNumber}
        </Link>
      ),
    },
    { accessorKey: "driverName", header: "Driver" },
    {
      accessorKey: "detail",
      header: "Purpose / Destination",
      cell: ({ row }) => row.original.detail ?? "—",
    },
    {
      accessorKey: "eventTime",
      header: "When",
      cell: ({ row }) => format(row.original.eventTime, "dd MMM yyyy, HH:mm"),
    },
    ...(canPrint
      ? ([
          {
            id: "actions",
            header: "",
            cell: ({ row }) => (
              <Button asChild size="sm" variant="ghost">
                <Link href={`/gate/${row.original.entryId}/print`}>
                  <Printer /> Print
                </Link>
              </Button>
            ),
          } satisfies ColumnDef<GateActivityRow>,
        ] as ColumnDef<GateActivityRow>[])
      : []),
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      pagination={pagination}
      emptyTitle="No gate activity found"
      emptyDescription="Try adjusting the date range or vehicle filter."
    />
  );
}
