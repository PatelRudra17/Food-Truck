import { KpiCard } from "@/components/shared/kpi-card";
import { PackageSearch, Scissors, Truck, LogIn, LogOut, PlayCircle, SprayCan, Boxes } from "lucide-react";
import type { OperationsSnapshot } from "@/lib/actions/shift-handover-actions";

export function HandoverSummary({ snapshot }: { snapshot: OperationsSnapshot }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        Live snapshot — computed from current records, not stored on the handover.
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Pending Procurement" value={snapshot.pendingProcurementCount} icon={PackageSearch} />
        <KpiCard label="Pending Sorting" value={snapshot.pendingSortingCount} icon={Scissors} />
        <KpiCard label="Pending Dispatch" value={snapshot.pendingDispatchCount} icon={Truck} />
        <KpiCard label="Active Shifts" value={snapshot.activeShiftCount} icon={PlayCircle} />
        <KpiCard label="Vehicles Inside" value={snapshot.vehiclesInsideCount} icon={LogIn} />
        <KpiCard label="Vehicles Outside" value={snapshot.vehiclesOutsideCount} icon={LogOut} />
        <KpiCard label="Crates Available" value={snapshot.cratesAvailableCount} icon={Boxes} />
        <KpiCard label="Crates Cleaning" value={snapshot.cratesNeedingCleaningCount} icon={SprayCan} />
      </div>
    </div>
  );
}
