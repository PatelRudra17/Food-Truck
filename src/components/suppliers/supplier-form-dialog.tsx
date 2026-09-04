"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldLabel, FieldError, FieldGroup } from "@/components/ui/field";
import { supplierSchema, type SupplierInput } from "@/lib/validators/supplier";
import { createSupplierAction, updateSupplierAction } from "@/lib/actions/supplier-actions";

export type SupplierFormValues = {
  id?: string;
  code: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  gstNumber: string;
  panNumber: string;
  status: "ACTIVE" | "INACTIVE";
};

type SupplierFormInput = z.input<typeof supplierSchema>;

const EMPTY_VALUES: SupplierFormValues = {
  code: "",
  companyName: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  gstNumber: "",
  panNumber: "",
  status: "ACTIVE",
};

export function SupplierFormDialog({
  trigger,
  supplier,
}: {
  trigger: React.ReactNode;
  supplier?: SupplierFormValues;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = !!supplier?.id;

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormInput, unknown, SupplierInput>({
    resolver: zodResolver(supplierSchema),
    defaultValues: supplier ?? EMPTY_VALUES,
  });

  useEffect(() => {
    if (open) {
      reset(supplier ?? EMPTY_VALUES);
    }
  }, [open, supplier, reset]);

  async function onSubmit(values: SupplierInput) {
    const result = isEdit
      ? await updateSupplierAction(supplier!.id!, values)
      : await createSupplierAction(values);

    if (result.ok) {
      toast.success(isEdit ? "Supplier updated." : "Supplier created.");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Supplier" : "New Supplier"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="code">Code *</FieldLabel>
                <Input id="code" {...register("code")} aria-invalid={!!errors.code} />
                <FieldError errors={[errors.code]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="status">Status</FieldLabel>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="status" className="w-full">
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
            </div>

            <Field>
              <FieldLabel htmlFor="companyName">Company Name *</FieldLabel>
              <Input id="companyName" {...register("companyName")} aria-invalid={!!errors.companyName} />
              <FieldError errors={[errors.companyName]} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="contactPerson">Contact Person</FieldLabel>
                <Input id="contactPerson" {...register("contactPerson")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="phone">Phone</FieldLabel>
                <Input id="phone" {...register("phone")} />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" type="email" {...register("email")} aria-invalid={!!errors.email} />
              <FieldError errors={[errors.email]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="address">Address</FieldLabel>
              <Textarea id="address" rows={2} {...register("address")} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="gstNumber">GST Number</FieldLabel>
                <Input id="gstNumber" {...register("gstNumber")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="panNumber">PAN Number</FieldLabel>
                <Input id="panNumber" {...register("panNumber")} />
              </Field>
            </div>
          </FieldGroup>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : isEdit ? "Save Changes" : "Create Supplier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
