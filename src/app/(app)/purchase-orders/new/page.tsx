import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { PageHeader } from "@/components/shared/page-header";
import { PurchaseOrderForm } from "@/components/purchase-orders/po-form";

export const metadata = { title: "New Purchase Order" };

export default async function NewPurchaseOrderPage() {
  await requirePermission("PURCHASE_ORDER_CREATE");

  const [suppliers, items] = await Promise.all([
    prisma.supplier.findMany({
      where: { status: "ACTIVE" },
      orderBy: { companyName: "asc" },
      select: { id: true, companyName: true, code: true },
    }),
    prisma.item.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
        purchasePrice: true,
        taxPercent: true,
        supplierId: true,
      },
    }),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="New Purchase Order"
        description="Raise a purchase order to a supplier with one or more line items."
      />
      <PurchaseOrderForm
        suppliers={suppliers}
        items={items.map((item) => ({
          ...item,
          purchasePrice: item.purchasePrice ? Number(item.purchasePrice) : null,
          taxPercent: item.taxPercent ? Number(item.taxPercent) : null,
        }))}
      />
    </div>
  );
}
