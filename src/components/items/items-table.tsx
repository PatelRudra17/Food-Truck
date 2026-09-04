"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { DataTable, type PaginationMeta } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";

export type ItemRow = {
  id: string;
  sku: string;
  itemCode: string;
  name: string;
  categoryName: string;
  warehouseName: string | null;
  currentStock: number;
  reorderLevel: number;
  unit: string;
  isActive: boolean;
};

export function ItemsTable({ items, pagination }: { items: ItemRow[]; pagination: PaginationMeta }) {
  const router = useRouter();

  const columns = useMemo<ColumnDef<ItemRow>[]>(
    () => [
      {
        header: "Item",
        accessorKey: "name",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.sku} • {row.original.itemCode}
            </p>
          </div>
        ),
      },
      {
        header: "Category",
        accessorKey: "categoryName",
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.categoryName}</span>,
      },
      {
        header: "Warehouse",
        accessorKey: "warehouseName",
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.warehouseName ?? "—"}</span>,
      },
      {
        header: "Current Stock",
        accessorKey: "currentStock",
        cell: ({ row }) => {
          const low = row.original.currentStock <= row.original.reorderLevel;
          return (
            <div className="flex items-center gap-1.5 tabular-nums">
              <span className={low ? "font-semibold text-red-700 dark:text-red-400" : ""}>
                {row.original.currentStock.toLocaleString()}
              </span>
              {low && (
                <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                  Low
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        header: "Reorder Level",
        accessorKey: "reorderLevel",
        cell: ({ row }) => <span className="tabular-nums">{row.original.reorderLevel.toLocaleString()}</span>,
      },
      {
        header: "Unit",
        accessorKey: "unit",
      },
      {
        header: "Status",
        accessorKey: "isActive",
        cell: ({ row }) => <StatusBadge status={row.original.isActive ? "ACTIVE" : "INACTIVE"} />,
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={items}
      pagination={pagination}
      emptyTitle="No items found"
      emptyDescription="Try adjusting your search or filters, or create a new item."
      onRowClick={(row) => router.push(`/items/${row.id}`)}
    />
  );
}
