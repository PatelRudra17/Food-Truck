"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { LogOut } from "lucide-react";
import {
  recordVehicleOutSchema,
  type RecordVehicleOutInput,
} from "@/lib/validators/gate";
import { recordVehicleOutAction } from "@/lib/actions/gate-actions";

type RecordVehicleOutFormInput = z.input<typeof recordVehicleOutSchema>;

export function RecordOutDialog({
  gateEntryId,
  vehicleNumber,
}: {
  gateEntryId: string;
  vehicleNumber: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<RecordVehicleOutFormInput, unknown, RecordVehicleOutInput>({
    resolver: zodResolver(recordVehicleOutSchema),
    defaultValues: {
      gateEntryId,
      destination: null,
      material: null,
      receiver: null,
      remarks: null,
    },
  });

  async function onSubmit(values: RecordVehicleOutInput) {
    const result = await recordVehicleOutAction(values);
    if (result.ok) {
      toast.success(`Vehicle recorded out — ${result.data.gateExitNumber}`);
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
        <Button size="sm" variant="outline">
          <LogOut /> Record Out
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Vehicle Out — {vehicleNumber}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <input type="hidden" {...register("gateEntryId")} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Destination</Label>
              <Input {...register("destination")} />
            </div>
            <div className="space-y-1.5">
              <Label>Material</Label>
              <Input {...register("material")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Receiver</Label>
            <Input {...register("receiver")} />
          </div>
          <div className="space-y-1.5">
            <Label>Remarks</Label>
            <Textarea {...register("remarks")} rows={2} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Recording..." : "Record Out"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
