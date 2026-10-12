"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, PackageCheck, PackagePlus, Send, Truck, Undo2, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RejectDialog } from "@/components/shared/reject-dialog";
import {
  approveTripAction,
  startTripLoadingAction,
  markTripLoadedAction,
  dispatchTripAction,
  markTripDeliveredAction,
  markTripReturnedAction,
  cancelTripAction,
} from "@/lib/actions/trip-actions";

export function TripWorkflowActions({
  tripId,
  tripNumber,
  status,
  canApprove,
  canEdit,
}: {
  tripId: string;
  tripNumber: string;
  status: string;
  canApprove: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  const canCancel = canEdit && ["CREATED", "APPROVED", "LOADING", "LOADED"].includes(status);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "CREATED" && canApprove && (
        <ConfirmDialog
          trigger={
            <Button size="sm">
              <CheckCircle2 className="h-4 w-4" /> Approve
            </Button>
          }
          title="Approve this trip?"
          description={`${tripNumber} will move to Approved and become ready for loading.`}
          confirmLabel="Approve"
          onConfirm={() => approveTripAction(tripId)}
          onSuccess={refresh}
        />
      )}

      {status === "APPROVED" && canEdit && (
        <ConfirmDialog
          trigger={
            <Button size="sm">
              <PackagePlus className="h-4 w-4" /> Start Loading
            </Button>
          }
          title="Start loading this trip?"
          description={`${tripNumber} will move to Loading.`}
          confirmLabel="Start Loading"
          onConfirm={() => startTripLoadingAction(tripId)}
          onSuccess={refresh}
        />
      )}

      {status === "LOADING" && canEdit && (
        <ConfirmDialog
          trigger={
            <Button size="sm">
              <PackageCheck className="h-4 w-4" /> Mark Loaded
            </Button>
          }
          title="Mark this trip as loaded?"
          description={`${tripNumber} will move to Loaded and become ready for dispatch.`}
          confirmLabel="Mark Loaded"
          onConfirm={() => markTripLoadedAction(tripId)}
          onSuccess={refresh}
        />
      )}

      {status === "LOADED" && canEdit && (
        <ConfirmDialog
          trigger={
            <Button size="sm">
              <Send className="h-4 w-4" /> Dispatch
            </Button>
          }
          title="Dispatch this trip?"
          description={`${tripNumber} will move to Dispatched. Grade stock for every line item will be decremented from inventory now.`}
          confirmLabel="Dispatch"
          onConfirm={() => dispatchTripAction(tripId)}
          onSuccess={refresh}
        />
      )}

      {status === "DISPATCHED" && canEdit && (
        <ConfirmDialog
          trigger={
            <Button size="sm">
              <Truck className="h-4 w-4" /> Mark Delivered
            </Button>
          }
          title="Mark this trip as delivered?"
          description={`${tripNumber} will move to Delivered.`}
          confirmLabel="Mark Delivered"
          onConfirm={() => markTripDeliveredAction(tripId)}
          onSuccess={refresh}
        />
      )}

      {status === "DELIVERED" && canEdit && (
        <ConfirmDialog
          trigger={
            <Button size="sm">
              <Undo2 className="h-4 w-4" /> Mark Returned
            </Button>
          }
          title="Mark this vehicle as returned?"
          description={`${tripNumber} will move to Returned. Record any crate return separately once the vehicle is back.`}
          confirmLabel="Mark Returned"
          onConfirm={() => markTripReturnedAction(tripId)}
          onSuccess={refresh}
        />
      )}

      {canCancel && (
        <RejectDialog
          trigger={
            <Button size="sm" variant="outline">
              <Ban className="h-4 w-4" /> Cancel Trip
            </Button>
          }
          title="Cancel this trip?"
          description={`${tripNumber} will be marked Cancelled. This cannot be undone.`}
          confirmLabel="Cancel Trip"
          successMessage="Trip cancelled."
          reasonPlaceholder="Explain why this trip is being cancelled..."
          onConfirm={(reason) => cancelTripAction(tripId, { reason })}
          onSuccess={refresh}
        />
      )}
    </div>
  );
}
