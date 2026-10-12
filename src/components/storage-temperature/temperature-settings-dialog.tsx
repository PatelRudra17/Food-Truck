"use client";

import { useEffect, useState, type ReactNode } from "react";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STORAGE_TYPES, type TemperatureSettingsInput } from "@/lib/validators/storage-temperature";
import { updateItemTemperatureSettingsAction } from "@/lib/actions/storage-temperature-actions";

export type TempSettingsItem = {
  id: string;
  name: string;
  isTemperatureSensitive: boolean;
  storageMinTempC: number | null;
  storageMaxTempC: number | null;
  storageType: string | null;
  shelfLifeDays: number | null;
};

const blankOrNumber = (message: string) =>
  z
    .string()
    .trim()
    .default("")
    .refine((v) => v === "" || Number.isFinite(Number(v)), message);

const formSchema = z
  .object({
    isTemperatureSensitive: z.boolean().default(true),
    storageMinTempC: blankOrNumber("Enter a valid temperature."),
    storageMaxTempC: blankOrNumber("Enter a valid temperature."),
    storageType: z.string().default(""),
    shelfLifeDays: blankOrNumber("Enter a valid number of days.").refine(
      (v) => v === "" || (Number.isInteger(Number(v)) && Number(v) >= 0),
      "Shelf life must be a whole number of days, 0 or more.",
    ),
  })
  .refine(
    (d) =>
      d.storageMinTempC === "" ||
      d.storageMaxTempC === "" ||
      Number(d.storageMinTempC) <= Number(d.storageMaxTempC),
    { message: "Minimum temperature must not exceed the maximum.", path: ["storageMaxTempC"] },
  );

type FormValues = z.infer<typeof formSchema>;
type FormInput = z.input<typeof formSchema>;

function toValues(item: TempSettingsItem): FormValues {
  return {
    isTemperatureSensitive: item.isTemperatureSensitive,
    storageMinTempC: item.storageMinTempC != null ? String(item.storageMinTempC) : "",
    storageMaxTempC: item.storageMaxTempC != null ? String(item.storageMaxTempC) : "",
    storageType: item.storageType ?? "",
    shelfLifeDays: item.shelfLifeDays != null ? String(item.shelfLifeDays) : "",
  };
}

/**
 * Minimal, standalone "Temperature Settings" editor scoped to just the plan2
 * temperature-configuration fields on Item (isTemperatureSensitive/min/max/
 * storageType/shelfLifeDays). Gated by ITEM_EDIT — the Item Master module owns
 * the rest of the Item form; this does not duplicate or restructure it.
 */
export function TemperatureSettingsDialog({ trigger, item }: { trigger: ReactNode; item: TempSettingsItem }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: toValues(item),
  });

  useEffect(() => {
    if (open) reset(toValues(item));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: FormValues) {
    const payload: TemperatureSettingsInput = {
      isTemperatureSensitive: values.isTemperatureSensitive,
      storageMinTempC: values.storageMinTempC === "" ? null : Number(values.storageMinTempC),
      storageMaxTempC: values.storageMaxTempC === "" ? null : Number(values.storageMaxTempC),
      storageType: (values.storageType || null) as TemperatureSettingsInput["storageType"],
      shelfLifeDays: values.shelfLifeDays === "" ? null : Number(values.shelfLifeDays),
    };
    const result = await updateItemTemperatureSettingsAction(item.id, payload);
    if (result.ok) {
      toast.success("Temperature settings updated.");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Temperature Settings — {item.name}</DialogTitle>
            <DialogDescription>
              Configure the recommended storage range used to evaluate every reading for this item.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="isTemperatureSensitive"
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} id="temp-sensitive" />
                )}
              />
              <Label htmlFor="temp-sensitive">Temperature-sensitive item</Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="temp-min">Min temp (°C)</Label>
                <Input id="temp-min" type="number" step="0.1" {...register("storageMinTempC")} />
                {errors.storageMinTempC && (
                  <p className="text-sm text-destructive">{errors.storageMinTempC.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="temp-max">Max temp (°C)</Label>
                <Input id="temp-max" type="number" step="0.1" {...register("storageMaxTempC")} />
                {errors.storageMaxTempC && (
                  <p className="text-sm text-destructive">{errors.storageMaxTempC.message}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="temp-storageType">Storage type</Label>
              <Controller
                control={control}
                name="storageType"
                render={({ field }) => (
                  <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                    <SelectTrigger id="temp-storageType" className="w-full">
                      <SelectValue placeholder="Not set" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not set</SelectItem>
                      {STORAGE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="temp-shelf">Shelf life (days)</Label>
              <Input id="temp-shelf" type="number" step="1" min="0" {...register("shelfLifeDays")} />
              {errors.shelfLifeDays && <p className="text-sm text-destructive">{errors.shelfLifeDays.message}</p>}
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save settings"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
