import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { OverrideMaintenanceDialog } from "@/components/maintenance/override-maintenance-dialog";

export type DueVehicleRow = {
  id: string;
  vehicleNumber: string;
  maintenanceState: string;
  maintenanceOverride: boolean;
  nextServiceDate: string | null;
  nextServiceKm: number | null;
};

export function DueVehiclesCard({
  vehicles,
  canOverride,
}: {
  vehicles: DueVehicleRow[];
  canOverride: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Vehicles Due / Overdue for Service</CardTitle>
      </CardHeader>
      <CardContent>
        {vehicles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No vehicles are currently due or overdue.</p>
        ) : (
          <ul className="space-y-2">
            {vehicles.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{v.vehicleNumber}</span>
                  <StatusBadge status={v.maintenanceState} />
                  {v.maintenanceOverride && <StatusBadge status="APPROVED" className="text-xs" />}
                  <span className="text-xs text-muted-foreground">
                    {v.nextServiceDate ? `Due ${format(new Date(v.nextServiceDate), "dd MMM yyyy")}` : ""}
                    {v.nextServiceKm != null ? ` · ${v.nextServiceKm.toLocaleString("en-IN")} km` : ""}
                  </span>
                </div>
                {canOverride && (
                  <OverrideMaintenanceDialog
                    vehicleId={v.id}
                    vehicleNumber={v.vehicleNumber}
                    isOverridden={v.maintenanceOverride}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
