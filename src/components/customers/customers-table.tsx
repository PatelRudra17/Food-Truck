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
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { archiveCustomerAction, reactivateCustomerAction, type CustomerRow } from "@/lib/actions/customer-actions";

export function CustomersTable({
  data,
  pagination,
  canEdit,
  canArchive,
}: {
  data: CustomerRow[];
  pagination: PaginationMeta;
  canEdit: boolean;
  canArchive: boolean;
}) {
  const router = useRouter();

  const columns: ColumnDef<CustomerRow>[] = [
    { accessorKey: "customerCode", header: "Code" },
    { accessorKey: "name", header: "Name" },
    {
      accessorKey: "contactPerson",
      header: "Contact Person",
      cell: ({ row }) => row.original.contactPerson ?? "—",
    },
    { accessorKey: "phone", header: "Phone", cell: ({ row }) => row.original.phone ?? "—" },
    {
      accessorKey: "location",
      header: "Location",
      cell: ({ row }) => row.original.location ?? "—",
    },
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
                <CustomerFormDialog
                  customer={{
                    id: row.original.id,
                    customerCode: row.original.customerCode,
                    name: row.original.name,
                    contactPerson: row.original.contactPerson ?? "",
                    phone: row.original.phone ?? "",
                    email: "",
                    address: "",
                    location: row.original.location ?? "",
                    gstNumber: row.original.gstNumber ?? "",
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
                  title="Archive customer?"
                  description={`${row.original.name} will be marked inactive.`}
                  confirmLabel="Archive"
                  destructive
                  onConfirm={() => archiveCustomerAction(row.original.id)}
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
                  title="Reactivate customer?"
                  description={`${row.original.name} will be marked active again.`}
                  confirmLabel="Reactivate"
                  onConfirm={() => reactivateCustomerAction(row.original.id)}
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
      onRowClick={(row) => router.push(`/customers/${row.id}`)}
      emptyTitle="No customers found."
      emptyDescription="Create your first customer to start raising sales orders."
    />
  );
}
