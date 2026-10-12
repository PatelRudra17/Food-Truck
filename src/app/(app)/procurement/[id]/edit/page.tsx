import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { getProcurementFormOptions } from "@/lib/services/procurement";
import { PageHeader } from "@/components/shared/page-header";
import { ProcurementForm } from "@/components/procurement/procurement-form";

export const metadata = { title: "Edit Procurement" };

export default async function EditProcurementPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("PROCUREMENT_EDIT");
  const { id } = await params;

  const [procurement, options] = await Promise.all([
    prisma.procurement.findUnique({ where: { id }, include: { items: true } }),
    getProcurementFormOptions(),
  ]);
  if (!procurement) notFound();
  if (procurement.status !== "DRAFT") redirect(`/procurement/${id}`);

  return (
    <div className="space-y-4">
      <PageHeader title={`Edit ${procurement.procurementNumber}`} description="Only draft procurements can be edited." />
      <ProcurementForm
        {...options}
        procurementId={procurement.id}
        initialValues={{
          supplierId: procurement.supplierId,
          date: format(procurement.date, "yyyy-MM-dd"),
          warehouseId: procurement.warehouseId,
          vehicleId: procurement.vehicleId ?? "",
          driverId: procurement.driverId ?? "",
          gateEntryId: procurement.gateEntryId ?? "",
          purchaseOrderId: procurement.purchaseOrderId ?? "",
          invoiceNumber: procurement.invoiceNumber ?? "",
          remarks: procurement.remarks ?? "",
          items: procurement.items.map((line) => ({
            itemId: line.itemId,
            quantity: Number(line.quantity),
            unit: line.unit,
            weight: Number(line.weight),
            quality: line.quality ?? "",
            purchasePrice: line.purchasePrice == null ? "" : Number(line.purchasePrice),
          })),
        }}
      />
    </div>
  );
}
