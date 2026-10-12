"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { MaintenanceType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createMaintenanceAction } from "@/lib/actions/maintenance-actions";
import { MAINTENANCE_TYPE_LABELS } from "@/lib/validators/maintenance";

type VehicleOption = { id: string; vehicleNumber: string; odometerKm: number };

const formSchema = z.object({
  vehicleId: z.string().min(1, "Vehicle is required."),
  maintenanceType: z.nativeEnum(MaintenanceType, { message: "Maintenance type is required." }),
  serviceDate: z.string().min(1, "Service date is required."),
  odometerKm: z.coerce.number().nonnegative("Must be zero or greater."),
  serviceCenterVendor: z.string().default(""),
  technician: z.string().default(""),
  workPerformed: z.string().default(""),
  partsReplaced: z.string().default(""),
  labourCost: z.coerce.number().nonnegative().default(0),
  partsCost: z.coerce.number().nonnegative().default(0),
  otherCost: z.coerce.number().nonnegative().default(0),
  remarks: z.string().default(""),
  markUnderMaintenance: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;
type FormInput = z.input<typeof formSchema>;

export function MaintenanceForm({ vehicleOptions }: { vehicleOptions: VehicleOption[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      vehicleId: "",
      maintenanceType: MaintenanceType.REGULAR_SERVICE,
      serviceDate: format(new Date(), "yyyy-MM-dd"),
      odometerKm: 0,
      serviceCenterVendor: "",
      technician: "",
      workPerformed: "",
      partsReplaced: "",
      labourCost: 0,
      partsCost: 0,
      otherCost: 0,
      remarks: "",
      markUnderMaintenance: false,
    },
  });

  const labourCost = Number(watch("labourCost")) || 0;
  const partsCost = Number(watch("partsCost")) || 0;
  const otherCost = Number(watch("otherCost")) || 0;
  const estimatedTotal = labourCost + partsCost + otherCost;

  function handleVehicleChange(vehicleId: string) {
    setValue("vehicleId", vehicleId);
    const vehicle = vehicleOptions.find((v) => v.id === vehicleId);
    if (vehicle) {
      // Default-suggest the vehicle's current odometer reading; the user may override it.
      setValue("odometerKm", vehicle.odometerKm);
    }
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) => {
      formData.set(key, String(value ?? ""));
    });
    const file = fileRef.current?.files?.[0];
    if (file) formData.set("attachment", file);

    const result = await createMaintenanceAction(formData);
    if (result.ok) {
      toast.success("Maintenance record logged.");
      router.push("/maintenance");
      router.refresh();
    } else {
      setServerError(result.error);
      toast.error(result.error);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {serverError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="maint-vehicle">Vehicle</Label>
              <Controller
                control={control}
                name="vehicleId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={handleVehicleChange}>
                    <SelectTrigger id="maint-vehicle" className="w-full">
                      <SelectValue placeholder="Select vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicleOptions.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.vehicleNumber} ({v.odometerKm.toLocaleString("en-IN")} km)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.vehicleId && <p className="text-sm text-destructive">{errors.vehicleId.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="maintenanceType">Maintenance type</Label>
              <Controller
                control={control}
                name="maintenanceType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="maintenanceType" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(MAINTENANCE_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="serviceDate">Service date</Label>
              <Input id="serviceDate" type="date" {...register("serviceDate")} />
              {errors.serviceDate && <p className="text-sm text-destructive">{errors.serviceDate.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="odometerKm">Odometer (km)</Label>
              <Input id="odometerKm" type="number" step="0.1" {...register("odometerKm")} />
              {errors.odometerKm && <p className="text-sm text-destructive">{errors.odometerKm.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="serviceCenterVendor">Service center / vendor</Label>
              <Input id="serviceCenterVendor" {...register("serviceCenterVendor")} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="technician">Technician</Label>
              <Input id="technician" {...register("technician")} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="labourCost">Labour cost (₹)</Label>
              <Input id="labourCost" type="number" step="0.01" {...register("labourCost")} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="partsCost">Parts cost (₹)</Label>
              <Input id="partsCost" type="number" step="0.01" {...register("partsCost")} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="otherCost">Other cost (₹)</Label>
              <Input id="otherCost" type="number" step="0.01" {...register("otherCost")} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="attachment">Invoice (optional)</Label>
              <Input id="attachment" type="file" ref={fileRef} accept=".pdf,.jpg,.jpeg,.png" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="workPerformed">Work performed</Label>
            <Textarea id="workPerformed" rows={2} {...register("workPerformed")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="partsReplaced">Parts replaced</Label>
            <Textarea id="partsReplaced" rows={2} {...register("partsReplaced")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea id="remarks" rows={2} {...register("remarks")} />
          </div>

          <Controller
            control={control}
            name="markUnderMaintenance"
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                Mark vehicle as under maintenance now
              </label>
            )}
          />

          <div className="flex items-center justify-between rounded-md border bg-muted/40 p-3 text-sm">
            <p className="text-muted-foreground">Total cost</p>
            <p className="font-medium tabular-nums">₹{estimatedTotal.toLocaleString("en-IN")}</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.push("/maintenance")}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Log maintenance"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
