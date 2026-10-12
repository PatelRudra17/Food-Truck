import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Archive, Pencil, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { getLabourById } from "@/lib/services/labour";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { LabourFormDialog } from "@/components/labour/labour-form-dialog";
import { archiveLabourAction } from "@/lib/actions/labour-actions";

export const metadata = { title: "Labour Details" };

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium">{value ?? "—"}</div>
    </div>
  );
}

export default async function LabourDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("LABOUR_VIEW");
  const { id } = await params;

  const [labour, shifts] = await Promise.all([
    getLabourById(id),
    prisma.shift.findMany({ orderBy: { date: "desc" }, select: { id: true, shiftName: true, date: true } }),
  ]);

  if (!labour) notFound();

  const canEdit = user.permissions.includes("LABOUR_EDIT");
  const canArchive = user.permissions.includes("LABOUR_ARCHIVE");
  const shiftOptions = shifts.map((s) => ({ id: s.id, shiftName: s.shiftName, date: format(s.date, "dd MMM yyyy") }));

  return (
    <div className="space-y-4">
      <PageHeader
        title={labour.name}
        description={`Labour Code: ${labour.labourCode}`}
        actions={
          <div className="flex items-center gap-2">
            {canEdit && (
              <LabourFormDialog
                mode="edit"
                labourId={labour.id}
                shiftOptions={shiftOptions}
                defaultValues={{
                  name: labour.name,
                  mobile: labour.mobile,
                  workType: labour.workType ?? undefined,
                  dailyWage: Number(labour.dailyWage),
                  shiftId: labour.shiftId ?? undefined,
                  status: labour.status,
                }}
                trigger={
                  <Button size="sm" variant="outline">
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                }
              />
            )}
            {canArchive && labour.status !== "INACTIVE" && (
              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="destructive">
                    <Archive className="h-4 w-4" /> Archive
                  </Button>
                }
                title="Archive this labour record?"
                description="This sets the status to Inactive."
                confirmLabel="Archive"
                destructive
                onConfirm={archiveLabourAction.bind(null, labour.id)}
              />
            )}
          </div>
        }
      />

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="salary">Salary</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <Card>
            <CardContent className="grid grid-cols-2 gap-4 pt-4 sm:grid-cols-3 lg:grid-cols-4">
              <Field label="Labour Code" value={labour.labourCode} />
              <Field label="Mobile" value={labour.mobile} />
              <Field label="Work Type" value={labour.workType} />
              <Field label="Daily Wage" value={Number(labour.dailyWage).toLocaleString()} />
              <Field label="Status" value={<StatusBadge status={labour.status} />} />
              <Field label="Shift" value={labour.shift?.shiftName} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="salary" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {labour.salaries.length === 0 ? (
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
                      {labour.salaries.map((s) => (
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
