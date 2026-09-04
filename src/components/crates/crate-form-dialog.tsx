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
import { crateSchema, type CrateInput } from "@/lib/validators/crate";
import { createCrateAction, updateCrateAction } from "@/lib/actions/crate-actions";

type FormInput = z.input<typeof crateSchema>;

export type CustomerOption = { id: string; name: string; customerCode: string };

export type CrateEditing = {
  id: string;
  crateCode: string;
  crateType: string;
  capacity: string | null;
  currentLocation: string | null;
  customerId: string | null;
  condition: string | null;
};

const EMPTY_VALUES: FormInput = {
  crateType: "",
  capacity: "",
  currentLocation: "",
  customerId: "",
  condition: "",
};

export function CrateFormDialog({
  trigger,
  customers,
  editing,
  onSaved,
}: {
  trigger: ReactNode;
  customers: CustomerOption[];
  editing?: CrateEditing;
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
  } = useForm<FormInput, unknown, CrateInput>({
    resolver: zodResolver(crateSchema),
    defaultValues: editing
      ? {
          crateType: editing.crateType,
          capacity: editing.capacity ?? "",
          currentLocation: editing.currentLocation ?? "",
          customerId: editing.customerId ?? "",
          condition: editing.condition ?? "",
        }
      : EMPTY_VALUES,
  });

  useEffect(() => {
    if (open) {
      reset(
        editing
          ? {
              crateType: editing.crateType,
              capacity: editing.capacity ?? "",
              currentLocation: editing.currentLocation ?? "",
              customerId: editing.customerId ?? "",
              condition: editing.condition ?? "",
            }
          : EMPTY_VALUES,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: CrateInput) {
    const result = isEdit ? await updateCrateAction(editing!.id, values) : await createCrateAction(values);

    if (result.ok) {
      toast.success(isEdit ? "Crate updated." : "Crate created.");
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
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit Crate ${editing!.crateCode}` : "New Crate"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this crate's details. Use \"Change status\" to move it between states."
              : "Crate codes are generated automatically."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="crate-type">Crate type *</FieldLabel>
              <Input id="crate-type" placeholder="e.g. Plastic Crate — Large" {...register("crateType")} aria-invalid={!!errors.crateType} />
              <FieldError errors={[errors.crateType]} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="crate-capacity">Capacity</FieldLabel>
                <Input id="crate-capacity" placeholder="e.g. 25 kg" {...register("capacity")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="crate-condition">Condition</FieldLabel>
                <Input id="crate-condition" placeholder="e.g. Good" {...register("condition")} />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="crate-location">Current location</FieldLabel>
              <Input id="crate-location" placeholder="e.g. Warehouse A - Dock 2" {...register("currentLocation")} />
            </Field>

            <Field>
              <FieldLabel htmlFor="crate-customer">Customer (if with customer)</FieldLabel>
              <Controller
                control={control}
                name="customerId"
                render={({ field }) => (
                  <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                    <SelectTrigger id="crate-customer" className="w-full">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.customerCode})
                        </SelectItem>
                      ))}
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
              {isSubmitting ? "Saving..." : isEdit ? "Save changes" : "Create crate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
