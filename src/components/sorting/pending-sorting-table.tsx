"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { format } from "date-fns";
import { DataTable, type PaginationMeta } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";

export type PendingSortingRow = {
  id: string;
  batchNumber: string;
  date: string;
  itemName: string;
  itemUnit: string;
  supplierName: string;
  warehouseName: string;
  rawWeight: number;
};

export function PendingSortingTable({
  rows,
  pagination,
  canSort,
}: {
  rows: PendingSortingRow[];
  pagination: PaginationMeta;
  canSort: boolean;
}) {
  const columns = useMemo<ColumnDef<PendingSortingRow>[]>(
    () => [
      { accessorKey: "batchNumber", header: "Batch #" },
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => format(new Date(row.original.date), "dd MMM yyyy"),
      },
      { accessorKey: "itemName", header: "Item" },
      { accessorKey: "supplierName", header: "Supplier" },
      { accessorKey: "warehouseName", header: "Warehouse" },
      {
        accessorKey: "rawWeight",
        header: "Raw Weight",
        cell: ({ row }) => `${row.original.rawWeight.toLocaleString()} kg`,
      },
      ...(canSort
        ? [
            {
              id: "actions",
              header: "",
              cell: ({ row }: { row: { original: PendingSortingRow } }) => (
                <Button asChild size="sm">
                  <Link href={`/procurement/sorting/${row.original.id}`}>Sort</Link>
                </Button>
              ),
            } as ColumnDef<PendingSortingRow>,
          ]
        : []),
    ],
    [canSort],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      pagination={pagination}
      emptyTitle="No batches pending sorting."
      emptyDescription="Newly unloaded procurement batches will appear here once ready to grade."
    />
  );
}
