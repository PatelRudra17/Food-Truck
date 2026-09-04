import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { paginationSchema } from "@/lib/validators/common";
import { listEmployees, listEmployeeDepartments } from "@/lib/services/employee";
import { PageHeader } from "@/components/shared/page-header";
import { TableSearchInput } from "@/components/shared/table-search-input";
import { TableFilterSelect } from "@/components/shared/table-filter-select";
import { Button } from "@/components/ui/button";
import { EmployeeTable } from "@/components/employees/employee-table";
import { EmployeeFormDialog } from "@/components/employees/employee-form-dialog";
import { format } from "date-fns";

export const metadata = { title: "Employees" };

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("EMPLOYEE_VIEW");
  const user = await getSessionUser();
  const sp = await searchParams;

  const get = (key: string) => {
    const value = sp[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const pagination = paginationSchema.parse({ page: get("page"), pageSize: get("pageSize") });
  const q = get("q")?.trim();
  const status = get("status")?.trim();
  const department = get("department")?.trim();

  const [{ rows, pagination: paginationMeta }, departments, shifts] = await Promise.all([
    listEmployees(pagination, { q: q || undefined, status: status || undefined, department: department || undefined }),
    listEmployeeDepartments(),
    prisma.shift.findMany({ orderBy: { date: "desc" }, select: { id: true, shiftName: true, date: true } }),
  ]);

  const shiftOptions = shifts.map((s) => ({ id: s.id, shiftName: s.shiftName, date: format(s.date, "dd MMM yyyy") }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description="Manage regular staff records, their shift assignment, and employment status."
        actions={
          hasPermission(user, "EMPLOYEE_CREATE") ? (
            <EmployeeFormDialog
              mode="create"
              shiftOptions={shiftOptions}
              trigger={<Button size="sm">New Employee</Button>}
            />
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <TableSearchInput placeholder="Search by name, code or mobile..." />
          <TableFilterSelect
            paramKey="status"
            placeholder="All statuses"
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "ON_LEAVE", label: "On Leave" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
          />
          {departments.length > 0 && (
            <TableFilterSelect
              paramKey="department"
              placeholder="All departments"
              options={departments.map((d) => ({ value: d, label: d }))}
            />
          )}
        </div>
      </div>

      <EmployeeTable
        data={rows.map((employee) => ({
          id: employee.id,
          employeeCode: employee.employeeCode,
          name: employee.name,
          mobile: employee.mobile,
          department: employee.department,
          roleTitle: employee.roleTitle,
          status: employee.status,
          joiningDate: employee.joiningDate ? employee.joiningDate.toISOString() : null,
          shiftName: employee.shift?.shiftName ?? null,
        }))}
        pagination={paginationMeta}
        canArchive={hasPermission(user, "EMPLOYEE_ARCHIVE")}
      />
    </div>
  );
}
