"use client";

import { useRouter } from "next/navigation";
import { Send, CheckCircle2, XCircle, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  submitSalesOrderAction,
  approveSalesOrderAction,
  rejectSalesOrderAction,
  cancelSalesOrderAction,
} from "@/lib/actions/sales-order-actions";

export function SalesOrderWorkflowActions({
  soId,
  soNumber,
  status,
  canEdit,
  canApprove,
}: {
  soId: string;
  soNumber: string;
  status: string;
  canEdit: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  const canCancel = canEdit && ["DRAFT", "PENDING", "APPROVED"].includes(status);

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
          description={`${soNumber} will move to Pending and notify approvers.`}
          confirmLabel="Submit"
          onConfirm={() => submitSalesOrderAction(soId)}
          onSuccess={refresh}
        />
      )}

      {status === "PENDING" && canApprove && (
        <>
          <ConfirmDialog
            trigger={
              <Button size="sm">
                <CheckCircle2 className="h-4 w-4" /> Approve
              </Button>
            }
            title="Approve this sales order?"
            description={`${soNumber} will move to Approved and become eligible for dispatch.`}
            confirmLabel="Approve"
            onConfirm={() => approveSalesOrderAction(soId)}
            onSuccess={refresh}
          />
          <ConfirmDialog
            trigger={
              <Button size="sm" variant="destructive">
                <XCircle className="h-4 w-4" /> Reject
              </Button>
            }
            title="Reject this sales order?"
            description={`${soNumber} will be sent back to Draft for revision.`}
            confirmLabel="Reject"
            destructive
            onConfirm={() => rejectSalesOrderAction(soId)}
            onSuccess={refresh}
          />
        </>
      )}

      {canCancel && (
        <ConfirmDialog
          trigger={
            <Button size="sm" variant="outline">
              <Ban className="h-4 w-4" /> Cancel Order
            </Button>
          }
          title="Cancel this sales order?"
          description={`${soNumber} will be marked Cancelled. This cannot be undone.`}
          confirmLabel="Cancel Order"
          destructive
          onConfirm={() => cancelSalesOrderAction(soId)}
          onSuccess={refresh}
        />
      )}
    </div>
  );
}
