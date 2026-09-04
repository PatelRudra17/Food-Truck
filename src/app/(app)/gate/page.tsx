import { DoorOpen } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import {
  getVehiclesCurrentlyInside,
  getVehiclesInsideCount,
  getVehicleOptions,
  getDriverOptions,
  getSupplierOptions,
  getRecentGateActivity,
} from "@/lib/services/gate";
import { gateActivityFilterSchema } from "@/lib/validators/gate";
import { paginationMeta } from "@/lib/validators/common";
import { RecordInDialog } from "./_components/record-in-dialog";
import { CurrentlyInsideTable } from "./_components/currently-inside-table";
import { RecentActivityTable } from "./_components/recent-activity-table";
import { GateActivityFilters } from "./_components/gate-activity-filters";

export const metadata = { title: "Gate Entry / Exit" };

export default async function GatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission("GATE_ENTRY_VIEW");
  const canCreate = hasPermission(user, "GATE_ENTRY_CREATE");
  const canPrint = hasPermission(user, "GATE_ENTRY_PRINT");

  const sp = await searchParams;
  const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const filter = gateActivityFilterSchema.parse({
    page: single(sp.page),
    pageSize: single(sp.pageSize),
    from: single(sp.from),
    to: single(sp.to),
    vehicleId: single(sp.vehicleId),
  });

  const [insideEntries, insideCount, vehicles, drivers, suppliers, activity] = await Promise.all([
    getVehiclesCurrentlyInside(),
    getVehiclesInsideCount(),
    getVehicleOptions(),
    getDriverOptions(),
    getSupplierOptions(),
    getRecentGateActivity(filter),
  ]);

  const insideRows = insideEntries.map((r) => ({
    id: r.id,
    gateEntryNumber: r.gateEntryNumber,
    vehicleId: r.vehicleId,
    vehicleNumber: r.vehicle.vehicleNumber,
    driverId: r.driverId,
    driverName: r.driver.fullName,
    supplierName: r.supplier?.companyName ?? null,
    purpose: r.purpose,
    material: r.material,
    timeIn: r.timeIn,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gate Entry / Exit"
        description="Record vehicle movement at the depot gate."
        actions={
          canCreate ? (
            <RecordInDialog
              vehicles={vehicles.map((v) => ({
                id: v.id,
                label: v.vehicleNumber,
                sublabel: v.vehicleType,
              }))}
              drivers={drivers.map((d) => ({ id: d.id, label: `${d.fullName} (${d.mobile})` }))}
              suppliers={suppliers.map((s) => ({ id: s.id, label: s.companyName }))}
            />
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard label="Vehicles Currently Inside" value={insideCount} icon={DoorOpen} />
      </div>

      <Tabs defaultValue="inside" className="w-full">
        <TabsList>
          <TabsTrigger value="inside">Currently Inside ({insideCount})</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="inside" className="pt-4">
          <CurrentlyInsideTable rows={insideRows} canRecordOut={canCreate} canPrint={canPrint} />
        </TabsContent>
        <TabsContent value="activity" className="space-y-4 pt-4">
          <GateActivityFilters vehicles={vehicles.map((v) => ({ id: v.id, label: v.vehicleNumber }))} />
          <RecentActivityTable
            rows={activity.rows}
            pagination={paginationMeta(activity.total, filter)}
            canPrint={canPrint}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
