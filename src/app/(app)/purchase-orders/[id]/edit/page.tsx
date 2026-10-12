import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { PageHeader } from "@/components/shared/page-header";
import { PurchaseOrderForm } from "@/components/purchase-orders/po-form";

export const metadata = { title: "Edit Purchase Order" };

export default async function EditPurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("PURCHASE_ORDER_EDIT");
  const { id } = await params;

  const [po, suppliers, items] = await Promise.all([
    prisma.purchaseOrder.findUnique({ where: { id }, include: { items: true } }),
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
  if (!po) notFound();
  if (po.status !== "DRAFT") redirect(`/purchase-orders/${id}`);

  return (
    <div className="space-y-4">
      <PageHeader title={`Edit ${po.poNumber}`} description="Only draft purchase orders can be edited." />
      <PurchaseOrderForm
        suppliers={suppliers}
        items={items.map((item) => ({
          ...item,
          purchasePrice: item.purchasePrice ? Number(item.purchasePrice) : null,
          taxPercent: item.taxPercent ? Number(item.taxPercent) : null,
        }))}
        poId={po.id}
        initialValues={{
          supplierId: po.supplierId,
          date: format(po.date, "yyyy-MM-dd"),
          expectedDelivery: po.expectedDelivery ? format(po.expectedDelivery, "yyyy-MM-dd") : "",
          remarks: po.remarks ?? "",
          items: po.items.map((line) => ({
            itemId: line.itemId,
            quantity: Number(line.quantity),
            rate: Number(line.rate),
            taxPercent: line.taxPercent == null ? 0 : Number(line.taxPercent),
          })),
        }}
      />
    </div>
  );
}
