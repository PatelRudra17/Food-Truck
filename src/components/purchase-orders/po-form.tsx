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
import { purchaseOrderSchema, type PurchaseOrderInput } from "@/lib/validators/purchase-order";
import { createPurchaseOrderAction, updatePurchaseOrderAction } from "@/lib/actions/purchase-order-actions";

export type SupplierOption = { id: string; companyName: string; code: string };
export type ItemOption = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  purchasePrice: number | null;
  taxPercent: number | null;
  supplierId: string | null;
};

export type POFormInput = z.input<typeof purchaseOrderSchema>;

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function PurchaseOrderForm({
  suppliers,
  items,
  poId,
  initialValues,
}: {
  suppliers: SupplierOption[];
  items: ItemOption[];
  /** When set, the form edits this (DRAFT) purchase order instead of creating one. */
  poId?: string;
  initialValues?: POFormInput;
}) {
  const router = useRouter();
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<POFormInput, unknown, PurchaseOrderInput>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: initialValues ?? {
      supplierId: "",
      date: new Date().toISOString().slice(0, 10),
      expectedDelivery: "",
      remarks: "",
      items: [{ itemId: "", quantity: 1, rate: 0, taxPercent: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = watch("items");
  const selectedSupplierId = watch("supplierId");

  const grandTotal = round2(
    watchedItems.reduce((sum, line) => {
      const qty = Number(line.quantity) || 0;
      const rate = Number(line.rate) || 0;
      const tax = Number(line.taxPercent) || 0;
      return sum + qty * rate * (1 + tax / 100);
    }, 0),
  );

  function handleItemSelect(index: number, itemId: string) {
    setValue(`items.${index}.itemId`, itemId);
    const item = itemsById.get(itemId);
    if (item) {
      setValue(`items.${index}.rate`, item.purchasePrice ?? 0);
      setValue(`items.${index}.taxPercent`, item.taxPercent ?? 0);
    }
  }

  async function onSubmit(values: PurchaseOrderInput) {
    const result = poId
      ? await updatePurchaseOrderAction(poId, values)
      : await createPurchaseOrderAction(values);
    if (result.ok) {
      toast.success(poId ? "Purchase order updated." : "Purchase order created.");
      router.push(`/purchase-orders/${result.data.id}`);
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
          <CardTitle className="text-base">Purchase Order Details</CardTitle>
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
                    <Select value={field.value} onValueChange={field.onChange}>
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
                <FieldLabel htmlFor="expectedDelivery">Expected Delivery</FieldLabel>
                <Input
                  id="expectedDelivery"
                  type="date"
                  {...register("expectedDelivery")}
                  aria-invalid={!!errors.expectedDelivery}
                />
                <FieldError errors={[errors.expectedDelivery]} />
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
          {errors.items?.message && (
            <p className="text-sm text-destructive">{errors.items.message}</p>
          )}
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-56">Item</TableHead>
                  <TableHead className="w-28">Quantity</TableHead>
                  <TableHead className="w-32">Rate</TableHead>
                  <TableHead className="w-28">Tax %</TableHead>
                  <TableHead className="w-32 text-right">Total</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => {
                  const line = watchedItems[index];
                  const qty = Number(line?.quantity) || 0;
                  const rate = Number(line?.rate) || 0;
                  const tax = Number(line?.taxPercent) || 0;
                  const lineTotal = round2(qty * rate * (1 + tax / 100));
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
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          {...register(`items.${index}.quantity`)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" min="0" {...register(`items.${index}.rate`)} />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          {...register(`items.${index}.taxPercent`)}
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
            onClick={() => append({ itemId: "", quantity: 1, rate: 0, taxPercent: 0 })}
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
        <Button type="button" variant="outline" onClick={() => router.push(poId ? `/purchase-orders/${poId}` : "/purchase-orders")}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {poId
            ? isSubmitting
              ? "Saving..."
              : "Save Changes"
            : isSubmitting
              ? "Creating..."
              : "Create Purchase Order"}
        </Button>
      </div>
    </form>
  );
}
