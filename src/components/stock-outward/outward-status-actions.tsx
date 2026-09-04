"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RejectDialog } from "@/components/shared/reject-dialog";
import { Pencil, Printer } from "lucide-react";
import {
  submitOutwardForApprovalAction,
  approveOutwardAction,
  rejectOutwardAction,
  issueOutwardAction,
  cancelOutwardAction,
} from "@/lib/actions/stock-outward-actions";

type OutwardStatusValue =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "ISSUED"
  | "REJECTED"
  | "CANCELLED";

export function OutwardStatusActions({
  outwardId,
  status,
  canEdit,
  canApprove,
  canPrint,
}: {
  outwardId: string;
  status: OutwardStatusValue;
  canEdit: boolean;
  canApprove: boolean;
  canPrint: boolean;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const isTerminal = status === "ISSUED" || status === "REJECTED" || status === "CANCELLED";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canPrint && (
        <Button variant="outline" asChild>
          <Link href={`/stock/outward/${outwardId}/print`}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Link>
        </Button>
      )}

      {status === "DRAFT" && canEdit && (
        <>
          <Button variant="outline" asChild>
            <Link href={`/stock/outward/${outwardId}/edit`}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </Link>
          </Button>
          <ConfirmDialog
            trigger={<Button>Submit for Approval</Button>}
            title="Submit outward request for approval?"
            description="This request will move to Pending Approval before stock can be issued."
            confirmLabel="Submit"
            onConfirm={() => submitOutwardForApprovalAction(outwardId)}
            onSuccess={refresh}
          />
        </>
      )}

      {status === "PENDING_APPROVAL" && canApprove && (
        <>
          <ConfirmDialog
            trigger={<Button>Approve</Button>}
            title="Approve this outward request?"
            description="Approving allows this request to be issued, which will deduct stock."
            confirmLabel="Approve"
            onConfirm={() => approveOutwardAction(outwardId)}
            onSuccess={refresh}
          />
          <RejectDialog
            trigger={<Button variant="outline">Reject</Button>}
            title="Reject this outward request?"
            description="The request will be marked as rejected and no stock will be issued."
            onConfirm={(comment) => rejectOutwardAction(outwardId, comment)}
            onSuccess={refresh}
          />
        </>
      )}

      {status === "APPROVED" && canEdit && (
        <ConfirmDialog
          trigger={<Button>Issue Stock</Button>}
          title="Issue stock for this request?"
          description="This will deduct stock for every line item and record it in the inventory ledger. This cannot be undone."
          confirmLabel="Issue Stock"
          onConfirm={() => issueOutwardAction(outwardId)}
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
          title="Cancel this outward request?"
          description="This request will be marked as cancelled and can no longer be processed."
          confirmLabel="Cancel Request"
          destructive
          onConfirm={() => cancelOutwardAction(outwardId)}
          onSuccess={refresh}
        />
      )}
    </div>
  );
}
