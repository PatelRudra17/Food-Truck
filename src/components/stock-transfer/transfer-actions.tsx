"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  submitTransferForApprovalAction,
  decideTransferAction,
  dispatchTransferAction,
  receiveTransferAction,
  cancelTransferAction,
} from "@/lib/actions/stock-transfer-actions";

export function TransferActions({
  id,
  status,
  canCreate,
  canEdit,
  canApprove,
}: {
  id: string;
  status: string;
  canCreate: boolean;
  canEdit: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();

  function refresh() {
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "DRAFT" && canCreate && (
        <ConfirmDialog
          trigger={<Button>Submit for Approval</Button>}
          title="Submit transfer for approval?"
          description="This transfer will move to Requested status and cannot be edited further until decided."
          confirmLabel="Submit"
          onConfirm={() => submitTransferForApprovalAction(id)}
          onSuccess={refresh}
        />
      )}

      {status === "DRAFT" && canEdit && (
        <ConfirmDialog
          trigger={<Button variant="outline">Cancel</Button>}
          title="Cancel this transfer?"
          description="This draft transfer will be marked cancelled."
          confirmLabel="Cancel Transfer"
          destructive
          onConfirm={() => cancelTransferAction(id)}
          onSuccess={refresh}
        />
      )}

      {status === "REQUESTED" && canApprove && (
        <>
          <ConfirmDialog
            trigger={<Button>Approve</Button>}
            title="Approve this transfer?"
            description="Once approved, it can be dispatched from the source warehouse."
            confirmLabel="Approve"
            onConfirm={() => decideTransferAction({ id, decision: "APPROVED" })}
            onSuccess={refresh}
          />
          <ConfirmDialog
            trigger={<Button variant="outline">Reject</Button>}
            title="Reject this transfer?"
            description="The transfer will be marked rejected. No stock will move."
            confirmLabel="Reject"
            destructive
            onConfirm={() => decideTransferAction({ id, decision: "REJECTED" })}
            onSuccess={refresh}
          />
        </>
      )}

      {status === "APPROVED" && canEdit && (
        <>
          <ConfirmDialog
            trigger={<Button>Dispatch</Button>}
            title="Dispatch this transfer?"
            description="Stock will be deducted from the source warehouse now. This cannot be undone."
            confirmLabel="Dispatch"
            onConfirm={() => dispatchTransferAction(id)}
            onSuccess={refresh}
          />
          <ConfirmDialog
            trigger={<Button variant="outline">Cancel</Button>}
            title="Cancel this transfer?"
            description="No stock has moved yet, so this is safe to cancel."
            confirmLabel="Cancel Transfer"
            destructive
            onConfirm={() => cancelTransferAction(id)}
            onSuccess={refresh}
          />
        </>
      )}

      {status === "DISPATCHED" && canEdit && (
        <ConfirmDialog
          trigger={<Button>Receive at Destination</Button>}
          title="Confirm receipt at destination warehouse?"
          description="Stock will be added to the destination warehouse now. This cannot be undone."
          confirmLabel="Confirm Receipt"
          onConfirm={() => receiveTransferAction(id)}
          onSuccess={refresh}
        />
      )}
    </div>
  );
}
