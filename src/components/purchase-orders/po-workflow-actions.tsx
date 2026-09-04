"use client";

import { useRouter } from "next/navigation";
import { Send, CheckCircle2, XCircle, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  submitPurchaseOrderForApprovalAction,
  decidePurchaseOrderApprovalAction,
  cancelPurchaseOrderAction,
} from "@/lib/actions/purchase-order-actions";

export function PurchaseOrderWorkflowActions({
  poId,
  poNumber,
  status,
  canEdit,
  canApprove,
}: {
  poId: string;
  poNumber: string;
  status: string;
  canEdit: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  const canCancel = canEdit && ["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(status);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "DRAFT" && canEdit && (
        <ConfirmDialog
          trigger={
            <Button size="sm">
              <Send className="h-4 w-4" /> Submit for Approval
            </Button>
          }
          title="Submit for approval?"
          description={`${poNumber} will move to Pending Approval and notify approvers.`}
          confirmLabel="Submit"
          onConfirm={() => submitPurchaseOrderForApprovalAction(poId)}
          onSuccess={refresh}
        />
      )}

      {status === "PENDING_APPROVAL" && canApprove && (
        <>
          <ConfirmDialog
            trigger={
              <Button size="sm">
                <CheckCircle2 className="h-4 w-4" /> Approve
              </Button>
            }
            title="Approve this purchase order?"
            description={`${poNumber} will move to Approved and become receivable against Stock Inward.`}
            confirmLabel="Approve"
            onConfirm={() => decidePurchaseOrderApprovalAction(poId, "APPROVED")}
            onSuccess={refresh}
          />
          <ConfirmDialog
            trigger={
              <Button size="sm" variant="destructive">
                <XCircle className="h-4 w-4" /> Reject
              </Button>
            }
            title="Reject this purchase order?"
            description={`${poNumber} will be sent back to Draft for revision.`}
            confirmLabel="Reject"
            destructive
            onConfirm={() => decidePurchaseOrderApprovalAction(poId, "REJECTED")}
            onSuccess={refresh}
          />
        </>
      )}

      {canCancel && (
        <ConfirmDialog
          trigger={
            <Button size="sm" variant="outline">
              <Ban className="h-4 w-4" /> Cancel PO
            </Button>
          }
          title="Cancel this purchase order?"
          description={`${poNumber} will be marked Cancelled. This cannot be undone.`}
          confirmLabel="Cancel PO"
          destructive
          onConfirm={() => cancelPurchaseOrderAction(poId)}
          onSuccess={refresh}
        />
      )}
    </div>
  );
}
