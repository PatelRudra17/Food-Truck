import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { CircleDollarSign } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { getSalaryById } from "@/lib/services/payroll";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { markPayrollPaidAction } from "@/lib/actions/payroll-actions";

export const metadata = { title: "Salary Record" };

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium">{value ?? "—"}</div>
    </div>
  );
}

export default async function PayrollDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("PAYROLL_VIEW");
  const { id } = await params;

  const salary = await getSalaryById(id);
  if (!salary) notFound();

  const canApprove = user.permissions.includes("PAYROLL_APPROVE");
  const personName = salary.employee?.name ?? salary.labour?.name ?? "—";
  const personHref = salary.employee ? `/employees/${salary.employee.id}` : salary.labour ? `/labour/${salary.labour.id}` : undefined;
  const personCode = salary.employee?.employeeCode ?? salary.labour?.labourCode ?? "—";

  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader
        title={`Salary — ${personName}`}
        description={`${personCode} · ${format(salary.periodStart, "dd MMM yyyy")} – ${format(salary.periodEnd, "dd MMM yyyy")}`}
        actions={
          canApprove && salary.paymentStatus === "PENDING" ? (
            <ConfirmDialog
              trigger={
                <Button size="sm">
                  <CircleDollarSign className="h-4 w-4" /> Mark Paid
                </Button>
              }
              title="Mark this salary as paid?"
              description="This records the payment date and cannot be undone from here."
              confirmLabel="Mark Paid"
              onConfirm={markPayrollPaidAction.bind(null, salary.id)}
            />
          ) : undefined
        }
      />

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 pt-4 sm:grid-cols-3">
          <Field
            label="Person"
            value={personHref ? <Link href={personHref} className="text-primary hover:underline">{personName}</Link> : personName}
          />
          <Field label="Type" value={salary.employee ? "Employee" : "Labour"} />
          <Field label="Status" value={<StatusBadge status={salary.paymentStatus} />} />
          <Field label="Period Start" value={format(salary.periodStart, "dd MMM yyyy")} />
          <Field label="Period End" value={format(salary.periodEnd, "dd MMM yyyy")} />
          <Field label="Paid At" value={salary.paidAt ? format(salary.paidAt, "dd MMM yyyy") : null} />
          <Field label="Earnings" value={Number(salary.earnings).toLocaleString()} />
          <Field label="Overtime Amount" value={Number(salary.overtimeAmount).toLocaleString()} />
          <Field label="Advances" value={Number(salary.advances).toLocaleString()} />
          <Field label="Deductions" value={Number(salary.deductions).toLocaleString()} />
          <Field label="Net Salary" value={<span className="text-base font-semibold">{Number(salary.netSalary).toLocaleString()}</span>} />
        </CardContent>
      </Card>
    </div>
  );
}
