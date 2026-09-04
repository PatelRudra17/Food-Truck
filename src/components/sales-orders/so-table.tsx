"use client";

import { useRouter } from "next/navigation";
import { type LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { DataTable, type PaginationMeta } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";

export type SalesOrderRow = {
  id: string;
  soNumber: string;
  customerName: string;
  orderDate: string;
  deliveryDate: string | null;
  priority: string | null;
  totalAmount: number;
  status: string;
};

export function SalesOrdersTable({
  data,
  pagination,
}: {
  data: SalesOrderRow[];
  pagination: PaginationMeta;
}) {
  const router = useRouter();

  const columns: ColumnDef<SalesOrderRow>[] = [
    { accessorKey: "soNumber", header: "SO Number" },
    { accessorKey: "customerName", header: "Customer" },
    { accessorKey: "orderDate", header: "Order Date" },
    {
      accessorKey: "deliveryDate",
      header: "Delivery Date",
      cell: ({ row }) => row.original.deliveryDate ?? "—",
    },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => row.original.priority ?? "—",
    },
    {
      accessorKey: "totalAmount",
      header: "Total Amount",
      cell: ({ row }) => <span className="tabular-nums">{row.original.totalAmount.toLocaleString()}</span>,
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
      onRowClick={(row) => router.push(`/sales/orders/${row.id}`)}
      emptyTitle="No sales orders found."
      emptyDescription="Create a sales order to start fulfilling a customer's order."
    />
  );
}
