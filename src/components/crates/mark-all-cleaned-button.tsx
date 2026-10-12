"use client";

import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { markCratesCleanedAction } from "@/lib/actions/crate-actions";

/** Bulk counterpart of the row-level "Mark cleaned": moves every crate in CLEANING back to AVAILABLE. */
export function MarkAllCleanedButton({ count }: { count: number }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="outline">
          <Sparkles /> Mark all cleaned ({count.toLocaleString()})
        </Button>
      }
      title="Mark all cleaning crates as cleaned?"
      description={`${count.toLocaleString()} crate(s) currently in Cleaning will become Available. Each change is recorded in the audit log with reason "Cleaned".`}
      confirmLabel="Mark cleaned"
      onConfirm={() => markCratesCleanedAction({})}
      onSuccess={() => router.refresh()}
    />
  );
}
