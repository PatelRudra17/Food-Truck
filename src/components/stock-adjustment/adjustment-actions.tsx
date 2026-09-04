"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { approveAdjustmentAction, rejectAdjustmentAction } from "@/lib/actions/stock-adjustment-actions";

export function AdjustmentActions({
  id,
  status,
  canApprove,
  differenceLabel,
}: {
  id: string;
  status: string;
  canApprove: boolean;
  differenceLabel: string;
}) {
  const router = useRouter();

  if (status !== "PENDING_APPROVAL" || !canApprove) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ConfirmDialog
        trigger={<Button>Approve</Button>}
        title="Approve this stock adjustment?"
        description={`This will change item stock by ${differenceLabel}. This action affects live inventory and cannot be undone.`}
        confirmLabel="Approve & Apply"
        onConfirm={() => approveAdjustmentAction(id)}
        onSuccess={() => router.refresh()}
      />
      <ConfirmDialog
        trigger={<Button variant="outline">Reject</Button>}
        title="Reject this stock adjustment?"
        description="No stock will change. The request will be marked rejected."
        confirmLabel="Reject"
        destructive
        onConfirm={() => rejectAdjustmentAction({ id })}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
