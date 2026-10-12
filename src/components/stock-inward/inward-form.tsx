"use client";

import { useEffect, useMemo } from "react";
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
  createInwardSchema,
  type CreateInwardInput,
} from "@/lib/validators/stock-inward";
import { createInwardAction, updateInwardAction } from "@/lib/actions/stock-inward-actions";

type WarehouseOption = { id: string; name: string };
type SupplierOption = { id: string; companyName: string };
type ItemOption = {
  id: string;
  sku: string;
  itemCode: string;
  name: string;
  unit: string;
  purchasePrice: number | null;
  taxPercent: number | null;
};
type VehicleOption = { id: string; vehicleNumber: string };
type DriverOption = { id: string; fullName: string };
type PoOption = {
  id: string;
  poNumber: string;
  supplierId: string;
  items: {
    poItemId: string;
    itemId: string;
    remainingQty: number;
    rate: number;
    taxPercent: number | null;
  }[];
};

const NONE = "__none__";

type InwardFormInput = z.input<typeof createInwardSchema>;

function emptyLine() {
  return {
    itemId: "",
    poItemId: null as string | null,
    quantity: 0,
    unit: "",
    batchNumber: "",
    serialNumber: "",
    expiryDate: null as string | null,
    rate: null as number | null,
    taxPercent: null as number | null,
  };
}

export function InwardForm({
  warehouses,
  suppliers,
  items,
  vehicles,
  drivers,
  purchaseOrders,
  mode = "create",
  inwardId,
  defaultValues,
}: {
  warehouses: WarehouseOption[];
  suppliers: SupplierOption[];
  items: ItemOption[];
  vehicles: VehicleOption[];
  drivers: DriverOption[];
  purchaseOrders: PoOption[];
  mode?: "create" | "edit";
  inwardId?: string;
  defaultValues?: CreateInwardInput;
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
  } = useForm<InwardFormInput, unknown, CreateInwardInput>({
    resolver: zodResolver(createInwardSchema),
    defaultValues: defaultValues ?? {
      date: new Date().toISOString().slice(0, 10),
      supplierId: null,
      purchaseOrderId: null,
      invoiceNumber: "",
      vehicleId: null,
      driverId: null,
      warehouseId: "",
      remarks: "",
      items: [emptyLine()],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: "items" });

  const supplierId = watch("supplierId");
  const purchaseOrderId = watch("purchaseOrderId");

  const eligiblePOs = useMemo(
    () => purchaseOrders.filter((po) => !supplierId || po.supplierId === supplierId),
    [purchaseOrders, supplierId],
  );

  // Prefill line items from the selected PO's remaining (unreceived) quantities.
  useEffect(() => {
    if (!purchaseOrderId) return;
    const po = purchaseOrders.find((p) => p.id === purchaseOrderId);
    if (!po) return;
    const lines = po.items
      .filter((line) => line.remainingQty > 0)
      .map((line) => {
        const item = itemMap.get(line.itemId);
        return {
          itemId: line.itemId,
          poItemId: line.poItemId,
          quantity: line.remainingQty,
          unit: item?.unit ?? "",
          batchNumber: "",
          serialNumber: "",
          expiryDate: null,
          rate: line.rate,
          taxPercent: line.taxPercent,
        };
      });
    if (lines.length > 0) replace(lines);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseOrderId]);

  function handleItemChange(index: number, itemId: string) {
    setValue(`items.${index}.itemId`, itemId);
    const item = itemMap.get(itemId);
    if (item) {
      setValue(`items.${index}.unit`, item.unit);
      // Only prefill master values the line schema will accept; an invalid (e.g. negative)
      // master price would otherwise block Save on a field the user never touched.
      const price = item.purchasePrice;
      const tax = item.taxPercent;
      setValue(`items.${index}.rate`, price != null && price >= 0 ? price : null);
      setValue(`items.${index}.taxPercent`, tax != null && tax >= 0 && tax <= 100 ? tax : null);
    }
  }

  const watchedItems = watch("items");

  async function onSubmit(data: CreateInwardInput) {
    const result =
      mode === "edit" && inwardId
        ? await updateInwardAction(inwardId, data)
        : await createInwardAction(data);
    if (result.ok) {
      toast.success(mode === "edit" ? "Inward updated." : "Inward saved as draft.");
      router.push(`/stock/inward/${result.data.id}`);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit, () => toast.error("Please fix the highlighted fields before saving."))}
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inward Details</CardTitle>
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
            <FieldLabel>Supplier</FieldLabel>
            <Controller
              control={control}
              name="supplierId"
              render={({ field }) => (
                <Select
                  value={field.value ?? NONE}
                  onValueChange={(v) => {
                    field.onChange(v === NONE ? null : v);
                    setValue("purchaseOrderId", null);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.companyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field>
            <FieldLabel>Purchase Order</FieldLabel>
            <Controller
              control={control}
              name="purchaseOrderId"
              render={({ field }) => (
                <Select
                  value={field.value ?? NONE}
                  onValueChange={(v) => field.onChange(v === NONE ? null : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None (direct inward)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None (direct inward)</SelectItem>
                    {eligiblePOs.map((po) => (
                      <SelectItem key={po.id} value={po.id}>
                        {po.poNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="invoiceNumber">Invoice Number</FieldLabel>
            <Input id="invoiceNumber" {...register("invoiceNumber")} />
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
                  <TableHead className="w-28">Quantity *</TableHead>
                  <TableHead className="w-24">Unit</TableHead>
                  <TableHead className="w-32">Batch #</TableHead>
                  <TableHead className="w-32">Serial #</TableHead>
                  <TableHead className="w-40">Expiry Date</TableHead>
                  <TableHead className="w-28">Rate</TableHead>
                  <TableHead className="w-24">Tax %</TableHead>
                  <TableHead className="w-28 text-right">Total</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => {
                  const line = watchedItems?.[index];
                  const quantity = Number(line?.quantity ?? 0);
                  const rate = line?.rate != null ? Number(line.rate) : 0;
                  const taxPercent = line?.taxPercent != null ? Number(line.taxPercent) : 0;
                  const total = rate ? quantity * rate * (1 + taxPercent / 100) : 0;

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
                      <TableCell>
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          {...register(`items.${index}.quantity`)}
                        />
                        <FieldError errors={[errors.items?.[index]?.quantity]} />
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
                        <Input type="date" {...register(`items.${index}.expiryDate`)} />
                      </TableCell>
                      <TableCell>
                        {/* step="any": the schema reports too many decimals as a field error
                            instead of the browser blocking submit with only a tooltip. */}
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          {...register(`items.${index}.rate`)}
                          aria-invalid={!!errors.items?.[index]?.rate}
                        />
                        <FieldError errors={[errors.items?.[index]?.rate]} />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          {...register(`items.${index}.taxPercent`)}
                          aria-invalid={!!errors.items?.[index]?.taxPercent}
                        />
                        <FieldError errors={[errors.items?.[index]?.taxPercent]} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {total ? total.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
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
