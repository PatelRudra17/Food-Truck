"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { LogIn } from "lucide-react";
import {
  recordVehicleInSchema,
  type RecordVehicleInInput,
} from "@/lib/validators/gate";
import { recordVehicleInAction } from "@/lib/actions/gate-actions";

const NO_SUPPLIER = "__none__";

type RecordVehicleInFormInput = z.input<typeof recordVehicleInSchema>;

export type Option = { id: string; label: string; sublabel?: string };

export function RecordInDialog({
  vehicles,
  drivers,
  suppliers,
}: {
  vehicles: Option[];
  drivers: Option[];
  suppliers: Option[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RecordVehicleInFormInput, unknown, RecordVehicleInInput>({
    resolver: zodResolver(recordVehicleInSchema),
    defaultValues: {
      vehicleId: "",
      driverId: "",
      supplierId: null,
      purpose: null,
      material: null,
      remarks: null,
    },
  });

  async function onSubmit(values: RecordVehicleInInput) {
    const result = await recordVehicleInAction(values);
    if (result.ok) {
      toast.success(`Vehicle recorded in — ${result.data.gateEntryNumber}`);
      reset();
      setOpen(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <LogIn /> Record Vehicle In
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Vehicle In</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Vehicle *</Label>
            <Select
              value={watch("vehicleId") || undefined}
              onValueChange={(v) => setValue("vehicleId", v, { shouldValidate: true })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select vehicle" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.label}
                    {v.sublabel ? ` — ${v.sublabel}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.vehicleId && (
              <p className="text-sm text-destructive">{errors.vehicleId.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Driver *</Label>
            <Select
              value={watch("driverId") || undefined}
              onValueChange={(v) => setValue("driverId", v, { shouldValidate: true })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select driver" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.driverId && (
              <p className="text-sm text-destructive">{errors.driverId.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Supplier (optional)</Label>
            <Select
              value={watch("supplierId") ?? NO_SUPPLIER}
              onValueChange={(v) => setValue("supplierId", v === NO_SUPPLIER ? null : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SUPPLIER}>None</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Purpose</Label>
              <Input {...register("purpose")} placeholder="e.g. Delivery" />
            </div>
            <div className="space-y-1.5">
              <Label>Material</Label>
              <Input {...register("material")} placeholder="e.g. Vegetables" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Remarks</Label>
            <Textarea {...register("remarks")} rows={2} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Recording..." : "Record In"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
