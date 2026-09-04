import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { PayrollForm } from "@/components/payroll/payroll-form";

export const metadata = { title: "Run Payroll" };

export default async function RunPayrollPage() {
  await requirePermission("PAYROLL_CREATE");

  const [employees, labourers] = await Promise.all([
    prisma.employee.findMany({
      where: { status: { not: "INACTIVE" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, employeeCode: true },
    }),
    prisma.labour.findMany({
      where: { status: { not: "INACTIVE" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, labourCode: true, dailyWage: true },
    }),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Run Payroll"
        description="Create a salary record for one pay period. For labour, suggested earnings are computed from marked attendance and can be adjusted before saving."
      />

      <PayrollForm
        employeeOptions={employees}
        labourOptions={labourers.map((l) => ({ ...l, dailyWage: Number(l.dailyWage) }))}
      />
    </div>
  );
}
