"use client";

import { useMemo } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldLabel, FieldError, FieldGroup } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { procurementSchema, isKgUnit, type ProcurementInput } from "@/lib/validators/procurement";
import { createProcurementAction, updateProcurementAction } from "@/lib/actions/procurement-actions";

const NONE = "__none__";

export type SupplierOption = { id: string; companyName: string; code: string };
export type WarehouseOption = { id: string; name: string; code: string };
export type VehicleOption = { id: string; vehicleNumber: string; vehicleType: string };
export type DriverOption = { id: string; fullName: string; mobile: string };
export type PurchaseOrderOption = { id: string; poNumber: string; supplierId: string };
export type GateEntryOption = {
  id: string;
  gateEntryNumber: string;
  vehicleId: string;
  driverId: string;
  supplierId: string | null;
};
export type ItemOption = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  purchasePrice: number | null;
  supplierId: string | null;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export type ProcurementFormInput = z.input<typeof procurementSchema>;

const EMPTY_LINE = { itemId: "", quantity: "", unit: "", weight: "", quality: "", purchasePrice: "" };

export function ProcurementForm({
  suppliers,
  warehouses,
  vehicles,
  drivers,
  gateEntries,
  purchaseOrders,
  items,
  procurementId,
  initialValues,
}: {
  procurementId?: string;
  initialValues?: ProcurementFormInput;
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
  vehicles: VehicleOption[];
  drivers: DriverOption[];
  gateEntries: GateEntryOption[];
  purchaseOrders: PurchaseOrderOption[];
  items: ItemOption[];
}) {
  const router = useRouter();
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const gateEntriesById = useMemo(() => new Map(gateEntries.map((g) => [g.id, g])), [gateEntries]);

  const {
    register,
    control,
    handleSubmit,
    watch,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProcurementFormInput, unknown, ProcurementInput>({
    resolver: zodResolver(procurementSchema),
    defaultValues: initialValues ?? {
      supplierId: "",
      date: new Date().toISOString().slice(0, 10),
      warehouseId: "",
      vehicleId: "",
      driverId: "",
      gateEntryId: "",
      purchaseOrderId: "",
      invoiceNumber: "",
      remarks: "",
      items: [EMPTY_LINE],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = watch("items");
  const selectedSupplierId = watch("supplierId");
  const selectedGateEntry = gateEntriesById.get(watch("gateEntryId") ?? "");
  const supplierPurchaseOrders = purchaseOrders.filter((po) => po.supplierId === selectedSupplierId);

  const grandTotal = round2(
    watchedItems.reduce((sum, line) => {
      const qty = Number(line.quantity) || 0;
      const price = Number(line.purchasePrice) || 0;
      return sum + qty * price;
    }, 0),
  );

  function handleItemSelect(index: number, itemId: string) {
    setValue(`items.${index}.itemId`, itemId);
    const item = itemsById.get(itemId);
    if (item) {
      setValue(`items.${index}.unit`, item.unit);
      if (item.purchasePrice != null) {
        setValue(`items.${index}.purchasePrice`, item.purchasePrice);
      }
    }
  }

  function handleSupplierChange(supplierId: string) {
    setValue("supplierId", supplierId, { shouldValidate: true });
    // A purchase order from another supplier can't stay linked.
    const poId = getValues("purchaseOrderId");
    if (poId && purchaseOrders.find((po) => po.id === poId)?.supplierId !== supplierId) {
      setValue("purchaseOrderId", "");
    }
  }

  function handleGateEntrySelect(gateEntryId: string) {
    setValue("gateEntryId", gateEntryId, { shouldValidate: true });
    const entry = gateEntriesById.get(gateEntryId);
    if (entry) {
      // Vehicle, driver and (when recorded) supplier always come from the truck at the gate.
      setValue("vehicleId", entry.vehicleId);
      setValue("driverId", entry.driverId);
      if (entry.supplierId) handleSupplierChange(entry.supplierId);
    }
  }

  async function onSubmit(values: ProcurementInput) {
    const result = procurementId
      ? await updateProcurementAction(procurementId, values)
      : await createProcurementAction(values);
    if (result.ok) {
      toast.success(procurementId ? "Procurement updated." : "Procurement created as draft.");
      router.push(`/procurement/${result.data.id}`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  const sortedItems = useMemo(() => {
    if (!selectedSupplierId) return items;
    return [...items].sort((a, b) => {
      const aMatch = a.supplierId === selectedSupplierId ? 0 : 1;
      const bMatch = b.supplierId === selectedSupplierId ? 0 : 1;
      return aMatch - bMatch;
    });
  }, [items, selectedSupplierId]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Procurement Details</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="supplierId">Supplier *</FieldLabel>
                <Controller
                  name="supplierId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={handleSupplierChange}
                      disabled={!!selectedGateEntry?.supplierId}
                    >
                      <SelectTrigger id="supplierId" className="w-full" aria-invalid={!!errors.supplierId}>
                        <SelectValue placeholder="Select supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.companyName} ({s.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError errors={[errors.supplierId]} />
              </Field>

              <Field>
                <FieldLabel htmlFor="date">Date *</FieldLabel>
                <Input id="date" type="date" {...register("date")} aria-invalid={!!errors.date} />
                <FieldError errors={[errors.date]} />
              </Field>

              <Field>
                <FieldLabel htmlFor="warehouseId">Warehouse *</FieldLabel>
                <Controller
                  name="warehouseId"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="warehouseId" className="w-full" aria-invalid={!!errors.warehouseId}>
                        <SelectValue placeholder="Select warehouse" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.name} ({w.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError errors={[errors.warehouseId]} />
              </Field>

              <Field>
                <FieldLabel htmlFor="gateEntryId">Gate Entry *</FieldLabel>
                <Controller
                  name="gateEntryId"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={handleGateEntrySelect}>
                      <SelectTrigger id="gateEntryId" className="w-full" aria-invalid={!!errors.gateEntryId}>
                        <SelectValue placeholder={gateEntries.length ? "Select gate entry" : "No trucks inside"} />
                      </SelectTrigger>
                      <SelectContent>
                        {gateEntries.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.gateEntryNumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError errors={[errors.gateEntryId]} />
              </Field>

              <Field>
                <FieldLabel htmlFor="vehicleId">Vehicle (from gate entry)</FieldLabel>
                <Controller
                  name="vehicleId"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} disabled>
                      <SelectTrigger id="vehicleId" className="w-full">
                        <SelectValue placeholder="Select a gate entry" />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicles.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.vehicleNumber} ({v.vehicleType})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="driverId">Driver (from gate entry)</FieldLabel>
                <Controller
                  name="driverId"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} disabled>
                      <SelectTrigger id="driverId" className="w-full">
                        <SelectValue placeholder="Select a gate entry" />
                      </SelectTrigger>
                      <SelectContent>
                        {drivers.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.fullName} ({d.mobile})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="purchaseOrderId">Purchase Order (optional)</FieldLabel>
                <Controller
                  name="purchaseOrderId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value || NONE}
                      onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
                      disabled={!selectedSupplierId}
                    >
                      <SelectTrigger id="purchaseOrderId" className="w-full">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>None</SelectItem>
                        {supplierPurchaseOrders.map((po) => (
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
            </div>

            <Field>
              <FieldLabel htmlFor="remarks">Remarks</FieldLabel>
              <Textarea id="remarks" rows={2} {...register("remarks")} />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {errors.items?.message && <p className="text-sm text-destructive">{errors.items.message}</p>}
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-48">Item</TableHead>
                  <TableHead className="w-24">Quantity</TableHead>
                  <TableHead className="w-20">Unit</TableHead>
                  <TableHead className="w-28">Weight (kg)</TableHead>
                  <TableHead className="w-32">Quality</TableHead>
                  <TableHead className="w-28">Price</TableHead>
                  <TableHead className="w-28 text-right">Total</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => {
                  const line = watchedItems[index];
                  const qty = Number(line?.quantity) || 0;
                  const price = Number(line?.purchasePrice) || 0;
                  const lineTotal = round2(qty * price);
                  return (
                    <TableRow key={field.id}>
                      <TableCell>
                        <Select
                          value={watchedItems[index]?.itemId || ""}
                          onValueChange={(v) => handleItemSelect(index, v)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select item" />
                          </SelectTrigger>
                          <SelectContent>
                            {sortedItems.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name} ({item.sku})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FieldError errors={[errors.items?.[index]?.itemId]} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.001" min="0" {...register(`items.${index}.quantity`)} />
                        <FieldError errors={[errors.items?.[index]?.quantity]} />
                      </TableCell>
                      <TableCell>
                        <Input {...register(`items.${index}.unit`)} />
                        <FieldError errors={[errors.items?.[index]?.unit]} />
                      </TableCell>
                      <TableCell>
                        {isKgUnit(line?.unit) ? (
                          // For kg items the weight is the quantity.
                          <Input value={line?.quantity == null ? "" : String(line.quantity)} readOnly tabIndex={-1} />
                        ) : (
                          <Input type="number" step="0.001" min="0" {...register(`items.${index}.weight`)} />
                        )}
                        <FieldError errors={[errors.items?.[index]?.weight]} />
                      </TableCell>
                      <TableCell>
                        <Input {...register(`items.${index}.quality`)} placeholder="e.g. Grade A" />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          {...register(`items.${index}.purchasePrice`)}
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{lineTotal.toLocaleString()}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={fields.length === 1}
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append(EMPTY_LINE)}
          >
            <Plus className="h-4 w-4" /> Add Line
          </Button>

          <div className="flex justify-end border-t pt-3">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Grand Total</p>
              <p className="text-lg font-semibold tabular-nums">{grandTotal.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(procurementId ? `/procurement/${procurementId}` : "/procurement")}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {procurementId
            ? isSubmitting
              ? "Saving..."
              : "Save Changes"
            : isSubmitting
              ? "Creating..."
              : "Create Procurement"}
        </Button>
      </div>
    </form>
  );
}
