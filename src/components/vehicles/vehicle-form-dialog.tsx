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
import { vehicleSchema, VEHICLE_STATUSES, type VehicleInput } from "@/lib/validators/vehicle";
import { createVehicleAction, updateVehicleAction } from "@/lib/actions/vehicle-actions";

type DriverOption = { id: string; fullName: string; employeeId: string | null };
type VehicleFormInput = z.input<typeof vehicleSchema>;

export function VehicleFormDialog({
  mode,
  vehicleId,
  drivers,
  defaultValues,
  trigger,
}: {
  mode: "create" | "edit";
  vehicleId?: string;
  drivers: DriverOption[];
  defaultValues?: Partial<VehicleFormInput>;
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
  } = useForm<VehicleFormInput, unknown, VehicleInput>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      vehicleNumber: "",
      vehicleType: "",
      status: "AVAILABLE",
      ...defaultValues,
    },
  });

  const status = watch("status");
  const currentDriverId = watch("currentDriverId");

  async function onSubmit(values: VehicleInput) {
    const result =
      mode === "create" ? await createVehicleAction(values) : await updateVehicleAction(vehicleId!, values);

    if (result.ok) {
      toast.success(mode === "create" ? "Vehicle created." : "Vehicle updated.");
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
        if (!next) reset({ vehicleNumber: "", vehicleType: "", status: "AVAILABLE", ...defaultValues });
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New Vehicle" : "Edit Vehicle"}</DialogTitle>
          <DialogDescription>
            Core vehicle master details, plus the fuel-efficiency target and service schedule used for
            fuel anomaly detection and maintenance reminders.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="vehicleNumber">Vehicle Number *</Label>
            <Input id="vehicleNumber" placeholder="MH12AB1234" {...register("vehicleNumber")} />
            {errors.vehicleNumber && <p className="text-xs text-destructive">{errors.vehicleNumber.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="vehicleType">Vehicle Type *</Label>
            <Input id="vehicleType" placeholder="Truck, Mini Van, Tempo..." {...register("vehicleType")} />
            {errors.vehicleType && <p className="text-xs text-destructive">{errors.vehicleType.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="manufacturer">Manufacturer</Label>
            <Input id="manufacturer" {...register("manufacturer")} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="model">Model</Label>
            <Input id="model" {...register("model")} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="ownerCompany">Owner Company</Label>
            <Input id="ownerCompany" {...register("ownerCompany")} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="capacity">Capacity</Label>
            <Input id="capacity" placeholder="5 Ton" {...register("capacity")} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="registrationDate">Registration Date</Label>
            <Input id="registrationDate" type="date" {...register("registrationDate")} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="registrationExpiry">Registration Expiry</Label>
            <Input id="registrationExpiry" type="date" {...register("registrationExpiry")} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="insuranceExpiry">Insurance Expiry</Label>
            <Input id="insuranceExpiry" type="date" {...register("insuranceExpiry")} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="pucExpiry">PUC Expiry</Label>
            <Input id="pucExpiry" type="date" {...register("pucExpiry")} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="fitnessExpiry">Fitness Expiry</Label>
            <Input id="fitnessExpiry" type="date" {...register("fitnessExpiry")} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="permitExpiry">Permit Expiry</Label>
            <Input id="permitExpiry" type="date" {...register("permitExpiry")} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="currentDriverId">Current Driver</Label>
            <Select
              value={currentDriverId || "none"}
              onValueChange={(v) => setValue("currentDriverId", v === "none" ? "" : v)}
            >
              <SelectTrigger id="currentDriverId" className="w-full">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.fullName} {d.employeeId ? `(${d.employeeId})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="currentLocation">Current Location</Label>
            <Input id="currentLocation" {...register("currentLocation")} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="vehicle-status">Status *</Label>
            <Select value={status} onValueChange={(v) => setValue("status", v as VehicleInput["status"])}>
              <SelectTrigger id="vehicle-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VEHICLE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="fuelEfficiencyTargetKmpl">Fuel Efficiency Target (KM/L)</Label>
            <Input
              id="fuelEfficiencyTargetKmpl"
              type="number"
              step="0.01"
              min="0"
              {...register("fuelEfficiencyTargetKmpl")}
            />
            {errors.fuelEfficiencyTargetKmpl && (
              <p className="text-xs text-destructive">{errors.fuelEfficiencyTargetKmpl.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="serviceIntervalDays">Service Interval (days)</Label>
            <Input id="serviceIntervalDays" type="number" step="1" min="1" {...register("serviceIntervalDays")} />
            {errors.serviceIntervalDays && (
              <p className="text-xs text-destructive">{errors.serviceIntervalDays.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="serviceIntervalKm">Service Interval (KM)</Label>
            <Input id="serviceIntervalKm" type="number" step="0.1" min="0" {...register("serviceIntervalKm")} />
            {errors.serviceIntervalKm && <p className="text-xs text-destructive">{errors.serviceIntervalKm.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="nextServiceDate">Next Service Date</Label>
            <Input id="nextServiceDate" type="date" {...register("nextServiceDate")} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="nextServiceKm">Next Service at (KM)</Label>
            <Input id="nextServiceKm" type="number" step="0.1" min="0" {...register("nextServiceKm")} />
            {errors.nextServiceKm && <p className="text-xs text-destructive">{errors.nextServiceKm.message}</p>}
          </div>

          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="imageUrl">Image URL</Label>
            <Input id="imageUrl" placeholder="https://..." {...register("imageUrl")} />
          </div>

          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : mode === "create" ? "Create Vehicle" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
