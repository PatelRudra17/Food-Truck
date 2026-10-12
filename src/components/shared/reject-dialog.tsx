"use client";

import { useState, useTransition, type ReactNode } from "react";
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
import type { ActionResult } from "@/lib/validators/common";

/** Rejection requires a reason, so it gets its own dialog with a comment field
 * rather than reusing the plain ConfirmDialog. */
export function RejectDialog({
  trigger,
  title,
  description,
  onConfirm,
  onSuccess,
  confirmLabel = "Reject",
  successMessage = "Rejected.",
  reasonPlaceholder = "Explain why this is being rejected...",
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  onConfirm: (comment: string) => Promise<ActionResult<unknown>>;
  onSuccess?: () => void;
  /** Wording for reuse by other reason-required actions (e.g. cancel, reopen). */
  confirmLabel?: string;
  successMessage?: string;
  reasonPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    if (!comment.trim()) {
      toast.error("A reason is required.");
      return;
    }
    startTransition(async () => {
      const result = await onConfirm(comment.trim());
      if (result.ok) {
        setOpen(false);
        setComment("");
        toast.success(successMessage);
        onSuccess?.();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reject-comment">Reason *</Label>
          <Textarea
            id="reject-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder={reasonPlaceholder}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? "Please wait..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
