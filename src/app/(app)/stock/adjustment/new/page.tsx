import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { AdjustmentForm } from "@/components/stock-adjustment/adjustment-form";

export const metadata = { title: "New Stock Adjustment" };

export default async function NewStockAdjustmentPage() {
  await requirePermission("STOCK_ADJUSTMENT_CREATE");

  const [items, warehouses] = await Promise.all([
    prisma.item.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true, unit: true, warehouseId: true, currentStock: true },
    }),
    prisma.warehouse.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);

  const itemOptions = items.map((i) => ({
    id: i.id,
    name: i.name,
    sku: i.sku,
    unit: i.unit,
    warehouseId: i.warehouseId,
    currentStock: Number(i.currentStock),
  }));
  const warehouseOptions = warehouses.map((w) => ({ id: w.id, name: w.name, code: w.code }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Stock Adjustment"
        description="Correct a stock discrepancy. Adjustments always require approval before stock is changed."
      />
      <AdjustmentForm items={itemOptions} warehouses={warehouseOptions} />
    </div>
  );
}
