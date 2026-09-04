"use client";

import { useState, type ReactNode } from "react";
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
import { completeChecklistItemAction } from "@/lib/actions/next-day-prep-actions";

export function CompleteItemDialog({ trigger, itemId, itemLabel }: { trigger: ReactNode; itemId: string; itemLabel: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [remark, setRemark] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleConfirm() {
    setIsPending(true);
    const result = await completeChecklistItemAction({ itemId, remark });
    setIsPending(false);
    if (result.ok) {
      toast.success("Marked complete.");
      setOpen(false);
      setRemark("");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Mark complete</DialogTitle>
          <DialogDescription>{itemLabel}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="complete-remark">Remark (optional)</Label>
          <Textarea id="complete-remark" rows={2} value={remark} onChange={(e) => setRemark(e.target.value)} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Saving..." : "Mark complete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
