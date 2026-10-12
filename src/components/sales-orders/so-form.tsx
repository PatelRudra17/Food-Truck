"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Grade } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldLabel, FieldError, FieldGroup, FieldDescription } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { salesOrderSchema, PRIORITY_OPTIONS, type SalesOrderInput } from "@/lib/validators/sales-order";
import { createSalesOrderAction, getSalesOrderItemStockAction } from "@/lib/actions/sales-order-actions";

export type CustomerOption = { id: string; name: string; customerCode: string; location: string | null };
export type ItemOption = { id: string; name: string; sku: string; unit: string; warehouseId: string | null };

const GRADE_LABELS: Record<string, string> = {
  RAW: "Raw",
  GRADE_A: "Grade A",
  GRADE_B: "Grade B",
  GRADE_C: "Grade C",
  OTHER: "Other",
};

type SOFormInput = z.input<typeof salesOrderSchema>;

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function SalesOrderForm({
  customers,
  items,
}: {
  customers: CustomerOption[];
  items: ItemOption[];
}) {
  const router = useRouter();
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const customersById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  // Preview-only: each line's "Available" figure is the item's grade stock across all
  // warehouses, since trip dispatch can draw on any of them.
  const [stockByItemId, setStockByItemId] = useState<Record<string, { grade: string; quantity: number }[]>>({});

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SOFormInput, unknown, SalesOrderInput>({
    resolver: zodResolver(salesOrderSchema),
    defaultValues: {
      customerId: "",
      orderDate: new Date().toISOString().slice(0, 10),
      deliveryDate: "",
      priority: "NORMAL",
      remarks: "",
      items: [{ itemId: "", grade: Grade.GRADE_A, quantity: 1, rate: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = watch("items");
  const customerId = watch("customerId");
  const selectedCustomer = customerId ? customersById.get(customerId) : undefined;

  const grandTotal = round2(
    watchedItems.reduce((sum, line) => {
      const qty = Number(line.quantity) || 0;
      const rate = Number(line.rate) || 0;
      return sum + qty * rate;
    }, 0),
  );

  // Fetch grade-wise stock for every distinct item currently on the form
  // whenever the set of chosen items changes. Recomputed each render: react-hook-form
  // keeps the same items array when a line's item changes, so memoising on it misses updates.
  const itemKey = Array.from(new Set(watchedItems.map((l) => l.itemId).filter(Boolean)))
    .sort()
    .join(",");

  useEffect(() => {
    const distinctItemIds = itemKey ? itemKey.split(",") : [];
    if (distinctItemIds.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        distinctItemIds.map(async (itemId) => {
          const result = await getSalesOrderItemStockAction(itemId);
          return [itemId, result.ok ? result.data : []] as const;
        }),
      );
      if (!cancelled) {
        setStockByItemId(Object.fromEntries(entries));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemKey]);

  function handleItemSelect(index: number, itemId: string) {
    setValue(`items.${index}.itemId`, itemId);
  }

  async function onSubmit(values: SalesOrderInput) {
    const result = await createSalesOrderAction(values);
    if (result.ok) {
      toast.success("Sales order created.");
      router.push(`/sales/orders/${result.data.id}`);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sales Order Details</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field>
                <FieldLabel htmlFor="customerId">Customer *</FieldLabel>
                <Controller
                  name="customerId"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="customerId" className="w-full" aria-invalid={!!errors.customerId}>
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} ({c.customerCode})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError errors={[errors.customerId]} />
                {selectedCustomer?.location && (
                  <FieldDescription>{selectedCustomer.location}</FieldDescription>
                )}
              </Field>

              <Field>
                <FieldLabel htmlFor="orderDate">Order Date *</FieldLabel>
                <Input id="orderDate" type="date" {...register("orderDate")} aria-invalid={!!errors.orderDate} />
                <FieldError errors={[errors.orderDate]} />
              </Field>

              <Field>
                <FieldLabel htmlFor="deliveryDate">Delivery Date</FieldLabel>
                <Input
                  id="deliveryDate"
                  type="date"
                  {...register("deliveryDate")}
                  aria-invalid={!!errors.deliveryDate}
                />
                <FieldError errors={[errors.deliveryDate]} />
              </Field>

              <Field>
                <FieldLabel htmlFor="priority">Priority</FieldLabel>
                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value || "NORMAL"} onValueChange={field.onChange}>
                      <SelectTrigger id="priority" className="w-full">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p.charAt(0) + p.slice(1).toLowerCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
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
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Line Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {errors.items?.message && <p className="text-sm text-destructive">{errors.items.message}</p>}
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-52">Item</TableHead>
                  <TableHead className="w-32">Grade</TableHead>
                  <TableHead className="w-24">Quantity</TableHead>
                  <TableHead className="w-28">Available</TableHead>
                  <TableHead className="w-28">Rate</TableHead>
                  <TableHead className="w-28 text-right">Total</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => {
                  const line = watchedItems[index];
                  const qty = Number(line?.quantity) || 0;
                  const rate = Number(line?.rate) || 0;
                  const lineTotal = round2(qty * rate);
                  const item = line?.itemId ? itemsById.get(line.itemId) : undefined;
                  const balances = line?.itemId ? stockByItemId[line.itemId] : undefined;
                  const available = balances?.find((b) => b.grade === line?.grade)?.quantity;
                  const insufficient = typeof available === "number" && qty > available;

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
                        <Controller
                          control={control}
                          name={`items.${index}.grade`}
                          render={({ field: gradeField }) => (
                            <Select value={gradeField.value} onValueChange={gradeField.onChange}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Grade" />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.values(Grade).map((g) => (
                                  <SelectItem key={g} value={g}>
                                    {GRADE_LABELS[g] ?? g}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          {...register(`items.${index}.quantity`)}
                          aria-invalid={insufficient}
                        />
                      </TableCell>
                      <TableCell className="text-sm">
                        {line?.itemId ? (
                          <span className={insufficient ? "font-medium text-destructive" : "text-muted-foreground"}>
                            {(available ?? 0).toLocaleString()} {item?.unit ?? ""}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" min="0" {...register(`items.${index}.rate`)} />
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
            onClick={() => append({ itemId: "", grade: Grade.GRADE_A, quantity: 1, rate: 0 })}
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
        <Button type="button" variant="outline" onClick={() => router.push("/sales/orders")}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Sales Order"}
        </Button>
      </div>
    </form>
  );
}
