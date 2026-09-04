"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { addLocationAction, removeLocationAction } from "@/lib/actions/warehouse-actions";

export type LocationRow = { id: string; rack: string | null; shelf: string | null; bin: string | null };

export function LocationManager({
  warehouseId,
  locations,
  canEdit,
}: {
  warehouseId: string;
  locations: LocationRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [rack, setRack] = useState("");
  const [shelf, setShelf] = useState("");
  const [bin, setBin] = useState("");
  const [isPending, startTransition] = useTransition();

  function refresh() {
    router.refresh();
  }

  function handleAdd() {
    if (!rack && !shelf && !bin) {
      toast.error("Enter at least a rack, shelf, or bin value.");
      return;
    }
    startTransition(async () => {
      const result = await addLocationAction({ warehouseId, rack, shelf, bin });
      if (result.ok) {
        toast.success("Location added.");
        setRack("");
        setShelf("");
        setBin("");
        refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="loc-rack">Rack</Label>
            <Input id="loc-rack" value={rack} onChange={(e) => setRack(e.target.value)} className="w-28" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="loc-shelf">Shelf</Label>
            <Input id="loc-shelf" value={shelf} onChange={(e) => setShelf(e.target.value)} className="w-28" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="loc-bin">Bin</Label>
            <Input id="loc-bin" value={bin} onChange={(e) => setBin(e.target.value)} className="w-28" />
          </div>
          <Button size="sm" onClick={handleAdd} disabled={isPending}>
            <Plus /> Add location
          </Button>
        </div>
      )}

      {locations.length === 0 ? (
        <EmptyState icon={MapPin} title="No storage locations yet" />
      ) : (
        <div className="flex flex-wrap gap-2">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-sm"
            >
              <span>
                {[loc.rack && `Rack ${loc.rack}`, loc.shelf && `Shelf ${loc.shelf}`, loc.bin && `Bin ${loc.bin}`]
                  .filter(Boolean)
                  .join(" / ") || "Unnamed location"}
              </span>
              {canEdit && (
                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" size="icon-xs">
                      <Trash2 className="text-destructive" />
                    </Button>
                  }
                  title="Remove location?"
                  description="This cannot be undone. It will fail if items are still assigned to it."
                  confirmLabel="Remove"
                  destructive
                  onConfirm={() => removeLocationAction(loc.id)}
                  onSuccess={refresh}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
