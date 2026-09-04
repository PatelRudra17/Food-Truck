"use client";

import { useRouter } from "next/navigation";
import { type LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { DataTable, type PaginationMeta } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";

export type ProcurementRow = {
  id: string;
  procurementNumber: string;
  supplierName: string;
  warehouseName: string;
  date: string;
  vehicleNumber: string | null;
  itemCount: number;
  status: string;
};

export function ProcurementTable({
  data,
  pagination,
}: {
  data: ProcurementRow[];
  pagination: PaginationMeta;
}) {
  const router = useRouter();

  const columns: ColumnDef<ProcurementRow>[] = [
    { accessorKey: "procurementNumber", header: "Procurement #" },
    { accessorKey: "supplierName", header: "Supplier" },
    { accessorKey: "warehouseName", header: "Warehouse" },
    { accessorKey: "date", header: "Date" },
    {
      accessorKey: "vehicleNumber",
      header: "Vehicle",
      cell: ({ row }) => row.original.vehicleNumber ?? "—",
    },
    {
      accessorKey: "itemCount",
      header: "Lines",
      cell: ({ row }) => <span className="tabular-nums">{row.original.itemCount}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      pagination={pagination}
      onRowClick={(row) => router.push(`/procurement/${row.id}`)}
      emptyTitle="No procurements found."
      emptyDescription="Record produce received from a supplier to start a procurement."
    />
  );
}
