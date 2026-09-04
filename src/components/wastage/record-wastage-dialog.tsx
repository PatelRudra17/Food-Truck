"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { Grade, WastageReason } from "@prisma/client";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { warehouseWastageSchema, WASTE_REASON_LABELS, GRADE_LABELS } from "@/lib/validators/wastage";
import { createWarehouseWastageAction, getItemGradeBalancesAction } from "@/lib/actions/wastage-actions";

type ItemOption = { id: string; name: string; unit: string; warehouseId: string | null };
type WarehouseOption = { id: string; name: string; code: string };

type FormInput = z.input<typeof warehouseWastageSchema>;
type FormOutput = z.output<typeof warehouseWastageSchema>;

export function RecordWastageDialog({
  trigger,
  itemOptions,
  warehouseOptions,
}: {
  trigger: ReactNode;
  itemOptions: ItemOption[];
  warehouseOptions: WarehouseOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [balances, setBalances] = useState<{ grade: string; quantity: number }[]>([]);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(warehouseWastageSchema),
    defaultValues: {
      itemId: "",
      warehouseId: "",
      grade: Grade.RAW,
      quantity: 0,
      disposalMethod: "",
      date: format(new Date(), "yyyy-MM-dd"),
      remarks: "",
    },
  });

  const itemId = watch("itemId");
  const warehouseId = watch("warehouseId");
  const grade = watch("grade");
  const selectedItem = itemOptions.find((i) => i.id === itemId);

  useEffect(() => {
    if (!itemId || !warehouseId) {
      setBalances([]);
      return;
    }
    let cancelled = false;
    getItemGradeBalancesAction(itemId, warehouseId).then((result) => {
      if (!cancelled && result.ok) setBalances(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [itemId, warehouseId]);

  const available = balances.find((b) => b.grade === grade)?.quantity;

  function handleItemChange(value: string) {
    setValue("itemId", value);
    const item = itemOptions.find((i) => i.id === value);
    if (item?.warehouseId) setValue("warehouseId", item.warehouseId);
  }

  async function onSubmit(values: FormOutput) {
    setServerError(null);
    const result = await createWarehouseWastageAction(values);
    if (result.ok) {
      toast.success("Warehouse disposal recorded.");
      setOpen(false);
      reset();
      router.refresh();
    } else {
      setServerError(result.error);
      toast.error(result.error);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setServerError(null);
          reset();
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Disposal</DialogTitle>
          <DialogDescription>
            Manually record wastage/dumping of stock already in the warehouse. This decrements the selected
            grade&apos;s balance directly.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wastage-item">Item</Label>
              <Controller
                control={control}
                name="itemId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={handleItemChange}>
                    <SelectTrigger id="wastage-item" className="w-full">
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                    <SelectContent>
                      {itemOptions.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.itemId && <p className="text-sm text-destructive">{errors.itemId.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wastage-warehouse">Warehouse</Label>
              <Controller
                control={control}
                name="warehouseId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="wastage-warehouse" className="w-full">
                      <SelectValue placeholder="Select warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouseOptions.map((w) => (
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
              <Label htmlFor="wastage-grade">Grade</Label>
              <Controller
                control={control}
                name="grade"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="wastage-grade" className="w-full">
                      <SelectValue placeholder="Select grade" />
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
              <p className="text-xs text-muted-foreground">
                {itemId && warehouseId
                  ? `Available: ${(available ?? 0).toLocaleString()} ${selectedItem?.unit ?? ""}`
                  : "Select item and warehouse to see available stock."}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quantity">Quantity{selectedItem ? ` (${selectedItem.unit})` : ""}</Label>
              <Input id="quantity" type="number" step="0.001" min="0" {...register("quantity")} />
              {errors.quantity && <p className="text-sm text-destructive">{errors.quantity.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wastage-reason">Reason</Label>
              <Controller
                control={control}
                name="reason"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="wastage-reason" className="w-full">
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(WastageReason).map((reason) => (
                        <SelectItem key={reason} value={reason}>
                          {WASTE_REASON_LABELS[reason] ?? reason}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.reason && <p className="text-sm text-destructive">{errors.reason.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" {...register("date")} />
              {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="disposalMethod">Disposal method (optional)</Label>
              <Input id="disposalMethod" placeholder="e.g. Municipal waste collection, composting" {...register("disposalMethod")} />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea id="remarks" rows={2} {...register("remarks")} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Record Disposal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
