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
import { assignShiftSupervisorAction } from "@/lib/actions/shift-actions";

type Option = { id: string; label: string };

export function AssignSupervisorDialog({
  trigger,
  shiftId,
  currentSupervisorId,
  supervisorOptions,
}: {
  trigger: ReactNode;
  shiftId: string;
  currentSupervisorId: string | null;
  supervisorOptions: Option[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [supervisorId, setSupervisorId] = useState(currentSupervisorId ?? "");
  const [isPending, setIsPending] = useState(false);

  async function handleSave() {
    setIsPending(true);
    const result = await assignShiftSupervisorAction({ shiftId, supervisorId });
    setIsPending(false);
    if (result.ok) {
      toast.success("Supervisor updated.");
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
          <DialogTitle>Assign supervisor</DialogTitle>
          <DialogDescription>Choose who supervises this shift.</DialogDescription>
        </DialogHeader>

        <Select value={supervisorId || "none"} onValueChange={(v) => setSupervisorId(v === "none" ? "" : v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="No supervisor assigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No supervisor assigned</SelectItem>
            {supervisorOptions.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
