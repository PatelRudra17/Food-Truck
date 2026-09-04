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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { completeUnloadingAction } from "@/lib/actions/unloading-actions";

const completeUnloadingFormSchema = z.object({
  unloadingId: z.string().min(1),
  weight: z.coerce.number().positive("Weight must be greater than 0"),
  remarks: z.string().max(1000).optional().or(z.literal("")),
});

type CompleteUnloadingFormInput = z.input<typeof completeUnloadingFormSchema>;
type CompleteUnloadingFormOutput = z.output<typeof completeUnloadingFormSchema>;

export function CompleteUnloadingDialog({
  unloadingId,
  vehicleNumber,
}: {
  unloadingId: string;
  vehicleNumber: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CompleteUnloadingFormInput, unknown, CompleteUnloadingFormOutput>({
    resolver: zodResolver(completeUnloadingFormSchema),
    defaultValues: { unloadingId, weight: undefined, remarks: "" },
  });

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Unloading — {vehicleNumber}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <input type="hidden" {...register("unloadingId")} />
          <div className="space-y-1.5">
            <Label htmlFor="weight">Unloaded Weight (kg) *</Label>
            <Input id="weight" type="number" step="0.001" min="0" {...register("weight")} />
            {errors.weight && <p className="text-sm text-destructive">{errors.weight.message}</p>}
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
      </DialogContent>
    </Dialog>
  );
}
