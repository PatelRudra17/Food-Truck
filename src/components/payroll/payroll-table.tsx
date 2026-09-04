"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { CircleDollarSign } from "lucide-react";
import { DataTable, type PaginationMeta } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { markPayrollPaidAction } from "@/lib/actions/payroll-actions";

export type PayrollRow = {
  id: string;
  personName: string;
  personCode: string;
  personType: "EMPLOYEE" | "LABOUR";
  periodStart: string;
  periodEnd: string;
  earnings: number;
  netSalary: number;
  paymentStatus: string;
};

export function PayrollTable({
  data,
  pagination,
  canApprove,
}: {
  data: PayrollRow[];
  pagination: PaginationMeta;
  canApprove: boolean;
}) {
  const router = useRouter();

  const columns = useMemo<ColumnDef<PayrollRow>[]>(
    () => [
      {
        accessorKey: "personName",
        header: "Person",
        cell: ({ row }) => (
          <Link href={`/payroll/${row.original.id}`} className="font-medium hover:underline">
            {row.original.personName} ({row.original.personCode})
          </Link>
        ),
      },
      {
        accessorKey: "personType",
        header: "Type",
        cell: ({ row }) => (row.original.personType === "EMPLOYEE" ? "Employee" : "Labour"),
      },
      {
        id: "period",
        header: "Period",
        cell: ({ row }) =>
          `${format(new Date(row.original.periodStart), "dd MMM yyyy")} – ${format(new Date(row.original.periodEnd), "dd MMM yyyy")}`,
      },
      {
        accessorKey: "earnings",
        header: "Earnings",
        cell: ({ row }) => row.original.earnings.toLocaleString(),
      },
      {
        accessorKey: "netSalary",
        header: "Net Salary",
        cell: ({ row }) => <span className="font-medium">{row.original.netSalary.toLocaleString()}</span>,
      },
      {
        accessorKey: "paymentStatus",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.paymentStatus} />,
      },
      ...(canApprove
        ? [
            {
              id: "actions",
              header: "",
              cell: ({ row }: { row: { original: PayrollRow } }) => (
                <div onClick={(e) => e.stopPropagation()}>
                  {row.original.paymentStatus === "PENDING" && (
                    <ConfirmDialog
                      trigger={
                        <Button variant="outline" size="sm">
                          <CircleDollarSign className="h-4 w-4" /> Mark Paid
                        </Button>
                      }
                      title="Mark this salary as paid?"
                      description="This records the payment date and cannot be undone from here."
                      confirmLabel="Mark Paid"
                      onConfirm={() => markPayrollPaidAction(row.original.id)}
                      onSuccess={() => router.refresh()}
                    />
                  )}
                </div>
              ),
            },
          ]
        : []),
    ],
    [canApprove, router],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      pagination={pagination}
      emptyTitle="No salary records found."
      emptyDescription="Run payroll for an employee or labour to see it here."
    />
  );
}
