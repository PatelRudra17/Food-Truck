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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { assignChecklistItemAction } from "@/lib/actions/next-day-prep-actions";

type Option = { id: string; label: string };

export function AssignItemDialog({
  trigger,
  itemId,
  itemLabel,
  currentAssignedToId,
  userOptions,
}: {
  trigger: ReactNode;
  itemId: string;
  itemLabel: string;
  currentAssignedToId: string | null;
  userOptions: Option[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [assignedToId, setAssignedToId] = useState(currentAssignedToId ?? "");
  const [isPending, setIsPending] = useState(false);

  async function handleSave() {
    if (!assignedToId) {
      toast.error("Select a person to assign.");
      return;
    }
    setIsPending(true);
    const result = await assignChecklistItemAction({ itemId, assignedToId });
    setIsPending(false);
    if (result.ok) {
      toast.success("Task assigned.");
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
          <DialogTitle>Assign task</DialogTitle>
          <DialogDescription>{itemLabel}</DialogDescription>
        </DialogHeader>

        <Select value={assignedToId || undefined} onValueChange={setAssignedToId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a person" />
          </SelectTrigger>
          <SelectContent>
            {userOptions.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving..." : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
