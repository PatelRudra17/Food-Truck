import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guard";
import { getProcurementBatchTrace } from "@/lib/services/procurement";
import { PageHeader } from "@/components/shared/page-header";
import { BatchTraceView } from "@/components/procurement/batch-trace-view";

export const metadata = { title: "Batch Traceability" };

export default async function ProcurementBatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("PROCUREMENT_VIEW");
  const { id } = await params;

  const batch = await getProcurementBatchTrace(id);
  if (!batch) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={batch.batchNumber}
        description={`Traceability chain for ${batch.item.name} sourced from ${batch.supplier.companyName}`}
      />

      <BatchTraceView
        data={{
          supplier: batch.supplier,
          vehicle: batch.vehicle,
          driver: batch.driver,
          gateEntry: batch.gateEntry,
          procurement: {
            id: batch.procurement.id,
            procurementNumber: batch.procurement.procurementNumber,
            date: batch.procurement.date,
            status: batch.procurement.status,
            createdByName: batch.procurement.createdBy.name,
          },
          batch: {
            batchNumber: batch.batchNumber,
            itemName: batch.item.name,
            itemSku: batch.item.sku,
            rawWeight: Number(batch.rawWeight),
            warehouseName: batch.warehouse.name,
            status: batch.status,
            date: batch.date,
          },
          sorting: batch.sorting
            ? {
                gradeAWeight: Number(batch.sorting.gradeAWeight),
                gradeBWeight: Number(batch.sorting.gradeBWeight),
                gradeCWeight: Number(batch.sorting.gradeCWeight),
                otherGradeWeight: Number(batch.sorting.otherGradeWeight),
                wasteWeight: Number(batch.sorting.wasteWeight),
                sortedAt: batch.sorting.sortedAt,
              }
            : null,
          wastages: batch.wastages.map((w) => ({
            id: w.id,
            wastageNumber: w.wastageNumber,
            quantity: Number(w.quantity),
            reason: w.reason,
            date: w.date,
          })),
        }}
      />
    </div>
  );
}
