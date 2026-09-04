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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldLabel, FieldError, FieldGroup } from "@/components/ui/field";
import { routeClusterSchema, type RouteClusterInput } from "@/lib/validators/route";
import { createRouteClusterAction, updateRouteClusterAction } from "@/lib/actions/route-actions";

type FormInput = z.input<typeof routeClusterSchema>;

export type RouteClusterEditing = {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "INACTIVE";
};

const EMPTY_VALUES: FormInput = { name: "", description: "", status: "ACTIVE" };

export function RouteClusterFormDialog({
  trigger,
  editing,
  onSaved,
}: {
  trigger: ReactNode;
  editing?: RouteClusterEditing;
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
  } = useForm<FormInput, unknown, RouteClusterInput>({
    resolver: zodResolver(routeClusterSchema),
    defaultValues: editing
      ? { name: editing.name, description: editing.description ?? "", status: editing.status }
      : EMPTY_VALUES,
  });

  useEffect(() => {
    if (open) {
      reset(
        editing
          ? { name: editing.name, description: editing.description ?? "", status: editing.status }
          : EMPTY_VALUES,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: RouteClusterInput) {
    const result = isEdit
      ? await updateRouteClusterAction(editing!.id, values)
      : await createRouteClusterAction(values);

    if (result.ok) {
      toast.success(isEdit ? "Cluster updated." : "Cluster created.");
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Cluster" : "New Route Cluster"}</DialogTitle>
          <DialogDescription>Group routes together for planning and reporting.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="cluster-name">Name *</FieldLabel>
              <Input id="cluster-name" {...register("name")} aria-invalid={!!errors.name} />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="cluster-description">Description</FieldLabel>
              <Textarea id="cluster-description" rows={2} {...register("description")} />
            </Field>

            <Field>
              <FieldLabel htmlFor="cluster-status">Status</FieldLabel>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="cluster-status" className="w-full">
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
              {isSubmitting ? "Saving..." : isEdit ? "Save changes" : "Create cluster"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
