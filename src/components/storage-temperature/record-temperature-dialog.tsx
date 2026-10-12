"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TEMPERATURE_READING_MAX_C,
  TEMPERATURE_READING_MIN_C,
  type TemperatureLogInput,
} from "@/lib/validators/storage-temperature";
import { recordTemperatureLogAction } from "@/lib/actions/storage-temperature-actions";

export type TempItemOption = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  storageMinTempC: number | null;
  storageMaxTempC: number | null;
};

export type WarehouseOption = { id: string; name: string };
export type LocationOption = { id: string; warehouseId: string; label: string };

const formSchema = z.object({
  itemId: z.string().min(1, "Item is required."),
  batchNumber: z.string().default(""),
  warehouseId: z.string().min(1, "Warehouse is required."),
  locationId: z.string().default(""),
  recordedTempC: z
    .string()
    .trim()
    .min(1, "Enter the recorded temperature.")
    .refine((v) => Number.isFinite(Number(v)), "Enter a valid temperature.")
    .refine(
      (v) => Number(v) >= TEMPERATURE_READING_MIN_C && Number(v) <= TEMPERATURE_READING_MAX_C,
      `Temperature must be between ${TEMPERATURE_READING_MIN_C}°C and ${TEMPERATURE_READING_MAX_C}°C.`,
    ),
  remarks: z.string().default(""),
});

type FormValues = z.infer<typeof formSchema>;
type FormInput = z.input<typeof formSchema>;

export function RecordTemperatureDialog({
  trigger,
  items,
  warehouses,
  locations,
  defaultItemId,
}: {
  trigger: ReactNode;
  items: TempItemOption[];
  warehouses: WarehouseOption[];
  locations: LocationOption[];
  defaultItemId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      itemId: defaultItemId ?? "",
      batchNumber: "",
      warehouseId: "",
      locationId: "",
      recordedTempC: "",
      remarks: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        itemId: defaultItemId ?? "",
        batchNumber: "",
        warehouseId: "",
        locationId: "",
        recordedTempC: "",
        remarks: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selectedItemId = watch("itemId");
  const selectedWarehouseId = watch("warehouseId");
  const selectedItem = useMemo(() => items.find((i) => i.id === selectedItemId), [items, selectedItemId]);
  const locationsForWarehouse = useMemo(
    () => locations.filter((l) => l.warehouseId === selectedWarehouseId),
    [locations, selectedWarehouseId],
  );

  async function onSubmit(values: FormValues) {
    const payload: TemperatureLogInput = {
      itemId: values.itemId,
      batchNumber: values.batchNumber || null,
      warehouseId: values.warehouseId,
      locationId: values.locationId || null,
      recordedTempC: Number(values.recordedTempC),
      remarks: values.remarks || null,
    };
    const result = await recordTemperatureLogAction(payload);
    if (result.ok) {
      const status = result.data.status;
      if (status === "CRITICAL") {
        toast.error("Reading recorded — status CRITICAL. Store Manager notified.");
      } else if (status === "WARNING") {
        toast.warning("Reading recorded — status WARNING. Store Manager notified.");
      } else {
        toast.success("Reading recorded — status NORMAL.");
      }
      setOpen(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Record Temperature Reading</DialogTitle>
            <DialogDescription>
              Log a manual reading. Status (NORMAL / WARNING / CRITICAL) is computed automatically from the
              item&apos;s configured storage range.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="record-temp-item">Item</Label>
              <Controller
                control={control}
                name="itemId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="record-temp-item" className="w-full">
                      <SelectValue placeholder="Select a temperature-sensitive item" />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name} ({i.sku})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.itemId && <p className="text-sm text-destructive">{errors.itemId.message}</p>}
              {selectedItem && (
                <p className="text-xs text-muted-foreground">
                  Recommended range:{" "}
                  {selectedItem.storageMinTempC != null && selectedItem.storageMaxTempC != null
                    ? `${selectedItem.storageMinTempC}–${selectedItem.storageMaxTempC}°C`
                    : "not configured"}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="temp-batch">Batch number (optional)</Label>
              <Input id="temp-batch" placeholder="e.g. BATCH-2026-0142" {...register("batchNumber")} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="temp-value">Recorded temperature (°C)</Label>
              <Input
                id="temp-value"
                type="number"
                step="0.1"
                min={TEMPERATURE_READING_MIN_C}
                max={TEMPERATURE_READING_MAX_C}
                {...register("recordedTempC")}
                aria-invalid={!!errors.recordedTempC}
              />
              {errors.recordedTempC && <p className="text-sm text-destructive">{errors.recordedTempC.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="record-temp-warehouse">Warehouse</Label>
              <Controller
                control={control}
                name="warehouseId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      setValue("locationId", "");
                    }}
                  >
                    <SelectTrigger id="record-temp-warehouse" className="w-full">
                      <SelectValue placeholder="Select warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.warehouseId && <p className="text-sm text-destructive">{errors.warehouseId.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="record-temp-location">Location (optional)</Label>
              <Controller
                control={control}
                name="locationId"
                render={({ field }) => (
                  <Select
                    value={field.value || "none"}
                    onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                    disabled={!selectedWarehouseId}
                  >
                    <SelectTrigger id="record-temp-location" className="w-full">
                      <SelectValue placeholder="Unspecified" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unspecified</SelectItem>
                      {locationsForWarehouse.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="temp-remarks">Remarks (optional)</Label>
              <Textarea id="temp-remarks" rows={2} {...register("remarks")} />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Record reading"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
