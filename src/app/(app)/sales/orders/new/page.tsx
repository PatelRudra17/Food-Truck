import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { PageHeader } from "@/components/shared/page-header";
import { SalesOrderForm } from "@/components/sales-orders/so-form";

export const metadata = { title: "New Sales Order" };

export default async function NewSalesOrderPage() {
  await requirePermission("SALES_ORDER_CREATE");

  const [customers, items] = await Promise.all([
    prisma.customer.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, customerCode: true, location: true },
    }),
    prisma.item.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true, unit: true, warehouseId: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="New Sales Order"
        description="Raise a sales order for a customer with one or more graded line items."
      />
      <SalesOrderForm customers={customers} items={items} />
    </div>
  );
}
