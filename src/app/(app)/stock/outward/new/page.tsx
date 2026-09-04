import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { OutwardForm } from "@/components/stock-outward/outward-form";

export const metadata = { title: "New Stock Outward" };

export default async function NewStockOutwardPage() {
  await requirePermission("STOCK_OUTWARD_CREATE");

  const [warehouses, items, vehicles, drivers] = await Promise.all([
    prisma.warehouse.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.item.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, sku: true, name: true, unit: true, currentStock: true },
    }),
    prisma.vehicle.findMany({ orderBy: { vehicleNumber: "asc" } }),
    prisma.driver.findMany({ where: { status: "ACTIVE" }, orderBy: { fullName: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Stock Outward"
        description="Request stock to be issued to a department, project or destination."
      />
      <OutwardForm
        warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))}
        items={items.map((i) => ({
          id: i.id,
          sku: i.sku,
          name: i.name,
          unit: i.unit,
          currentStock: Number(i.currentStock),
        }))}
        vehicles={vehicles.map((v) => ({ id: v.id, vehicleNumber: v.vehicleNumber }))}
        drivers={drivers.map((d) => ({ id: d.id, fullName: d.fullName }))}
      />
    </div>
  );
}
