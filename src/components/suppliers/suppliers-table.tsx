"use client";

import { useRouter } from "next/navigation";
import { type LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { MoreHorizontal, Pencil, Archive, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable, type PaginationMeta } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SupplierFormDialog } from "@/components/suppliers/supplier-form-dialog";
import { archiveSupplierAction, reactivateSupplierAction } from "@/lib/actions/supplier-actions";

export type SupplierRow = {
  id: string;
  code: string;
  companyName: string;
  contactPerson: string | null;
  phone: string | null;
  gstNumber: string | null;
  status: "ACTIVE" | "INACTIVE";
};

export function SuppliersTable({
  data,
  pagination,
  canEdit,
  canArchive,
}: {
  data: SupplierRow[];
  pagination: PaginationMeta;
  canEdit: boolean;
  canArchive: boolean;
}) {
  const router = useRouter();

  const columns: ColumnDef<SupplierRow>[] = [
    { accessorKey: "code", header: "Code" },
    { accessorKey: "companyName", header: "Company Name" },
    {
      accessorKey: "contactPerson",
      header: "Contact Person",
      cell: ({ row }) => row.original.contactPerson ?? "—",
    },
    { accessorKey: "phone", header: "Phone", cell: ({ row }) => row.original.phone ?? "—" },
    {
      accessorKey: "gstNumber",
      header: "GST Number",
      cell: ({ row }) => row.original.gstNumber ?? "—",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ];

  if (canEdit || canArchive) {
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
              {canEdit && (
                <SupplierFormDialog
                  supplier={{
                    id: row.original.id,
                    code: row.original.code,
                    companyName: row.original.companyName,
                    contactPerson: row.original.contactPerson ?? "",
                    phone: row.original.phone ?? "",
                    email: "",
                    address: "",
                    gstNumber: row.original.gstNumber ?? "",
                    panNumber: "",
                    status: row.original.status,
                  }}
                  trigger={
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                  }
                />
              )}
              {canArchive && row.original.status === "ACTIVE" && (
                <ConfirmDialog
                  trigger={
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <Archive className="mr-2 h-4 w-4" /> Archive
                    </DropdownMenuItem>
                  }
                  title="Archive supplier?"
                  description={`${row.original.companyName} will be marked inactive.`}
                  confirmLabel="Archive"
                  destructive
                  onConfirm={() => archiveSupplierAction(row.original.id)}
                  onSuccess={() => router.refresh()}
                />
              )}
              {canArchive && row.original.status === "INACTIVE" && (
                <ConfirmDialog
                  trigger={
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <RotateCcw className="mr-2 h-4 w-4" /> Reactivate
                    </DropdownMenuItem>
                  }
                  title="Reactivate supplier?"
                  description={`${row.original.companyName} will be marked active again.`}
                  confirmLabel="Reactivate"
                  onConfirm={() => reactivateSupplierAction(row.original.id)}
                  onSuccess={() => router.refresh()}
                />
              )}
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
      onRowClick={(row) => router.push(`/suppliers/${row.id}`)}
      emptyTitle="No suppliers found."
      emptyDescription="Create your first supplier to start raising purchase orders."
    />
  );
}
