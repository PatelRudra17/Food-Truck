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
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
        warehouseStocks: { where: { quantity: { gt: 0 } }, select: { warehouseId: true, quantity: true } },
      },
    }),
  ]);

  const warehouseOptions = warehouses.map((w) => ({ id: w.id, name: w.name, code: w.code }));
  const itemOptions = items.map((i) => ({
    id: i.id,
    name: i.name,
    sku: i.sku,
    unit: i.unit,
    stockByWarehouse: Object.fromEntries(i.warehouseStocks.map((s) => [s.warehouseId, Number(s.quantity)])),
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
