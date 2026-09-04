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
import { labourSchema, PERSON_STATUSES, type LabourInput } from "@/lib/validators/labour";
import { createLabourAction, updateLabourAction } from "@/lib/actions/labour-actions";

export type ShiftOption = { id: string; shiftName: string; date: string };

type LabourFormInput = z.input<typeof labourSchema>;

export function LabourFormDialog({
  mode,
  labourId,
  shiftOptions,
  defaultValues,
  trigger,
}: {
  mode: "create" | "edit";
  labourId?: string;
  shiftOptions: ShiftOption[];
  defaultValues?: Partial<LabourInput>;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const initialValues: LabourFormInput = {
    name: "",
    mobile: "",
    dailyWage: 0,
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
  } = useForm<LabourFormInput, unknown, LabourInput>({
    resolver: zodResolver(labourSchema),
    defaultValues: initialValues,
  });

  const status = watch("status");
  const shiftId = watch("shiftId");

  async function onSubmit(values: LabourInput) {
    const result = mode === "create" ? await createLabourAction(values) : await updateLabourAction(labourId!, values);

    if (result.ok) {
      toast.success(mode === "create" ? "Labour record created." : "Labour record updated.");
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
          <DialogTitle>{mode === "create" ? "New Labour" : "Edit Labour"}</DialogTitle>
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
            <Label htmlFor="workType">Work Type</Label>
            <Input id="workType" placeholder="Sorting, Loading/Unloading..." {...register("workType")} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="dailyWage">Daily Wage *</Label>
            <Input id="dailyWage" type="number" step="0.01" min="0" {...register("dailyWage")} />
            {errors.dailyWage && <p className="text-xs text-destructive">{errors.dailyWage.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="labour-shift">Shift</Label>
            <Select
              value={shiftId || "none"}
              onValueChange={(v) => setValue("shiftId", v === "none" ? "" : v)}
            >
              <SelectTrigger id="labour-shift" className="w-full">
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
            <Label htmlFor="labour-status">Status *</Label>
            <Select value={status} onValueChange={(v) => setValue("status", v as LabourInput["status"])}>
              <SelectTrigger id="labour-status" className="w-full">
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
              {isSubmitting ? "Saving..." : mode === "create" ? "Create Labour" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
