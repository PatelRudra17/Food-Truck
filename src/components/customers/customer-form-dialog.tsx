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
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldLabel, FieldError, FieldGroup } from "@/components/ui/field";
import { customerSchema, type CustomerInput } from "@/lib/validators/customer";
import { createCustomerAction, updateCustomerAction } from "@/lib/actions/customer-actions";

export type CustomerFormValues = {
  id?: string;
  customerCode?: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  location: string;
  gstNumber: string;
  status: "ACTIVE" | "INACTIVE";
};

type CustomerFormInput = z.input<typeof customerSchema>;

const EMPTY_VALUES: CustomerFormValues = {
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  location: "",
  gstNumber: "",
  status: "ACTIVE",
};

export function CustomerFormDialog({
  trigger,
  customer,
}: {
  trigger: React.ReactNode;
  customer?: CustomerFormValues;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = !!customer?.id;

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormInput, unknown, CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: customer ?? EMPTY_VALUES,
  });

  useEffect(() => {
    if (open) {
      reset(customer ?? EMPTY_VALUES);
    }
  }, [open, customer, reset]);

  async function onSubmit(values: CustomerInput) {
    const result = isEdit
      ? await updateCustomerAction(customer!.id!, values)
      : await createCustomerAction(values);

    if (result.ok) {
      toast.success(isEdit ? "Customer updated." : "Customer created.");
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
          <DialogTitle>{isEdit ? "Edit Customer" : "New Customer"}</DialogTitle>
          {isEdit && customer?.customerCode && (
            <DialogDescription>Customer code: {customer.customerCode}</DialogDescription>
          )}
          {!isEdit && (
            <DialogDescription>A customer code will be assigned automatically.</DialogDescription>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="name">Name *</FieldLabel>
                <Input id="name" {...register("name")} aria-invalid={!!errors.name} />
                <FieldError errors={[errors.name]} />
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

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="contactPerson">Contact Person</FieldLabel>
                <Input id="contactPerson" {...register("contactPerson")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="phone">Phone</FieldLabel>
                <Input id="phone" type="tel" {...register("phone")} aria-invalid={!!errors.phone} />
                <FieldError errors={[errors.phone]} />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" type="email" {...register("email")} aria-invalid={!!errors.email} />
              <FieldError errors={[errors.email]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="location">Location</FieldLabel>
              <Input id="location" {...register("location")} />
            </Field>

            <Field>
              <FieldLabel htmlFor="address">Address</FieldLabel>
              <Textarea id="address" rows={2} {...register("address")} />
            </Field>

            <Field>
              <FieldLabel htmlFor="gstNumber">GST Number</FieldLabel>
              <Input id="gstNumber" {...register("gstNumber")} />
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : isEdit ? "Save Changes" : "Create Customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
