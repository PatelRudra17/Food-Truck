"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updatePreparationRemarksAction } from "@/lib/actions/next-day-prep-actions";

export function PrepRemarksEditor({ preparationId, initialRemarks, canEdit }: { preparationId: string; initialRemarks: string; canEdit: boolean }) {
  const router = useRouter();
  const [remarks, setRemarks] = useState(initialRemarks);
  const [isPending, setIsPending] = useState(false);
  const dirty = remarks !== initialRemarks;

  async function handleSave() {
    setIsPending(true);
    const result = await updatePreparationRemarksAction({ id: preparationId, remarks });
    setIsPending(false);
    if (result.ok) {
      toast.success("Remarks saved.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Overall remarks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          rows={3}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          disabled={!canEdit}
          placeholder="General notes about tomorrow's preparation..."
        />
        {canEdit && (
          <div className="flex justify-end">
            <Button size="sm" onClick={handleSave} disabled={!dirty || isPending}>
              {isPending ? "Saving..." : "Save remarks"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
