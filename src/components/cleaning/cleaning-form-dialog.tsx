"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
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
import { createCleaningAction } from "@/lib/actions/cleaning-actions";
import {
  cleaningSchema,
  CLEANING_ENTITY_TYPES,
  CLEANING_ENTITY_TYPE_LABELS,
  type CleaningInput,
} from "@/lib/validators/cleaning";

type Option = { id: string; label: string };
type CleaningFormInput = z.input<typeof cleaningSchema>;

export function CleaningFormDialog({
  trigger,
  vehicleOptions,
  crateOptions,
  staffOptions,
}: {
  trigger: ReactNode;
  vehicleOptions: Option[];
  crateOptions: Option[];
  staffOptions: Option[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CleaningFormInput, unknown, CleaningInput>({
    resolver: zodResolver(cleaningSchema),
    defaultValues: {
      entityType: "VEHICLE",
      vehicleId: "",
      crateId: "",
      locationText: "",
      cleaningType: "",
      startTime: "",
      endTime: "",
      staffId: "",
      remarks: "",
    },
  });

  const entityType = watch("entityType");

  async function onSubmit(values: CleaningInput) {
    setServerError(null);
    const result = await createCleaningAction(values);
    if (result.ok) {
      toast.success("Cleaning record logged.");
      setOpen(false);
      reset();
      router.refresh();
    } else {
      setServerError(result.error);
      toast.error(result.error);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          reset();
          setServerError(null);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log a cleaning record</DialogTitle>
          <DialogDescription>Track a vehicle, crate, or location cleaning task.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="entityType">What is being cleaned?</Label>
            <Controller
              control={control}
              name="entityType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="entityType" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLEANING_ENTITY_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {CLEANING_ENTITY_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {entityType === "VEHICLE" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cleaning-vehicle">Vehicle</Label>
              <Controller
                control={control}
                name="vehicleId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="cleaning-vehicle" className="w-full">
                      <SelectValue placeholder="Select vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicleOptions.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.vehicleId && <p className="text-sm text-destructive">{errors.vehicleId.message}</p>}
            </div>
          )}

          {entityType === "CRATE" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cleaning-crate">Crate</Label>
              <Controller
                control={control}
                name="crateId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="cleaning-crate" className="w-full">
                      <SelectValue placeholder="Select crate" />
                    </SelectTrigger>
                    <SelectContent>
                      {crateOptions.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.crateId && <p className="text-sm text-destructive">{errors.crateId.message}</p>}
            </div>
          )}

          {entityType === "LOCATION" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="locationText">Location</Label>
              <Input id="locationText" placeholder="e.g. Warehouse floor, Loading bay" {...register("locationText")} />
              {errors.locationText && <p className="text-sm text-destructive">{errors.locationText.message}</p>}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cleaningType">Cleaning type</Label>
              <Input id="cleaningType" placeholder="e.g. Full wash, Sanitization" {...register("cleaningType")} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cleaning-staff">Assigned staff</Label>
              <Controller
                control={control}
                name="staffId"
                render={({ field }) => (
                  <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                    <SelectTrigger id="cleaning-staff" className="w-full">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {staffOptions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="startTime">Start time (optional)</Label>
              <Input id="startTime" type="datetime-local" {...register("startTime")} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="endTime">End time (optional)</Label>
              <Input id="endTime" type="datetime-local" {...register("endTime")} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea id="remarks" rows={2} {...register("remarks")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Log cleaning"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
