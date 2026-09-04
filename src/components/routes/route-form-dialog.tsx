"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useForm, Controller } from "react-hook-form";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldLabel, FieldError, FieldGroup } from "@/components/ui/field";
import { routeSchema, type RouteInput } from "@/lib/validators/route";
import { createRouteAction, updateRouteAction } from "@/lib/actions/route-actions";

type FormInput = z.input<typeof routeSchema>;

export type ClusterOption = { id: string; name: string };

export type RouteEditing = {
  id: string;
  routeNumber: string;
  name: string;
  startLocation: string;
  destination: string;
  routeClusterId: string | null;
  estimatedDistanceKm: number | null;
  estimatedTimeMinutes: number | null;
  status: "ACTIVE" | "INACTIVE";
};

const EMPTY_VALUES: FormInput = {
  name: "",
  startLocation: "",
  destination: "",
  routeClusterId: "",
  estimatedDistanceKm: "",
  estimatedTimeMinutes: "",
  status: "ACTIVE",
};

export function RouteFormDialog({
  trigger,
  clusters,
  editing,
  onSaved,
}: {
  trigger: ReactNode;
  clusters: ClusterOption[];
  editing?: RouteEditing;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = !!editing;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, RouteInput>({
    resolver: zodResolver(routeSchema),
    defaultValues: editing
      ? {
          name: editing.name,
          startLocation: editing.startLocation,
          destination: editing.destination,
          routeClusterId: editing.routeClusterId ?? "",
          estimatedDistanceKm: editing.estimatedDistanceKm ?? "",
          estimatedTimeMinutes: editing.estimatedTimeMinutes ?? "",
          status: editing.status,
        }
      : EMPTY_VALUES,
  });

  useEffect(() => {
    if (open) {
      reset(
        editing
          ? {
              name: editing.name,
              startLocation: editing.startLocation,
              destination: editing.destination,
              routeClusterId: editing.routeClusterId ?? "",
              estimatedDistanceKm: editing.estimatedDistanceKm ?? "",
              estimatedTimeMinutes: editing.estimatedTimeMinutes ?? "",
              status: editing.status,
            }
          : EMPTY_VALUES,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: RouteInput) {
    const result = isEdit ? await updateRouteAction(editing!.id, values) : await createRouteAction(values);

    if (result.ok) {
      toast.success(isEdit ? "Route updated." : "Route created.");
      setOpen(false);
      router.refresh();
      onSaved?.();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit Route ${editing!.routeNumber}` : "New Route"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this route's details." : "Route numbers are generated automatically."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="route-name">Name *</FieldLabel>
              <Input id="route-name" {...register("name")} aria-invalid={!!errors.name} />
              <FieldError errors={[errors.name]} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="route-start">Start location *</FieldLabel>
                <Input id="route-start" {...register("startLocation")} aria-invalid={!!errors.startLocation} />
                <FieldError errors={[errors.startLocation]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="route-destination">Destination *</FieldLabel>
                <Input id="route-destination" {...register("destination")} aria-invalid={!!errors.destination} />
                <FieldError errors={[errors.destination]} />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="route-cluster">Cluster</FieldLabel>
              <Controller
                control={control}
                name="routeClusterId"
                render={({ field }) => (
                  <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                    <SelectTrigger id="route-cluster" className="w-full">
                      <SelectValue placeholder="No cluster" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No cluster</SelectItem>
                      {clusters.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="route-distance">Estimated distance (km)</FieldLabel>
                <Input id="route-distance" type="number" step="0.01" min="0" {...register("estimatedDistanceKm")} />
                <FieldError errors={[errors.estimatedDistanceKm]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="route-time">Estimated time (minutes)</FieldLabel>
                <Input id="route-time" type="number" step="1" min="0" {...register("estimatedTimeMinutes")} />
                <FieldError errors={[errors.estimatedTimeMinutes]} />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="route-status">Status</FieldLabel>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="route-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : isEdit ? "Save changes" : "Create route"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
