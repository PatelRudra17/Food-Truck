"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createFuelEntryAction } from "@/lib/actions/fuel-actions";
import { FUEL_TYPES } from "@/lib/validators/fuel";

type VehicleOption = { id: string; vehicleNumber: string; odometerKm: number; fuelType: string | null };
type DriverOption = { id: string; fullName: string };

const formSchema = z.object({
  vehicleId: z.string().min(1, "Vehicle is required."),
  date: z.string().min(1, "Date is required."),
  time: z.string().default(""),
  driverId: z.string().default(""),
  tripId: z.string().default(""),
  fuelStationVendor: z.string().trim().min(1, "Fuel station / vendor is required."),
  fuelType: z.string().min(1, "Fuel type is required."),
  previousOdometerKm: z.coerce.number().nonnegative("Must be zero or greater."),
  currentOdometerKm: z.coerce.number().positive("Must be greater than zero."),
  fuelQuantityLiters: z.coerce.number().positive("Must be greater than zero."),
  fuelRate: z.coerce.number().positive("Must be greater than zero."),
  remarks: z.string().default(""),
});

type FormValues = z.infer<typeof formSchema>;
type FormInput = z.input<typeof formSchema>;

export function FuelForm({
  vehicleOptions,
  driverOptions,
}: {
  vehicleOptions: VehicleOption[];
  driverOptions: DriverOption[];
}) {
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
      date: format(new Date(), "yyyy-MM-dd"),
      time: format(new Date(), "HH:mm"),
      driverId: "",
      tripId: "",
      fuelStationVendor: "",
      fuelType: "Diesel",
      previousOdometerKm: 0,
      currentOdometerKm: 0,
      fuelQuantityLiters: 0,
      fuelRate: 0,
      remarks: "",
    },
  });

  const fuelQuantity = Number(watch("fuelQuantityLiters")) || 0;
  const fuelRate = Number(watch("fuelRate")) || 0;
  const previousOdometerKm = Number(watch("previousOdometerKm")) || 0;
  const currentOdometerKm = Number(watch("currentOdometerKm")) || 0;
  const estimatedDistance = Math.max(0, currentOdometerKm - previousOdometerKm);
  const estimatedCost = fuelQuantity * fuelRate;
  const estimatedMileage = fuelQuantity > 0 && estimatedDistance > 0 ? estimatedDistance / fuelQuantity : null;

  function handleVehicleChange(vehicleId: string) {
    setValue("vehicleId", vehicleId);
    const vehicle = vehicleOptions.find((v) => v.id === vehicleId);
    if (vehicle) {
      // Default-suggest the vehicle's current odometer reading; the user may override it.
      setValue("previousOdometerKm", vehicle.odometerKm);
      if (vehicle.fuelType) setValue("fuelType", vehicle.fuelType);
    }
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) => {
      formData.set(key, String(value ?? ""));
    });
    const file = fileRef.current?.files?.[0];
    if (file) formData.set("receipt", file);

    const result = await createFuelEntryAction(formData);
    if (result.ok) {
      toast.success("Fuel entry logged.");
      router.push("/fuel");
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
              <Label htmlFor="fuel-vehicle">Vehicle</Label>
              <Controller
                control={control}
                name="vehicleId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={handleVehicleChange}>
                    <SelectTrigger id="fuel-vehicle" className="w-full">
                      <SelectValue placeholder="Select vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicleOptions.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.vehicleNumber} ({v.odometerKm.toLocaleString()} km)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.vehicleId && <p className="text-sm text-destructive">{errors.vehicleId.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" {...register("date")} />
              {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="time">Time</Label>
              <Input id="time" type="time" {...register("time")} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fuel-driver">Driver (optional)</Label>
              <Controller
                control={control}
                name="driverId"
                render={({ field }) => (
                  <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                    <SelectTrigger id="fuel-driver" className="w-full">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {driverOptions.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tripId">Trip ID (optional)</Label>
              <Input id="tripId" {...register("tripId")} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fuelType">Fuel type</Label>
              <Controller
                control={control}
                name="fuelType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="fuelType" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FUEL_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fuelStationVendor">Fuel station / vendor</Label>
              <Input id="fuelStationVendor" {...register("fuelStationVendor")} />
              {errors.fuelStationVendor && (
                <p className="text-sm text-destructive">{errors.fuelStationVendor.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="previousOdometerKm">Previous odometer (km)</Label>
              <Input id="previousOdometerKm" type="number" step="0.1" {...register("previousOdometerKm")} />
              {errors.previousOdometerKm && (
                <p className="text-sm text-destructive">{errors.previousOdometerKm.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="currentOdometerKm">Current odometer (km)</Label>
              <Input id="currentOdometerKm" type="number" step="0.1" {...register("currentOdometerKm")} />
              {errors.currentOdometerKm && (
                <p className="text-sm text-destructive">{errors.currentOdometerKm.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fuelQuantityLiters">Fuel quantity (litres)</Label>
              <Input id="fuelQuantityLiters" type="number" step="0.01" {...register("fuelQuantityLiters")} />
              {errors.fuelQuantityLiters && (
                <p className="text-sm text-destructive">{errors.fuelQuantityLiters.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fuelRate">Fuel rate (₹ / litre)</Label>
              <Input id="fuelRate" type="number" step="0.01" {...register("fuelRate")} />
              {errors.fuelRate && <p className="text-sm text-destructive">{errors.fuelRate.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="receipt">Receipt (optional)</Label>
              <Input id="receipt" type="file" ref={fileRef} accept=".pdf,.jpg,.jpeg,.png" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea id="remarks" rows={2} {...register("remarks")} />
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-md border bg-muted/40 p-3 text-sm">
            <div>
              <p className="text-muted-foreground">Distance</p>
              <p className="font-medium tabular-nums">{estimatedDistance.toLocaleString()} km</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total cost</p>
              <p className="font-medium tabular-nums">₹{estimatedCost.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Mileage</p>
              <p className="font-medium tabular-nums">{estimatedMileage != null ? `${estimatedMileage.toFixed(2)} km/L` : "—"}</p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.push("/fuel")}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Log fuel entry"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
