"use client";

import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { employeeSchema, PERSON_STATUSES, type EmployeeInput } from "@/lib/validators/employee";
import { createEmployeeAction, updateEmployeeAction } from "@/lib/actions/employee-actions";

export type ShiftOption = { id: string; shiftName: string; date: string };

type EmployeeFormInput = z.input<typeof employeeSchema>;

export function EmployeeFormDialog({
  mode,
  employeeId,
  shiftOptions,
  defaultValues,
  trigger,
}: {
  mode: "create" | "edit";
  employeeId?: string;
  shiftOptions: ShiftOption[];
  defaultValues?: Partial<EmployeeInput>;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const initialValues: EmployeeFormInput = {
    name: "",
    mobile: "",
    status: "ACTIVE",
    ...defaultValues,
  };

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeFormInput, unknown, EmployeeInput>({
    resolver: zodResolver(employeeSchema),
    defaultValues: initialValues,
  });

  const status = watch("status");
  const shiftId = watch("shiftId");

  async function onSubmit(values: EmployeeInput) {
    const result =
      mode === "create" ? await createEmployeeAction(values) : await updateEmployeeAction(employeeId!, values);

    if (result.ok) {
      toast.success(mode === "create" ? "Employee created." : "Employee updated.");
      setOpen(false);
      if (mode === "create") reset(initialValues);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset(initialValues);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New Employee" : "Edit Employee"}</DialogTitle>
          <DialogDescription>Plain HR record — not linked to a login account.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="mobile">Mobile *</Label>
            <Input id="mobile" {...register("mobile")} />
            {errors.mobile && <p className="text-xs text-destructive">{errors.mobile.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="department">Department</Label>
            <Input id="department" placeholder="Sorting Floor, Warehouse..." {...register("department")} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="roleTitle">Role / Designation</Label>
            <Input id="roleTitle" placeholder="Supervisor, Staff..." {...register("roleTitle")} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="joiningDate">Joining Date</Label>
            <Input id="joiningDate" type="date" {...register("joiningDate")} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="employee-shift">Shift</Label>
            <Select
              value={shiftId || "none"}
              onValueChange={(v) => setValue("shiftId", v === "none" ? "" : v)}
            >
              <SelectTrigger id="employee-shift" className="w-full">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {shiftOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.shiftName} ({s.date})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="employee-status">Status *</Label>
            <Select value={status} onValueChange={(v) => setValue("status", v as EmployeeInput["status"])}>
              <SelectTrigger id="employee-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERSON_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : mode === "create" ? "Create Employee" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
