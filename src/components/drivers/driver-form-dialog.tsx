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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { driverSchema, DRIVER_STATUSES, type DriverInput } from "@/lib/validators/driver";
import { createDriverAction, updateDriverAction } from "@/lib/actions/driver-actions";

type DriverFormInput = z.input<typeof driverSchema>;

export function DriverFormDialog({
  mode,
  driverId,
  defaultValues,
  trigger,
}: {
  mode: "create" | "edit";
  driverId?: string;
  defaultValues?: Partial<DriverInput>;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DriverFormInput, unknown, DriverInput>({
    resolver: zodResolver(driverSchema),
    defaultValues: {
      fullName: "",
      mobile: "",
      status: "ACTIVE",
      ...defaultValues,
    },
  });

  const status = watch("status");

  async function onSubmit(values: DriverInput) {
    const result = mode === "create" ? await createDriverAction(values) : await updateDriverAction(driverId!, values);

    if (result.ok) {
      toast.success(mode === "create" ? "Driver created." : "Driver updated.");
      setOpen(false);
      if (mode === "create") reset();
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
        if (!next) reset({ fullName: "", mobile: "", status: "ACTIVE", ...defaultValues });
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New Driver" : "Edit Driver"}</DialogTitle>
          <DialogDescription>Basic employment details only — identity documents are managed separately.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="employeeId">Employee ID</Label>
            <Input id="employeeId" placeholder="DRV-001" {...register("employeeId")} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="fullName">Full Name *</Label>
            <Input id="fullName" {...register("fullName")} />
            {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="mobile">Mobile *</Label>
            <Input id="mobile" {...register("mobile")} />
            {errors.mobile && <p className="text-xs text-destructive">{errors.mobile.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="altMobile">Alt Mobile</Label>
            <Input id="altMobile" {...register("altMobile")} />
            {errors.altMobile && <p className="text-xs text-destructive">{errors.altMobile.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="dob">Date of Birth</Label>
            <Input id="dob" type="date" {...register("dob")} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="joiningDate">Joining Date</Label>
            <Input id="joiningDate" type="date" {...register("joiningDate")} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="emergencyContact">Emergency Contact</Label>
            <Input id="emergencyContact" {...register("emergencyContact")} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="driver-status">Status *</Label>
            <Select value={status} onValueChange={(v) => setValue("status", v as DriverInput["status"])}>
              <SelectTrigger id="driver-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DRIVER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="profilePhotoUrl">Profile Photo URL</Label>
            <Input id="profilePhotoUrl" placeholder="https://..." {...register("profilePhotoUrl")} />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" rows={2} {...register("address")} />
          </div>

          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : mode === "create" ? "Create Driver" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
