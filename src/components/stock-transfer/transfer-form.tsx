"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useFieldArray, useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { createTransferSchema } from "@/lib/validators/stock-transfer";
import { createTransferAction } from "@/lib/actions/stock-transfer-actions";

type WarehouseOption = { id: string; name: string; code: string };
type ItemOption = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  warehouseId: string;
  currentStock: number;
};

type FormValues = z.infer<typeof createTransferSchema>;
type FormInput = z.input<typeof createTransferSchema>;

export function TransferForm({ warehouses, items }: { warehouses: WarehouseOption[]; items: ItemOption[] }) {
  const router = useRouter();

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(createTransferSchema),
    defaultValues: {
      sourceWarehouseId: "",
      destWarehouseId: "",
      remarks: "",
      items: [{ itemId: "", quantity: 0, unit: "", batchNumber: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const sourceWarehouseId = watch("sourceWarehouseId");

  const availableItems = useMemo(
    () => items.filter((i) => i.warehouseId === sourceWarehouseId),
    [items, sourceWarehouseId],
  );

  // Reset any selected line items that are no longer valid for the newly chosen source warehouse.
  useEffect(() => {
    const currentItems = watch("items");
    currentItems.forEach((line, index) => {
      if (line.itemId && !availableItems.some((i) => i.id === line.itemId)) {
        setValue(`items.${index}.itemId`, "");
        setValue(`items.${index}.unit`, "");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceWarehouseId]);

  async function onSubmit(values: FormValues) {
    const result = await createTransferAction(values);
    if (result.ok) {
      toast.success("Stock transfer created as draft.");
      router.push(`/stock/transfer/${result.data.id}`);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="transfer-source">Source Warehouse</Label>
            <Controller
              control={control}
              name="sourceWarehouseId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="transfer-source" className="w-full" aria-invalid={!!errors.sourceWarehouseId}>
                    <SelectValue placeholder="Select source warehouse" />
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
            {errors.sourceWarehouseId && (
              <p className="text-sm text-destructive">{errors.sourceWarehouseId.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="transfer-dest">Destination Warehouse</Label>
            <Controller
              control={control}
              name="destWarehouseId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="transfer-dest" className="w-full" aria-invalid={!!errors.destWarehouseId}>
                    <SelectValue placeholder="Select destination warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses
                      .filter((w) => w.id !== sourceWarehouseId)
                      .map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name} ({w.code})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.destWarehouseId && (
              <p className="text-sm text-destructive">{errors.destWarehouseId.message}</p>
            )}
          </div>

          <div className="col-span-full flex flex-col gap-1.5">
            <Label htmlFor="transfer-remarks">Remarks</Label>
            <Textarea id="transfer-remarks" rows={2} placeholder="Optional notes about this transfer" {...register("remarks")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Line Items</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ itemId: "", quantity: 0, unit: "", batchNumber: "" })}
              disabled={!sourceWarehouseId}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add Item
            </Button>
          </div>

          {!sourceWarehouseId && (
            <p className="text-sm text-muted-foreground">Select a source warehouse to choose items.</p>
          )}

          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="grid gap-3 rounded-md border p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`transfer-item-${index}`} className="text-xs">Item</Label>
                  <Controller
                    control={control}
                    name={`items.${index}.itemId`}
                    render={({ field: itemField }) => (
                      <Select
                        value={itemField.value}
                        onValueChange={(value) => {
                          itemField.onChange(value);
                          const selected = availableItems.find((i) => i.id === value);
                          if (selected) setValue(`items.${index}.unit`, selected.unit);
                        }}
                      >
                        <SelectTrigger id={`transfer-item-${index}`} className="w-full">
                          <SelectValue placeholder="Select item" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableItems.map((i) => (
                            <SelectItem key={i.id} value={i.id}>
                              {i.name} ({i.sku}) — {i.currentStock.toLocaleString()} {i.unit} in stock
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.items?.[index]?.itemId && (
                    <p className="text-xs text-destructive">{errors.items[index]?.itemId?.message}</p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`transfer-qty-${index}`} className="text-xs">Quantity</Label>
                  <Input
                    id={`transfer-qty-${index}`}
                    type="number"
                    step="0.001"
                    min="0"
                    {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                  />
                  {errors.items?.[index]?.quantity && (
                    <p className="text-xs text-destructive">{errors.items[index]?.quantity?.message}</p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`transfer-unit-${index}`} className="text-xs">Unit</Label>
                  <Input id={`transfer-unit-${index}`} {...register(`items.${index}.unit`)} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`transfer-batch-${index}`} className="text-xs">Batch # (optional)</Label>
                  <Input id={`transfer-batch-${index}`} {...register(`items.${index}.batchNumber`)} />
                </div>

                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {typeof errors.items?.message === "string" && (
            <p className="text-sm text-destructive">{errors.items.message}</p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push("/stock/transfer")}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save as Draft"}
        </Button>
      </div>
    </form>
  );
}
