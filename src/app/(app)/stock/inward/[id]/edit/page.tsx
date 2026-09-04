import { notFound, redirect } from "next/navigation";
import { InwardStatus, POStatus } from "@prisma/client";
import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { InwardForm } from "@/components/stock-inward/inward-form";

export const metadata = { title: "Edit Stock Inward" };

export default async function EditStockInwardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("STOCK_INWARD_EDIT");
  const { id } = await params;

  const inward = await prisma.stockInward.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!inward) notFound();
  if (inward.status !== InwardStatus.DRAFT) {
    redirect(`/stock/inward/${id}`);
  }

  const [warehouses, suppliers, items, vehicles, drivers, purchaseOrders] = await Promise.all([
    prisma.warehouse.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: { status: "ACTIVE" }, orderBy: { companyName: "asc" } }),
    prisma.item.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        sku: true,
        itemCode: true,
        name: true,
        unit: true,
        purchasePrice: true,
        taxPercent: true,
      },
    }),
    prisma.vehicle.findMany({ orderBy: { vehicleNumber: "asc" } }),
    prisma.driver.findMany({ where: { status: "ACTIVE" }, orderBy: { fullName: "asc" } }),
    prisma.purchaseOrder.findMany({
      where: { status: { in: [POStatus.APPROVED, POStatus.PARTIALLY_RECEIVED] } },
      include: { items: true },
      orderBy: { poNumber: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit ${inward.inwardNumber}`} description="Update this draft inward." />
      <InwardForm
        mode="edit"
        inwardId={inward.id}
        warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))}
        suppliers={suppliers.map((s) => ({ id: s.id, companyName: s.companyName }))}
        items={items.map((i) => ({
          id: i.id,
          sku: i.sku,
          itemCode: i.itemCode,
          name: i.name,
          unit: i.unit,
          purchasePrice: i.purchasePrice != null ? Number(i.purchasePrice) : null,
          taxPercent: i.taxPercent != null ? Number(i.taxPercent) : null,
        }))}
        vehicles={vehicles.map((v) => ({ id: v.id, vehicleNumber: v.vehicleNumber }))}
        drivers={drivers.map((d) => ({ id: d.id, fullName: d.fullName }))}
        purchaseOrders={purchaseOrders.map((po) => ({
          id: po.id,
          poNumber: po.poNumber,
          supplierId: po.supplierId,
          items: po.items.map((it) => ({
            poItemId: it.id,
            itemId: it.itemId,
            remainingQty: Number(it.quantity) - Number(it.receivedQuantity),
            rate: Number(it.rate),
            taxPercent: it.taxPercent != null ? Number(it.taxPercent) : null,
          })),
        }))}
        defaultValues={{
          date: inward.date.toISOString().slice(0, 10),
          supplierId: inward.supplierId,
          purchaseOrderId: inward.purchaseOrderId,
          invoiceNumber: inward.invoiceNumber ?? "",
          vehicleId: inward.vehicleId,
          driverId: inward.driverId,
          warehouseId: inward.warehouseId,
          remarks: inward.remarks ?? "",
          items: inward.items.map((line) => ({
            itemId: line.itemId,
            poItemId: line.poItemId,
            quantity: Number(line.quantity),
            unit: line.unit,
            batchNumber: line.batchNumber ?? "",
            serialNumber: line.serialNumber ?? "",
            expiryDate: line.expiryDate ? line.expiryDate.toISOString().slice(0, 10) : null,
            rate: line.rate != null ? Number(line.rate) : null,
            taxPercent: line.taxPercent != null ? Number(line.taxPercent) : null,
          })),
        }}
      />
    </div>
  );
}
