import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Archive, Pencil, CalendarClock, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { getEmployeeById } from "@/lib/services/employee";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { EmployeeFormDialog } from "@/components/employees/employee-form-dialog";
import { archiveEmployeeAction } from "@/lib/actions/employee-actions";

export const metadata = { title: "Employee Details" };

function toDateInputValue(date: Date | null | undefined): string | undefined {
  return date ? format(date, "yyyy-MM-dd") : undefined;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium">{value ?? "—"}</div>
    </div>
  );
}

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("EMPLOYEE_VIEW");
  const { id } = await params;

  const [employee, shifts] = await Promise.all([
    getEmployeeById(id),
    prisma.shift.findMany({ orderBy: { date: "desc" }, select: { id: true, shiftName: true, date: true } }),
  ]);

  if (!employee) notFound();

  const canEdit = user.permissions.includes("EMPLOYEE_EDIT");
  const canArchive = user.permissions.includes("EMPLOYEE_ARCHIVE");
  const shiftOptions = shifts.map((s) => ({ id: s.id, shiftName: s.shiftName, date: format(s.date, "dd MMM yyyy") }));

  return (
    <div className="space-y-4">
      <PageHeader
        title={employee.name}
        description={`Employee Code: ${employee.employeeCode}`}
        actions={
          <div className="flex items-center gap-2">
            {canEdit && (
              <EmployeeFormDialog
                mode="edit"
                employeeId={employee.id}
                shiftOptions={shiftOptions}
                defaultValues={{
                  name: employee.name,
                  mobile: employee.mobile,
                  department: employee.department ?? undefined,
                  roleTitle: employee.roleTitle ?? undefined,
                  joiningDate: toDateInputValue(employee.joiningDate),
                  shiftId: employee.shiftId ?? undefined,
                  status: employee.status,
                }}
                trigger={
                  <Button size="sm" variant="outline">
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                }
              />
            )}
            {canArchive && employee.status !== "INACTIVE" && (
              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="destructive">
                    <Archive className="h-4 w-4" /> Archive
                  </Button>
                }
                title="Archive this employee?"
                description="This sets the employee status to Inactive."
                confirmLabel="Archive"
                destructive
                onConfirm={archiveEmployeeAction.bind(null, employee.id)}
              />
            )}
          </div>
        }
      />

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="salary">Salary</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <Card>
            <CardContent className="grid grid-cols-2 gap-4 pt-4 sm:grid-cols-3 lg:grid-cols-4">
              <Field label="Employee Code" value={employee.employeeCode} />
              <Field label="Mobile" value={employee.mobile} />
              <Field label="Department" value={employee.department} />
              <Field label="Role / Designation" value={employee.roleTitle} />
              <Field label="Status" value={<StatusBadge status={employee.status} />} />
              <Field
                label="Joining Date"
                value={employee.joiningDate ? format(employee.joiningDate, "dd MMM yyyy") : null}
              />
              <Field label="Shift" value={employee.shift?.shiftName} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {employee.attendances.length === 0 ? (
                <EmptyState icon={CalendarClock} title="No attendance recorded yet." />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Shift</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Overtime (hrs)</TableHead>
                        <TableHead>Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employee.attendances.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>{format(a.date, "dd MMM yyyy")}</TableCell>
                          <TableCell>{a.shift?.shiftName ?? "—"}</TableCell>
                          <TableCell>
                            <StatusBadge status={a.status} />
                          </TableCell>
                          <TableCell>{a.overtimeHours ? Number(a.overtimeHours).toLocaleString() : "—"}</TableCell>
                          <TableCell>{a.remarks ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="salary" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {employee.salaries.length === 0 ? (
                <EmptyState icon={Wallet} title="No salary records yet." />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Earnings</TableHead>
                        <TableHead>Overtime</TableHead>
                        <TableHead>Advances</TableHead>
                        <TableHead>Deductions</TableHead>
                        <TableHead>Net Salary</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employee.salaries.map((s) => (
                        <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50">
                          <TableCell>
                            <Link href={`/payroll/${s.id}`} className="hover:underline">
                              {format(s.periodStart, "dd MMM yyyy")} – {format(s.periodEnd, "dd MMM yyyy")}
                            </Link>
                          </TableCell>
                          <TableCell>{Number(s.earnings).toLocaleString()}</TableCell>
                          <TableCell>{Number(s.overtimeAmount).toLocaleString()}</TableCell>
                          <TableCell>{Number(s.advances).toLocaleString()}</TableCell>
                          <TableCell>{Number(s.deductions).toLocaleString()}</TableCell>
                          <TableCell className="font-medium">{Number(s.netSalary).toLocaleString()}</TableCell>
                          <TableCell>
                            <StatusBadge status={s.paymentStatus} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
