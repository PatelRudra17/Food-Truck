"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { completeUnloadingAction } from "@/lib/actions/unloading-actions";

export type UnloadingBatchInfo = {
  id: string;
  batchNumber: string;
  itemName: string;
  declaredWeight: number;
};

const completeUnloadingFormSchema = z.object({
  unloadingId: z.string().min(1),
  batches: z.array(
    z.object({
      batchId: z.string().min(1),
      weight: z.coerce.number().positive("Weight must be greater than 0"),
    }),
  ),
  remarks: z.string().max(1000).optional().or(z.literal("")),
});

type CompleteUnloadingFormInput = z.input<typeof completeUnloadingFormSchema>;
type CompleteUnloadingFormOutput = z.output<typeof completeUnloadingFormSchema>;

export function CompleteUnloadingDialog({
  unloadingId,
  vehicleNumber,
  batches,
}: {
  unloadingId: string;
  vehicleNumber: string;
  batches: UnloadingBatchInfo[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CompleteUnloadingFormInput, unknown, CompleteUnloadingFormOutput>({
    resolver: zodResolver(completeUnloadingFormSchema),
    defaultValues: {
      unloadingId,
      // Pre-filled with the declared weight; overwrite with what the scale shows.
      batches: batches.map((b) => ({ batchId: b.id, weight: b.declaredWeight })),
      remarks: "",
    },
  });

  const watched = watch("batches");
  const declaredTotal = batches.reduce((sum, b) => sum + b.declaredWeight, 0);
  const measuredTotal = (watched ?? []).reduce((sum, b) => sum + (Number(b.weight) || 0), 0);
  const difference = Math.round((measuredTotal - declaredTotal) * 1000) / 1000;

  async function onSubmit(values: CompleteUnloadingFormOutput) {
    const result = await completeUnloadingAction(values);
    if (result.ok) {
      toast.success(`Unloading completed — ${result.data.batchCount} batch(es) moved to Pending Sorting.`);
      reset();
      setOpen(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <PackageCheck className="h-4 w-4" /> Complete Unloading
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Complete Unloading — {vehicleNumber}</DialogTitle>
          <DialogDescription>
            Enter the weighed (scale) weight for each batch. It replaces the declared weight for stock and sorting.
          </DialogDescription>
        </DialogHeader>
        {batches.length === 0 ? (
          <p className="text-sm text-muted-foreground">There are no batches waiting for this unloading.</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <input type="hidden" {...register("unloadingId")} />
            {batches.map((b, index) => (
              <div key={b.id} className="space-y-1.5">
                <input type="hidden" {...register(`batches.${index}.batchId`)} />
                <Label htmlFor={`batch-weight-${index}`}>
                  {b.batchNumber} — {b.itemName}{" "}
                  <span className="font-normal text-muted-foreground">
                    (declared {b.declaredWeight.toLocaleString()} kg)
                  </span>
                </Label>
                <Input
                  id={`batch-weight-${index}`}
                  type="number"
                  step="0.001"
                  min="0"
                  {...register(`batches.${index}.weight`)}
                />
                {errors.batches?.[index]?.weight && (
                  <p className="text-sm text-destructive">{errors.batches[index]?.weight?.message}</p>
                )}
              </div>
            ))}
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="font-medium tabular-nums">Total weighed: {measuredTotal.toLocaleString()} kg</p>
              <p className="text-muted-foreground tabular-nums">
                Declared {declaredTotal.toLocaleString()} kg
                {difference !== 0 && ` · difference ${difference > 0 ? "+" : ""}${difference.toLocaleString()} kg`}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea id="remarks" rows={2} {...register("remarks")} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Completing..." : "Complete Unloading"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
