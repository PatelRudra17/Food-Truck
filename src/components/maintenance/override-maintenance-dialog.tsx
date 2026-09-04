"use client";

import { useState, useTransition } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  overrideMaintenanceBlockAction,
  clearMaintenanceOverrideAction,
} from "@/lib/actions/maintenance-actions";

export function OverrideMaintenanceDialog({
  vehicleId,
  vehicleNumber,
  isOverridden,
}: {
  vehicleId: string;
  vehicleNumber: string;
  isOverridden: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  if (isOverridden) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await clearMaintenanceOverrideAction(vehicleId);
            if (result.ok) {
              toast.success(`Override cleared for ${vehicleNumber}.`);
            } else {
              toast.error(result.error);
            }
          })
        }
      >
        {isPending ? "Clearing..." : "Clear override"}
      </Button>
    );
  }

  function handleConfirm() {
    if (!reason.trim()) {
      toast.error("A reason is required to override this maintenance block.");
      return;
    }
    startTransition(async () => {
      const result = await overrideMaintenanceBlockAction(vehicleId, reason);
      if (result.ok) {
        toast.success(`Dispatch block overridden for ${vehicleNumber}.`);
        setOpen(false);
        setReason("");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Override
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Override maintenance block — {vehicleNumber}</DialogTitle>
          <DialogDescription>
            Allows this vehicle to be dispatched despite its overdue maintenance state. This is
            recorded on the audit trail.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="override-reason">Reason</Label>
          <Textarea
            id="override-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why should this vehicle be allowed to dispatch?"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Saving..." : "Override block"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
