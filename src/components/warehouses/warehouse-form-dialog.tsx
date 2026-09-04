"use client";

import { useEffect, useState, type ReactNode } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WarehouseInput } from "@/lib/validators/warehouse";
import { createWarehouseAction, updateWarehouseAction } from "@/lib/actions/warehouse-actions";

const formSchema = z.object({
  code: z.string().trim().min(1, "Code is required."),
  name: z.string().trim().min(1, "Name is required."),
  address: z.string().default(""),
  managerId: z.string().default(""),
  contact: z.string().default(""),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

type FormValues = z.infer<typeof formSchema>;
type FormInput = z.input<typeof formSchema>;

export type ManagerOption = { id: string; name: string };

export function WarehouseFormDialog({
  trigger,
  managers,
  editing,
  onSaved,
}: {
  trigger: ReactNode;
  managers: ManagerOption[];
  editing?: {
    id: string;
    code: string;
    name: string;
    address: string | null;
    managerId: string | null;
    contact: string | null;
    status: string;
  };
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isEdit = !!editing;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: editing?.code ?? "",
      name: editing?.name ?? "",
      address: editing?.address ?? "",
      managerId: editing?.managerId ?? "",
      contact: editing?.contact ?? "",
      status: (editing?.status as "ACTIVE" | "INACTIVE") ?? "ACTIVE",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        code: editing?.code ?? "",
        name: editing?.name ?? "",
        address: editing?.address ?? "",
        managerId: editing?.managerId ?? "",
        contact: editing?.contact ?? "",
        status: (editing?.status as "ACTIVE" | "INACTIVE") ?? "ACTIVE",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: FormValues) {
    const payload: WarehouseInput = {
      code: values.code,
      name: values.name,
      address: values.address || null,
      managerId: values.managerId || null,
      contact: values.contact || null,
      status: values.status,
    };
    const result = isEdit
      ? await updateWarehouseAction(editing!.id, payload)
      : await createWarehouseAction(payload);

    if (result.ok) {
      toast.success(isEdit ? "Warehouse updated." : "Warehouse created.");
      setOpen(false);
      onSaved?.();
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
            <DialogTitle>{isEdit ? "Edit Warehouse" : "New Warehouse"}</DialogTitle>
            <DialogDescription>
              {isEdit ? "Update this warehouse's details." : "Add a new warehouse location."}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wh-code">Code</Label>
              <Input id="wh-code" {...register("code")} aria-invalid={!!errors.code} />
              {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wh-name">Name</Label>
              <Input id="wh-name" {...register("name")} aria-invalid={!!errors.name} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="wh-address">Address</Label>
              <Textarea id="wh-address" rows={2} {...register("address")} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wh-manager">Manager</Label>
              <Controller
                control={control}
                name="managerId"
                render={({ field }) => (
                  <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                    <SelectTrigger id="wh-manager" className="w-full">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {managers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wh-contact">Contact</Label>
              <Input id="wh-contact" {...register("contact")} />
            </div>

            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="wh-status">Status</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="wh-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : isEdit ? "Save changes" : "Create warehouse"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
