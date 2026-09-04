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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateCleaningAction } from "@/lib/actions/cleaning-actions";

type Option = { id: string; label: string };

export function CleaningEditDialog({
  trigger,
  cleaningId,
  staffOptions,
  initial,
}: {
  trigger: ReactNode;
  cleaningId: string;
  staffOptions: Option[];
  initial: { cleaningType: string; staffId: string; remarks: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cleaningType, setCleaningType] = useState(initial.cleaningType);
  const [staffId, setStaffId] = useState(initial.staffId);
  const [remarks, setRemarks] = useState(initial.remarks);
  const [isPending, setIsPending] = useState(false);

  async function handleSave() {
    setIsPending(true);
    const result = await updateCleaningAction({ id: cleaningId, cleaningType, staffId, remarks });
    setIsPending(false);
    if (result.ok) {
      toast.success("Cleaning record updated.");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit cleaning record</DialogTitle>
          <DialogDescription>Update the cleaning type, assigned staff, or remarks.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-cleaningType">Cleaning type</Label>
            <Input id="edit-cleaningType" value={cleaningType} onChange={(e) => setCleaningType(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-cleaning-staff">Assigned staff</Label>
            <Select value={staffId || "none"} onValueChange={(v) => setStaffId(v === "none" ? "" : v)}>
              <SelectTrigger id="edit-cleaning-staff" className="w-full">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {staffOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-remarks">Remarks</Label>
            <Textarea id="edit-remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </div>

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
