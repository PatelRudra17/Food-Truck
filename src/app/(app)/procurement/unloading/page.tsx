import { PackageOpen } from "lucide-react";
import { format } from "date-fns";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { paginationSchema, paginationMeta } from "@/lib/validators/common";
import {
  getGateEntriesAwaitingUnloading,
  getUnloadingsInProgress,
  getCompletedUnloadings,
} from "@/lib/services/procurement";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PendingUnloadingTable } from "@/components/unloading/pending-unloading-table";
import { InProgressUnloadingTable } from "@/components/unloading/in-progress-unloading-table";
import { CompletedUnloadingTable } from "@/components/unloading/completed-unloading-table";

export const metadata = { title: "Unloading" };

export default async function UnloadingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("PROCUREMENT_VIEW");
  const user = await getSessionUser();
  // No dedicated UNLOADING permission resource exists; start/complete mutations
  // are gated under GATE_ENTRY_EDIT (see src/lib/actions/unloading-actions.ts).
  const canManage = hasPermission(user, "GATE_ENTRY_EDIT");

  const params = await searchParams;
  const pagination = paginationSchema.parse({ page: params.page, pageSize: params.pageSize });

  const [pendingEntries, inProgress, completed] = await Promise.all([
    getGateEntriesAwaitingUnloading(),
    getUnloadingsInProgress(),
    getCompletedUnloadings(pagination),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Unloading"
        description="Track truck unloading from arrival through to handoff for sorting."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard label="Awaiting Unloading" value={pendingEntries.length} icon={PackageOpen} tone="warning" />
        <KpiCard label="In Progress" value={inProgress.length} icon={PackageOpen} />
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pendingEntries.length})</TabsTrigger>
          <TabsTrigger value="in-progress">In Progress ({inProgress.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="pt-4">
          <PendingUnloadingTable
            rows={pendingEntries.map((e) => ({
              gateEntryId: e.id,
              gateEntryNumber: e.gateEntryNumber,
              vehicleId: e.vehicleId,
              vehicleNumber: e.vehicle.vehicleNumber,
              driverId: e.driverId,
              driverName: e.driver.fullName,
              supplierName: e.supplier?.companyName ?? null,
              timeIn: e.timeIn,
              procurementNumbers: e.procurements.map((p) => p.procurementNumber),
            }))}
            canManage={canManage}
          />
        </TabsContent>

        <TabsContent value="in-progress" className="pt-4">
          <InProgressUnloadingTable
            rows={inProgress.map((u) => ({
              id: u.id,
              gateEntryNumber: u.gateEntry.gateEntryNumber,
              vehicleId: u.vehicleId,
              vehicleNumber: u.vehicle.vehicleNumber,
              driverId: u.driverId,
              driverName: u.driver.fullName,
              supplierName: u.supplier?.companyName ?? null,
              unloadingStartAt: u.unloadingStartAt!,
            }))}
            canManage={canManage}
          />
        </TabsContent>

        <TabsContent value="completed" className="pt-4">
          <CompletedUnloadingTable
            data={completed.rows.map((u) => ({
              id: u.id,
              gateEntryNumber: u.gateEntry.gateEntryNumber,
              vehicleNumber: u.vehicle.vehicleNumber,
              driverName: u.driver.fullName,
              supplierName: u.supplier?.companyName ?? null,
              weight: u.weight ? Number(u.weight) : null,
              unloadingEndAt: format(u.unloadingEndAt!, "dd MMM yyyy, HH:mm"),
              staffName: u.unloadingStaff?.name ?? null,
            }))}
            pagination={paginationMeta(completed.total, pagination)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
