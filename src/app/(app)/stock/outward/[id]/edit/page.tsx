import { notFound, redirect } from "next/navigation";
import { OutwardStatus } from "@prisma/client";
import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { OutwardForm } from "@/components/stock-outward/outward-form";

export const metadata = { title: "Edit Stock Outward" };

export default async function EditStockOutwardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("STOCK_OUTWARD_EDIT");
  const { id } = await params;

  const outward = await prisma.stockOutward.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!outward) notFound();
  if (outward.status !== OutwardStatus.DRAFT) {
    redirect(`/stock/outward/${id}`);
  }

  const lineItemIds = outward.items.map((line) => line.itemId);
  const [warehouses, items, vehicles, drivers] = await Promise.all([
    // Keep the draft's current warehouse/items selectable even if since deactivated.
    prisma.warehouse.findMany({
      where: { OR: [{ status: "ACTIVE" }, { id: outward.warehouseId }] },
      orderBy: { name: "asc" },
    }),
    prisma.item.findMany({
      where: { OR: [{ isActive: true }, { id: { in: lineItemIds } }] },
      orderBy: { name: "asc" },
      select: {
        id: true,
        sku: true,
        name: true,
        unit: true,
        warehouseStocks: { select: { warehouseId: true, quantity: true } },
      },
    }),
    prisma.vehicle.findMany({ orderBy: { vehicleNumber: "asc" } }),
    prisma.driver.findMany({ where: { status: "ACTIVE" }, orderBy: { fullName: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit ${outward.outwardNumber}`} description="Update this draft outward request." />
      <OutwardForm
        mode="edit"
        outwardId={outward.id}
        warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))}
        items={items.map((i) => ({
          id: i.id,
          sku: i.sku,
          name: i.name,
          unit: i.unit,
          stockByWarehouse: Object.fromEntries(i.warehouseStocks.map((s) => [s.warehouseId, Number(s.quantity)])),
        }))}
        vehicles={vehicles.map((v) => ({ id: v.id, vehicleNumber: v.vehicleNumber }))}
        drivers={drivers.map((d) => ({ id: d.id, fullName: d.fullName }))}
        defaultValues={{
          date: outward.date.toISOString().slice(0, 10),
          department: outward.department ?? "",
          project: outward.project ?? "",
          warehouseId: outward.warehouseId,
          vehicleId: outward.vehicleId,
          driverId: outward.driverId,
          destination: outward.destination ?? "",
          receiver: outward.receiver ?? "",
          purpose: outward.purpose ?? "",
          remarks: outward.remarks ?? "",
          items: outward.items.map((line) => ({
            itemId: line.itemId,
            requestedQty: Number(line.requestedQty),
            unit: line.unit,
            batchNumber: line.batchNumber ?? "",
            serialNumber: line.serialNumber ?? "",
          })),
        }}
      />
    </div>
  );
}
