"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RejectDialog } from "@/components/shared/reject-dialog";
import { Pencil, Printer } from "lucide-react";
import {
  submitInwardForApprovalAction,
  approveInwardAction,
  rejectInwardAction,
  receiveInwardAction,
  cancelInwardAction,
} from "@/lib/actions/stock-inward-actions";

export function InwardStatusActions({
  inwardId,
  status,
  canEdit,
  canApprove,
  canPrint,
}: {
  inwardId: string;
  status: "DRAFT" | "PENDING" | "APPROVED" | "RECEIVED" | "CANCELLED";
  canEdit: boolean;
  canApprove: boolean;
  canPrint: boolean;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const isTerminal = status === "RECEIVED" || status === "CANCELLED";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canPrint && (
        <Button variant="outline" asChild>
          <Link href={`/stock/inward/${inwardId}/print`}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Link>
        </Button>
      )}

      {status === "DRAFT" && canEdit && (
        <>
          <Button variant="outline" asChild>
            <Link href={`/stock/inward/${inwardId}/edit`}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </Link>
          </Button>
          <ConfirmDialog
            trigger={<Button>Submit for Approval</Button>}
            title="Submit inward for approval?"
            description="This inward will move to Pending and await approval before stock can be received."
            confirmLabel="Submit"
            onConfirm={() => submitInwardForApprovalAction(inwardId)}
            onSuccess={refresh}
          />
        </>
      )}

      {status === "PENDING" && canApprove && (
        <>
          <ConfirmDialog
            trigger={<Button>Approve</Button>}
            title="Approve this inward?"
            description="Approving allows this inward to be marked as received, which will post stock movements."
            confirmLabel="Approve"
            onConfirm={() => approveInwardAction(inwardId)}
            onSuccess={refresh}
          />
          <RejectDialog
            trigger={<Button variant="outline">Reject</Button>}
            title="Reject this inward?"
            description="The inward will be sent back to Draft so it can be revised and resubmitted."
            onConfirm={(comment) => rejectInwardAction(inwardId, comment)}
            onSuccess={refresh}
          />
        </>
      )}

      {status === "APPROVED" && canEdit && (
        <ConfirmDialog
          trigger={<Button>Mark Received</Button>}
          title="Mark this inward as received?"
          description="This will post the stock movement for every line item, updating current stock and the inventory ledger. This cannot be undone."
          confirmLabel="Mark Received"
          onConfirm={() => receiveInwardAction(inwardId)}
          onSuccess={refresh}
        />
      )}

      {!isTerminal && canEdit && (
        <ConfirmDialog
          trigger={
            <Button variant="outline" className="text-destructive hover:text-destructive">
              Cancel
            </Button>
          }
          title="Cancel this inward?"
          description="This inward will be marked as cancelled and can no longer be processed."
          confirmLabel="Cancel Inward"
          destructive
          onConfirm={() => cancelInwardAction(inwardId)}
          onSuccess={refresh}
        />
      )}
    </div>
  );
}
