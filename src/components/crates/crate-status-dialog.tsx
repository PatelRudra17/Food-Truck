"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { changeCrateStatusAction } from "@/lib/actions/crate-actions";
import { CRATE_STATUS_OPTIONS } from "@/lib/validators/crate";

function humanize(status: string) {
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

/** Every crate status transition requires a reason — Crate.status + AuditLog
 * together are the crate's movement history, so this is the single place that
 * writes a status change. Modeled on RejectDialog, plus a target-status picker. */
export function CrateStatusDialog({
  trigger,
  crateId,
  crateCode,
  currentStatus,
}: {
  trigger: ReactNode;
  crateId: string;
  crateCode: string;
  currentStatus: string;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string>(currentStatus);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setStatus(currentStatus);
      setReason("");
    }
  }

  function handleConfirm() {
    if (status === currentStatus) {
      toast.error("Choose a different status to record a change.");
      return;
    }
    if (reason.trim().length < 3) {
      toast.error("A reason is required to change status.");
      return;
    }
    startTransition(async () => {
      const result = await changeCrateStatusAction(crateId, { status, reason: reason.trim() });
      if (result.ok) {
        setOpen(false);
        toast.success(`${crateCode} marked ${humanize(status)}.`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change status — {crateCode}</DialogTitle>
          <DialogDescription>Currently {humanize(currentStatus)}. Choose the new status and explain why.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="crate-new-status">New status *</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="crate-new-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CRATE_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {humanize(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="crate-status-reason">Reason *</Label>
            <Textarea
              id="crate-status-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Explain why this crate's status is changing..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Saving..." : "Update status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
