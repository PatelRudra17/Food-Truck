"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RejectDialog } from "@/components/shared/reject-dialog";
import type { ActionResult } from "@/lib/validators/common";
import type { ApprovalEntityKind } from "@/lib/services/approvals";
import { approveOutwardAction, rejectOutwardAction } from "@/lib/actions/stock-outward-actions";
import { approveAdjustmentAction, rejectAdjustmentAction } from "@/lib/actions/stock-adjustment-actions";
import { decidePurchaseOrderApprovalAction } from "@/lib/actions/purchase-order-actions";
import { decideTransferAction } from "@/lib/actions/stock-transfer-actions";
import { approveInwardAction, rejectInwardAction } from "@/lib/actions/stock-inward-actions";
import { approveSalesOrderAction, rejectSalesOrderAction } from "@/lib/actions/sales-order-actions";
import { approveWastageAction, rejectWastageAction } from "@/lib/actions/wastage-actions";

/**
 * Dispatches to the ONE real approve/reject server action for the given
 * entity kind — this never reimplements approval logic. Each existing action
 * has a slightly different signature (some take just an id, some take
 * id+comment, some take a single input object), so this wrapper normalizes
 * them to a `(id, comment) => Promise<ActionResult>` shape the two dialogs
 * expect. Each underlying action still independently re-checks its own
 * entity-specific `_APPROVE` permission — this component does not bypass
 * that, it only routes to the correct function.
 */
function approve(kind: ApprovalEntityKind, id: string, comment: string): Promise<ActionResult<unknown>> {
  switch (kind) {
    case "outward":
      return approveOutwardAction(id, comment || undefined);
    case "adjustment":
      return approveAdjustmentAction(id);
    case "po":
      return decidePurchaseOrderApprovalAction(id, "APPROVED", comment || undefined);
    case "transfer":
      return decideTransferAction({ id, decision: "APPROVED", comment: comment || undefined });
    case "inward":
      return approveInwardAction(id, comment || undefined);
    case "salesOrder":
      return approveSalesOrderAction(id, comment || undefined);
    case "wastage":
      return approveWastageAction(id, comment || undefined);
  }
}

function reject(kind: ApprovalEntityKind, id: string, comment: string): Promise<ActionResult<unknown>> {
  switch (kind) {
    case "outward":
      return rejectOutwardAction(id, comment);
    case "adjustment":
      return rejectAdjustmentAction({ id, comment });
    case "po":
      return decidePurchaseOrderApprovalAction(id, "REJECTED", comment);
    case "transfer":
      return decideTransferAction({ id, decision: "REJECTED", comment });
    case "inward":
      return rejectInwardAction(id, comment);
    case "salesOrder":
      return rejectSalesOrderAction(id, comment);
    case "wastage":
      return rejectWastageAction({ id, comment });
  }
}

export function ApprovalActionButtons({
  kind,
  entityId,
  label,
}: {
  kind: ApprovalEntityKind;
  /** The underlying document's id (e.g. the StockOutward id) — NOT the
   * Approval row's id — since that's what every existing action expects. */
  entityId: string;
  /** Document number, used in the confirmation copy. */
  label: string;
}) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <ConfirmDialog
        trigger={
          <Button size="sm" variant="outline" className="border-emerald-600 text-emerald-700 hover:bg-emerald-50">
            Approve
          </Button>
        }
        title="Approve this request?"
        description={`This will approve ${label}.`}
        confirmLabel="Approve"
        onConfirm={() => approve(kind, entityId, "")}
        onSuccess={() => router.refresh()}
      />
      <RejectDialog
        trigger={
          <Button size="sm" variant="outline" className="border-destructive text-destructive hover:bg-destructive/10">
            Reject
          </Button>
        }
        title="Reject this request?"
        description={`This will reject ${label}. Please explain why.`}
        onConfirm={(comment) => reject(kind, entityId, comment)}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
