import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { TransferForm } from "@/components/stock-transfer/transfer-form";

export const metadata = { title: "New Stock Transfer" };

export default async function NewStockTransferPage() {
  await requirePermission("STOCK_TRANSFER_CREATE");

  const [warehouses, items] = await Promise.all([
    prisma.warehouse.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.item.findMany({
      where: { isActive: true, warehouseId: { not: null } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true, unit: true, warehouseId: true, currentStock: true },
    }),
  ]);

  const warehouseOptions = warehouses.map((w) => ({ id: w.id, name: w.name, code: w.code }));
  const itemOptions = items.map((i) => ({
    id: i.id,
    name: i.name,
    sku: i.sku,
    unit: i.unit,
    warehouseId: i.warehouseId as string,
    currentStock: Number(i.currentStock),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Stock Transfer"
        description="Move stock from one warehouse to another. The transfer starts as a draft and moves through approval, dispatch and receipt."
      />
      <TransferForm warehouses={warehouseOptions} items={itemOptions} />
    </div>
  );
}
