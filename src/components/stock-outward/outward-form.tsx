"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import {
  createOutwardSchema,
  type CreateOutwardInput,
} from "@/lib/validators/stock-outward";
import { createOutwardAction, updateOutwardAction } from "@/lib/actions/stock-outward-actions";

type WarehouseOption = { id: string; name: string };
type ItemOption = { id: string; sku: string; name: string; unit: string; currentStock: number };
type VehicleOption = { id: string; vehicleNumber: string };
type DriverOption = { id: string; fullName: string };

const NONE = "__none__";

type OutwardFormInput = z.input<typeof createOutwardSchema>;

function emptyLine() {
  return {
    itemId: "",
    requestedQty: 0,
    unit: "",
    batchNumber: "",
    serialNumber: "",
  };
}

export function OutwardForm({
  warehouses,
  items,
  vehicles,
  drivers,
  mode = "create",
  outwardId,
  defaultValues,
}: {
  warehouses: WarehouseOption[];
  items: ItemOption[];
  vehicles: VehicleOption[];
  drivers: DriverOption[];
  mode?: "create" | "edit";
  outwardId?: string;
  defaultValues?: CreateOutwardInput;
}) {
  const router = useRouter();
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<OutwardFormInput, unknown, CreateOutwardInput>({
    resolver: zodResolver(createOutwardSchema),
    defaultValues: defaultValues ?? {
      date: new Date().toISOString().slice(0, 10),
      department: "",
      project: "",
      warehouseId: "",
      vehicleId: null,
      driverId: null,
      destination: "",
      receiver: "",
      purpose: "",
      remarks: "",
      items: [emptyLine()],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = watch("items");

  function handleItemChange(index: number, itemId: string) {
    setValue(`items.${index}.itemId`, itemId);
    const item = itemMap.get(itemId);
    if (item) {
      setValue(`items.${index}.unit`, item.unit);
    }
  }

  async function onSubmit(data: CreateOutwardInput) {
    const result =
      mode === "edit" && outwardId
        ? await updateOutwardAction(outwardId, data)
        : await createOutwardAction(data);
    if (result.ok) {
      toast.success(mode === "edit" ? "Outward request updated." : "Outward request saved as draft.");
      router.push(`/stock/outward/${result.data.id}`);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Outward Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="date">Date *</FieldLabel>
            <Input id="date" type="date" {...register("date")} />
            <FieldError errors={[errors.date]} />
          </Field>

          <Field>
            <FieldLabel>Warehouse *</FieldLabel>
            <Controller
              control={control}
              name="warehouseId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
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
            <FieldError errors={[errors.warehouseId]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="department">Department</FieldLabel>
            <Input id="department" {...register("department")} />
          </Field>

          <Field>
            <FieldLabel htmlFor="project">Project</FieldLabel>
            <Input id="project" {...register("project")} />
          </Field>

          <Field>
            <FieldLabel>Vehicle</FieldLabel>
            <Controller
              control={control}
              name="vehicleId"
              render={({ field }) => (
                <Select
                  value={field.value ?? NONE}
                  onValueChange={(v) => field.onChange(v === NONE ? null : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.vehicleNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field>
            <FieldLabel>Driver</FieldLabel>
            <Controller
              control={control}
              name="driverId"
              render={({ field }) => (
                <Select
                  value={field.value ?? NONE}
                  onValueChange={(v) => field.onChange(v === NONE ? null : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {drivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="destination">Destination</FieldLabel>
            <Input id="destination" {...register("destination")} />
          </Field>

          <Field>
            <FieldLabel htmlFor="receiver">Receiver</FieldLabel>
            <Input id="receiver" {...register("receiver")} />
          </Field>

          <Field>
            <FieldLabel htmlFor="purpose">Purpose</FieldLabel>
            <Input id="purpose" {...register("purpose")} />
          </Field>

          <Field className="sm:col-span-2 lg:col-span-3">
            <FieldLabel htmlFor="remarks">Remarks</FieldLabel>
            <Textarea id="remarks" rows={2} {...register("remarks")} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Line Items</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => append(emptyLine())}>
            <Plus className="mr-2 h-4 w-4" /> Add Row
          </Button>
        </CardHeader>
        <CardContent>
          {errors.items?.message && (
            <p className="mb-2 text-sm text-destructive">{errors.items.message as string}</p>
          )}
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">Item *</TableHead>
                  <TableHead className="w-32">Available Qty</TableHead>
                  <TableHead className="w-28">Requested Qty *</TableHead>
                  <TableHead className="w-24">Unit</TableHead>
                  <TableHead className="w-32">Batch #</TableHead>
                  <TableHead className="w-32">Serial #</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => {
                  const line = watchedItems?.[index];
                  const selectedItem = line?.itemId ? itemMap.get(line.itemId) : undefined;
                  const requestedQty = Number(line?.requestedQty ?? 0);
                  const exceeds =
                    selectedItem != null && requestedQty > selectedItem.currentStock;

                  return (
                    <TableRow key={field.id}>
                      <TableCell>
                        <Select
                          value={line?.itemId || undefined}
                          onValueChange={(v) => handleItemChange(index, v)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select item" />
                          </SelectTrigger>
                          <SelectContent>
                            {items.map((i) => (
                              <SelectItem key={i.id} value={i.id}>
                                {i.name} ({i.sku})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FieldError errors={[errors.items?.[index]?.itemId]} />
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {selectedItem ? selectedItem.currentStock.toLocaleString() : "—"}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          className={exceeds ? "border-destructive" : undefined}
                          {...register(`items.${index}.requestedQty`)}
                        />
                        {exceeds && (
                          <p className="mt-1 text-xs text-destructive">Exceeds available stock</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input {...register(`items.${index}.unit`)} readOnly className="bg-muted" />
                      </TableCell>
                      <TableCell>
                        <Input {...register(`items.${index}.batchNumber`)} />
                      </TableCell>
                      <TableCell>
                        <Input {...register(`items.${index}.serialNumber`)} />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={fields.length === 1}
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : mode === "edit" ? "Save Changes" : "Save as Draft"}
        </Button>
      </div>
    </form>
  );
}
