"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
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
import { cn } from "@/lib/utils";
import { createAdjustmentSchema, type CreateAdjustmentInput } from "@/lib/validators/stock-adjustment";
import { createAdjustmentAction } from "@/lib/actions/stock-adjustment-actions";

type ItemOption = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  warehouseId: string | null;
  currentStock: number;
};
type WarehouseOption = { id: string; name: string; code: string };

type AdjustmentFormInput = z.input<typeof createAdjustmentSchema>;

export function AdjustmentForm({ items, warehouses }: { items: ItemOption[]; warehouses: WarehouseOption[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AdjustmentFormInput, unknown, CreateAdjustmentInput>({
    resolver: zodResolver(createAdjustmentSchema),
    defaultValues: { itemId: "", warehouseId: "", physicalQty: 0, reason: "" },
  });

  const itemId = watch("itemId");
  const physicalQty = Number(watch("physicalQty"));

  const selectedItem = useMemo(() => items.find((i) => i.id === itemId), [items, itemId]);
  const currentQty = selectedItem?.currentStock ?? 0;
  const difference = (Number.isFinite(physicalQty) ? physicalQty : 0) - currentQty;

  async function onSubmit(values: CreateAdjustmentInput) {
    const formData = new FormData();
    formData.set("itemId", values.itemId);
    formData.set("warehouseId", values.warehouseId);
    formData.set("physicalQty", String(values.physicalQty));
    formData.set("reason", values.reason);
    const file = fileInputRef.current?.files?.[0];
    if (file) formData.set("file", file);

    const result = await createAdjustmentAction(formData);
    if (result.ok) {
      toast.success("Stock adjustment submitted for approval.");
      router.push(`/stock/adjustment/${result.data.id}`);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adj-item">Item</Label>
            <Controller
              control={control}
              name="itemId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    const selected = items.find((i) => i.id === value);
                    if (selected?.warehouseId) setValue("warehouseId", selected.warehouseId);
                  }}
                >
                  <SelectTrigger id="adj-item" className="w-full" aria-invalid={!!errors.itemId}>
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
              )}
            />
            {errors.itemId && <p className="text-sm text-destructive">{errors.itemId.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adj-warehouse">Warehouse</Label>
            <Controller
              control={control}
              name="warehouseId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="adj-warehouse" className="w-full" aria-invalid={!!errors.warehouseId}>
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
            {errors.warehouseId && <p className="text-sm text-destructive">{errors.warehouseId.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adj-currentQty">Current Quantity</Label>
            <Input
              id="adj-currentQty"
              value={selectedItem ? `${currentQty.toLocaleString()} ${selectedItem.unit}` : "—"}
              readOnly
              disabled
            />
            <p className="text-xs text-muted-foreground">Live system stock at the moment of creation.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="physicalQty">Physical Quantity (counted)</Label>
            <Input
              id="physicalQty"
              type="number"
              step="0.001"
              min="0"
              {...register("physicalQty", { valueAsNumber: true })}
            />
            {errors.physicalQty && <p className="text-sm text-destructive">{errors.physicalQty.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Difference</Label>
            <p
              className={cn(
                "flex h-9 items-center rounded-md border bg-muted px-3 text-sm font-semibold tabular-nums",
                difference > 0 && "text-emerald-600 dark:text-emerald-400",
                difference < 0 && "text-red-600 dark:text-red-400",
              )}
            >
              {difference > 0 ? "+" : ""}
              {difference.toLocaleString()} {selectedItem?.unit ?? ""}
            </p>
          </div>

          <div className="col-span-full flex flex-col gap-1.5">
            <Label htmlFor="adj-reason">Reason</Label>
            <Textarea
              id="adj-reason"
              rows={3}
              placeholder="e.g. Physical count mismatch, damaged stock, lost stock, found stock, data correction"
              {...register("reason")}
            />
            {errors.reason && <p className="text-sm text-destructive">{errors.reason.message}</p>}
          </div>

          <div className="col-span-full flex flex-col gap-1.5">
            <Label htmlFor="adj-attachment">Supporting Attachment (optional)</Label>
            <Input id="adj-attachment" ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push("/stock/adjustment")}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit for Approval"}
        </Button>
      </div>
    </form>
  );
}
