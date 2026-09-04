"use client";

import { useRouter } from "next/navigation";
import { type LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { MoreHorizontal, Pencil, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable, type PaginationMeta } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { CrateFormDialog, type CrateEditing, type CustomerOption } from "@/components/crates/crate-form-dialog";
import { CrateStatusDialog } from "@/components/crates/crate-status-dialog";

export type CrateRow = CrateEditing & { status: string; customerName: string | null };

export function CratesTable({
  data,
  pagination,
  customers,
  canEdit,
}: {
  data: CrateRow[];
  pagination: PaginationMeta;
  customers: CustomerOption[];
  canEdit: boolean;
}) {
  const router = useRouter();

  const columns: ColumnDef<CrateRow>[] = [
    { accessorKey: "crateCode", header: "Code" },
    { accessorKey: "crateType", header: "Type" },
    { accessorKey: "capacity", header: "Capacity", cell: ({ row }) => row.original.capacity ?? "—" },
    {
      accessorKey: "currentLocation",
      header: "Location",
      cell: ({ row }) => row.original.currentLocation ?? "—",
    },
    {
      accessorKey: "customerName",
      header: "Customer",
      cell: ({ row }) => row.original.customerName ?? "—",
    },
    { accessorKey: "condition", header: "Condition", cell: ({ row }) => row.original.condition ?? "—" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ];

  if (canEdit) {
    columns.push({
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <CrateFormDialog
                customers={customers}
                editing={row.original}
                trigger={
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit
                  </DropdownMenuItem>
                }
              />
              <CrateStatusDialog
                crateId={row.original.id}
                crateCode={row.original.crateCode}
                currentStatus={row.original.status}
                trigger={
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <RefreshCcw className="mr-2 h-4 w-4" /> Change status
                  </DropdownMenuItem>
                }
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    });
  }

  return (
    <DataTable
      columns={columns}
      data={data}
      pagination={pagination}
      onRowClick={(row) => router.push(`/crates/${row.id}`)}
      emptyTitle="No crates found."
      emptyDescription="Add your first crate to start tracking crate inventory."
    />
  );
}
