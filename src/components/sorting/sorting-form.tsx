"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { WastageReason } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { buildSortingSchema, WEIGHT_BALANCE_EPSILON, WASTE_REASON_LABELS, type SortingInput } from "@/lib/validators/sorting";
import { submitSortingAction } from "@/lib/actions/sorting-actions";

type BatchInfo = {
  id: string;
  batchNumber: string;
  itemName: string;
  supplierName: string;
  warehouseName: string;
  rawWeight: number;
};

export function SortingForm({ batch }: { batch: BatchInfo }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const schema = useMemo(() => buildSortingSchema(batch.rawWeight), [batch.rawWeight]);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<z.input<ReturnType<typeof buildSortingSchema>>, unknown, SortingInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      batchId: batch.id,
      gradeAWeight: 0,
      gradeBWeight: 0,
      gradeCWeight: 0,
      otherGradeWeight: 0,
      wasteWeight: 0,
      remarks: "",
    },
  });

  const gradeA = Number(watch("gradeAWeight")) || 0;
  const gradeB = Number(watch("gradeBWeight")) || 0;
  const gradeC = Number(watch("gradeCWeight")) || 0;
  const other = Number(watch("otherGradeWeight")) || 0;
  const waste = Number(watch("wasteWeight")) || 0;
  const sum = gradeA + gradeB + gradeC + other + waste;
  const diff = batch.rawWeight - sum;
  const balanced = Math.abs(diff) < WEIGHT_BALANCE_EPSILON;

  async function onSubmit(values: SortingInput) {
    setServerError(null);
    const result = await submitSortingAction(values);
    if (result.ok) {
      toast.success("Sorting recorded and grade stock updated.");
      router.push("/procurement/sorting");
      router.refresh();
    } else {
      setServerError(result.error);
      toast.error(result.error);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {serverError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 rounded-md border bg-muted/40 p-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-muted-foreground">Batch</p>
              <p className="font-medium">{batch.batchNumber}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Item</p>
              <p className="font-medium">{batch.itemName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Supplier</p>
              <p className="font-medium">{batch.supplierName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Raw Weight</p>
              <p className="font-medium tabular-nums">{batch.rawWeight.toLocaleString()} kg</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gradeAWeight">Grade A weight (kg)</Label>
              <Input id="gradeAWeight" type="number" step="0.001" min="0" {...register("gradeAWeight")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gradeBWeight">Grade B weight (kg)</Label>
              <Input id="gradeBWeight" type="number" step="0.001" min="0" {...register("gradeBWeight")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gradeCWeight">Grade C weight (kg)</Label>
              <Input id="gradeCWeight" type="number" step="0.001" min="0" {...register("gradeCWeight")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="otherGradeWeight">Other grade weight (kg)</Label>
              <Input id="otherGradeWeight" type="number" step="0.001" min="0" {...register("otherGradeWeight")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wasteWeight">Waste weight (kg)</Label>
              <Input id="wasteWeight" type="number" step="0.001" min="0" {...register("wasteWeight")} />
              {errors.wasteWeight && <p className="text-sm text-destructive">{errors.wasteWeight.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wasteReason">Waste reason{waste > 0 ? "" : " (optional)"}</Label>
              <Controller
                control={control}
                name="wasteReason"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={waste <= 0}>
                    <SelectTrigger id="wasteReason" className="w-full">
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
              {errors.wasteReason && <p className="text-sm text-destructive">{errors.wasteReason.message}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea id="remarks" rows={2} {...register("remarks")} />
          </div>

          <div
            className={cn(
              "flex items-center justify-between rounded-md border p-3 text-sm",
              balanced
                ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950"
                : "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950",
            )}
          >
            <div>
              <p className="font-medium">
                Total allocated: {sum.toLocaleString()} kg / {batch.rawWeight.toLocaleString()} kg
              </p>
              <p className="text-muted-foreground">
                {balanced
                  ? "Balanced — ready to submit."
                  : diff > 0
                    ? `${diff.toLocaleString()} kg not yet allocated.`
                    : `${Math.abs(diff).toLocaleString()} kg over the raw weight — reduce a value.`}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.push("/procurement/sorting")}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !balanced}>
              {isSubmitting ? "Submitting..." : "Submit Sorting"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
