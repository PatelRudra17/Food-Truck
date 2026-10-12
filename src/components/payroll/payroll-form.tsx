"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { payrollSchema, PAYROLL_PERSON_TYPES, type PayrollInput } from "@/lib/validators/payroll";
import { createPayrollAction, updatePayrollAction } from "@/lib/actions/payroll-actions";

type EmployeeOption = { id: string; name: string; employeeCode: string };
type LabourOption = { id: string; name: string; labourCode: string; dailyWage: number };

export type PayrollFormInput = z.input<typeof payrollSchema>;

export function PayrollForm({
  employeeOptions,
  labourOptions,
  salaryId,
  initialValues,
}: {
  employeeOptions: EmployeeOption[];
  labourOptions: LabourOption[];
  /** When set, the form edits this (pending) salary record instead of creating one. */
  salaryId?: string;
  initialValues?: PayrollFormInput;
}) {
  const router = useRouter();
  const isEdit = !!salaryId;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PayrollFormInput, unknown, PayrollInput>({
    resolver: zodResolver(payrollSchema),
    defaultValues: initialValues ?? {
      personType: "LABOUR",
      periodStart: format(new Date(), "yyyy-MM-01"),
      periodEnd: format(new Date(), "yyyy-MM-dd"),
      earnings: 0,
      overtimeAmount: 0,
      advances: 0,
      deductions: 0,
    },
  });

  const personType = watch("personType");
  const employeeId = watch("employeeId");
  const labourId = watch("labourId");
  const earnings = Number(watch("earnings")) || 0;
  const overtimeAmount = Number(watch("overtimeAmount")) || 0;
  const advances = Number(watch("advances")) || 0;
  const deductions = Number(watch("deductions")) || 0;
  const netSalary = earnings + overtimeAmount - advances - deductions;

  async function onSubmit(values: PayrollInput) {
    const result = salaryId ? await updatePayrollAction(salaryId, values) : await createPayrollAction(values);
    if (result.ok) {
      toast.success(isEdit ? "Salary record updated." : "Salary record created.");
      router.push(`/payroll/${result.data.id}`);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardContent className="grid grid-cols-1 gap-3 pt-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="personType">Person Type *</Label>
            {/* The person on an existing record can't change; only amounts and period are editable. */}
            <Select
              value={personType}
              disabled={isEdit}
              onValueChange={(v) => {
                setValue("personType", v as PayrollInput["personType"]);
                setValue("employeeId", "");
                setValue("labourId", "");
              }}
            >
              <SelectTrigger id="personType" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYROLL_PERSON_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t === "EMPLOYEE" ? "Employee" : "Labour"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="payroll-person">Person *</Label>
            {personType === "EMPLOYEE" ? (
              <Select value={employeeId || ""} disabled={isEdit} onValueChange={(v) => setValue("employeeId", v)}>
                <SelectTrigger id="payroll-person" className="w-full">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employeeOptions.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} ({e.employeeCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select value={labourId || ""} disabled={isEdit} onValueChange={(v) => setValue("labourId", v)}>
                <SelectTrigger id="payroll-person" className="w-full">
                  <SelectValue placeholder="Select labour" />
                </SelectTrigger>
                <SelectContent>
                  {labourOptions.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} ({l.labourCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {errors.employeeId && <p className="text-xs text-destructive">{errors.employeeId.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="periodStart">Period Start *</Label>
            <Input id="periodStart" type="date" {...register("periodStart")} />
            {errors.periodStart && <p className="text-xs text-destructive">{errors.periodStart.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="periodEnd">Period End *</Label>
            <Input id="periodEnd" type="date" {...register("periodEnd")} />
            {errors.periodEnd && <p className="text-xs text-destructive">{errors.periodEnd.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="earnings">Earnings *</Label>
            <Input id="earnings" type="number" step="0.01" min="0" {...register("earnings")} />
            {errors.earnings && <p className="text-xs text-destructive">{errors.earnings.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="overtimeAmount">Overtime Amount</Label>
            <Input id="overtimeAmount" type="number" step="0.01" min="0" {...register("overtimeAmount")} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="advances">Advances</Label>
            <Input id="advances" type="number" step="0.01" min="0" {...register("advances")} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="deductions">Deductions</Label>
            <Input id="deductions" type="number" step="0.01" min="0" {...register("deductions")} />
            {errors.deductions && <p className="text-xs text-destructive">{errors.deductions.message}</p>}
          </div>

          <div className="sm:col-span-2 rounded-md border bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Net Salary (earnings + overtime − advances − deductions)</p>
            <p className="text-xl font-semibold">{netSalary.toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : isEdit ? "Save Changes" : "Create Salary Record"}
      </Button>
    </form>
  );
}
