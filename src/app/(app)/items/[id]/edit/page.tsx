import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { ItemForm } from "@/components/items/item-form";

export const metadata = { title: "Edit Item" };

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("ITEM_EDIT");
  const { id } = await params;

  const [item, categories, warehouses, suppliers] = await Promise.all([
    prisma.item.findUnique({ where: { id } }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.warehouse.findMany({
      orderBy: { name: "asc" },
      include: { locations: { orderBy: [{ rack: "asc" }, { shelf: "asc" }, { bin: "asc" }] } },
    }),
    prisma.supplier.findMany({
      where: { status: "ACTIVE" },
      orderBy: { companyName: "asc" },
      select: { id: true, companyName: true, code: true },
    }),
  ]);

  if (!item) notFound();

  const initial = {
    id: item.id,
    sku: item.sku,
    itemCode: item.itemCode,
    name: item.name,
    categoryId: item.categoryId,
    brand: item.brand ?? "",
    description: item.description ?? "",
    unit: item.unit,
    minStock: Number(item.minStock),
    maxStock: item.maxStock === null ? ("" as const) : Number(item.maxStock),
    reorderLevel: Number(item.reorderLevel),
    warehouseId: item.warehouseId ?? "",
    locationId: item.locationId ?? "",
    supplierId: item.supplierId ?? "",
    purchasePrice: item.purchasePrice === null ? ("" as const) : Number(item.purchasePrice),
    taxPercent: item.taxPercent === null ? ("" as const) : Number(item.taxPercent),
    hsnCode: item.hsnCode ?? "",
    barcode: item.barcode ?? "",
    batchTracked: item.batchTracked,
    serialTracked: item.serialTracked,
    expiryTracked: item.expiryTracked,
    imageUrl: item.imageUrl ?? "",
    isActive: item.isActive,
    isTemperatureSensitive: item.isTemperatureSensitive,
    storageMinTempC: item.storageMinTempC === null ? ("" as const) : Number(item.storageMinTempC),
    storageMaxTempC: item.storageMaxTempC === null ? ("" as const) : Number(item.storageMaxTempC),
    storageType: item.storageType ?? "",
    storageLocationText: item.storageLocationText ?? "",
    shelfLifeDays: item.shelfLifeDays ?? ("" as const),
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/items/${id}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to item
        </Link>
        <PageHeader title={`Edit ${item.name}`} description="Current stock is not editable here — use stock movements instead." />
      </div>
      <ItemForm mode="edit" categories={categories} warehouses={warehouses} suppliers={suppliers} initial={initial} />
    </div>
  );
}
