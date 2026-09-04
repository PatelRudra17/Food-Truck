import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { paginationSchema } from "@/lib/validators/common";
import { listPayroll } from "@/lib/services/payroll";
import { PageHeader } from "@/components/shared/page-header";
import { TableSearchInput } from "@/components/shared/table-search-input";
import { TableFilterSelect } from "@/components/shared/table-filter-select";
import { Button } from "@/components/ui/button";
import { PayrollTable } from "@/components/payroll/payroll-table";
import Link from "next/link";

export const metadata = { title: "Payroll" };

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("PAYROLL_VIEW");
  const user = await getSessionUser();
  const sp = await searchParams;

  const get = (key: string) => {
    const value = sp[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const pagination = paginationSchema.parse({ page: get("page"), pageSize: get("pageSize") });
  const q = get("q")?.trim();
  const personType = get("personType")?.trim();
  const paymentStatus = get("paymentStatus")?.trim();

  const { rows, pagination: paginationMeta } = await listPayroll(pagination, {
    q: q || undefined,
    personType: personType || undefined,
    paymentStatus: paymentStatus || undefined,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        description="Run and track salary payments for employees and labour."
        actions={
          hasPermission(user, "PAYROLL_CREATE") ? (
            <Button asChild size="sm">
              <Link href="/payroll/new">Run Payroll</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <TableSearchInput placeholder="Search by person name..." />
          <TableFilterSelect
            paramKey="personType"
            placeholder="All types"
            options={[
              { value: "EMPLOYEE", label: "Employee" },
              { value: "LABOUR", label: "Labour" },
            ]}
          />
          <TableFilterSelect
            paramKey="paymentStatus"
            placeholder="All statuses"
            options={[
              { value: "PENDING", label: "Pending" },
              { value: "PAID", label: "Paid" },
            ]}
          />
        </div>
      </div>

      <PayrollTable
        data={rows.map((s) => ({
          id: s.id,
          personName: s.employee?.name ?? s.labour?.name ?? "—",
          personCode: s.employee?.employeeCode ?? s.labour?.labourCode ?? "—",
          personType: s.employeeId ? ("EMPLOYEE" as const) : ("LABOUR" as const),
          periodStart: s.periodStart.toISOString(),
          periodEnd: s.periodEnd.toISOString(),
          earnings: Number(s.earnings),
          netSalary: Number(s.netSalary),
          paymentStatus: s.paymentStatus,
        }))}
        pagination={paginationMeta}
        canApprove={hasPermission(user, "PAYROLL_APPROVE")}
      />
    </div>
  );
}
