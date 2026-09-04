"use client";

import { useRouter } from "next/navigation";
import { Send, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { submitProcurementAction, cancelProcurementAction } from "@/lib/actions/procurement-actions";

export function ProcurementWorkflowActions({
  procurementId,
  procurementNumber,
  status,
  canEdit,
}: {
  procurementId: string;
  procurementNumber: string;
  status: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  if (!canEdit || status !== "DRAFT") return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ConfirmDialog
        trigger={
          <Button size="sm">
            <Send className="h-4 w-4" /> Submit
          </Button>
        }
        title="Submit this procurement?"
        description={`${procurementNumber} will move to Submitted and a traceable batch will be created for every line item, pending unloading.`}
        confirmLabel="Submit"
        onConfirm={() => submitProcurementAction(procurementId)}
        onSuccess={refresh}
      />
      <ConfirmDialog
        trigger={
          <Button size="sm" variant="outline">
            <Ban className="h-4 w-4" /> Cancel
          </Button>
        }
        title="Cancel this procurement?"
        description={`${procurementNumber} will be marked Cancelled. This cannot be undone.`}
        confirmLabel="Cancel Procurement"
        destructive
        onConfirm={() => cancelProcurementAction(procurementId)}
        onSuccess={refresh}
      />
    </div>
  );
}
