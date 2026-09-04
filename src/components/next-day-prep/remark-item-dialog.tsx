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
import { addChecklistRemarkAction } from "@/lib/actions/next-day-prep-actions";

export function RemarkItemDialog({
  trigger,
  itemId,
  itemLabel,
  currentRemark,
}: {
  trigger: ReactNode;
  itemId: string;
  itemLabel: string;
  currentRemark: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [remark, setRemark] = useState(currentRemark);
  const [isPending, setIsPending] = useState(false);

  async function handleSave() {
    setIsPending(true);
    const result = await addChecklistRemarkAction({ itemId, remark });
    setIsPending(false);
    if (result.ok) {
      toast.success("Remark saved.");
      setOpen(false);
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
          <DialogTitle>Add remark</DialogTitle>
          <DialogDescription>{itemLabel}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="item-remark">Remark</Label>
          <Textarea id="item-remark" rows={3} value={remark} onChange={(e) => setRemark(e.target.value)} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving..." : "Save remark"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
