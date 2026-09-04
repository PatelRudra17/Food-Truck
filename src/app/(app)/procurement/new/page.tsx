import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { PageHeader } from "@/components/shared/page-header";
import { ProcurementForm } from "@/components/procurement/procurement-form";

export const metadata = { title: "New Procurement" };

export default async function NewProcurementPage() {
  await requirePermission("PROCUREMENT_CREATE");

  const [suppliers, warehouses, vehicles, drivers, gateEntries, purchaseOrders, items] = await Promise.all([
    prisma.supplier.findMany({
      where: { status: "ACTIVE" },
      orderBy: { companyName: "asc" },
      select: { id: true, companyName: true, code: true },
    }),
    prisma.warehouse.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.vehicle.findMany({
      where: { status: { not: "INACTIVE" } },
      orderBy: { vehicleNumber: "asc" },
      select: { id: true, vehicleNumber: true, vehicleType: true },
    }),
    prisma.driver.findMany({
      where: { status: "ACTIVE" },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, mobile: true },
    }),
    prisma.vehicleGateEntry.findMany({
      where: { status: "INSIDE" },
      orderBy: { timeIn: "desc" },
      select: { id: true, gateEntryNumber: true, vehicleId: true, driverId: true, supplierId: true },
    }),
    prisma.purchaseOrder.findMany({
      where: { status: { in: ["APPROVED", "PARTIALLY_RECEIVED", "RECEIVED"] } },
      orderBy: { date: "desc" },
      select: { id: true, poNumber: true, supplierId: true },
    }),
    prisma.item.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true, unit: true, purchasePrice: true, supplierId: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="New Procurement"
        description="Record produce received from a supplier as one or more line items."
      />
      <ProcurementForm
        suppliers={suppliers}
        warehouses={warehouses}
        vehicles={vehicles}
        drivers={drivers}
        gateEntries={gateEntries}
        purchaseOrders={purchaseOrders}
        items={items.map((item) => ({
          ...item,
          purchasePrice: item.purchasePrice ? Number(item.purchasePrice) : null,
        }))}
      />
    </div>
  );
}
