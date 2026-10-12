import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { getSalaryById } from "@/lib/services/payroll";
import { PageHeader } from "@/components/shared/page-header";
import { PayrollForm } from "@/components/payroll/payroll-form";

export const metadata = { title: "Edit Salary Record" };

export default async function EditPayrollPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("PAYROLL_EDIT");
  const { id } = await params;

  const salary = await getSalaryById(id);
  if (!salary) notFound();
  // Paid records are read-only.
  if (salary.paymentStatus !== "PENDING") redirect(`/payroll/${id}`);

  const [employees, labourers] = await Promise.all([
    prisma.employee.findMany({
      // Keep the record's own person selectable even if they have since been deactivated.
      where: { OR: [{ status: { not: "INACTIVE" } }, ...(salary.employeeId ? [{ id: salary.employeeId }] : [])] },
      orderBy: { name: "asc" },
      select: { id: true, name: true, employeeCode: true },
    }),
    prisma.labour.findMany({
      where: { OR: [{ status: { not: "INACTIVE" } }, ...(salary.labourId ? [{ id: salary.labourId }] : [])] },
      orderBy: { name: "asc" },
      select: { id: true, name: true, labourCode: true, dailyWage: true },
    }),
  ]);

  const personName = salary.employee?.name ?? salary.labour?.name ?? "—";

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={`Edit Salary — ${personName}`} description="Update the pay period and amounts of this pending salary record." />

      <PayrollForm
        salaryId={salary.id}
        employeeOptions={employees}
        labourOptions={labourers.map((l) => ({ ...l, dailyWage: Number(l.dailyWage) }))}
        initialValues={{
          personType: salary.employeeId ? "EMPLOYEE" : "LABOUR",
          employeeId: salary.employeeId ?? "",
          labourId: salary.labourId ?? "",
          periodStart: format(salary.periodStart, "yyyy-MM-dd"),
          periodEnd: format(salary.periodEnd, "yyyy-MM-dd"),
          earnings: Number(salary.earnings),
          overtimeAmount: Number(salary.overtimeAmount),
          advances: Number(salary.advances),
          deductions: Number(salary.deductions),
        }}
      />
    </div>
  );
}
