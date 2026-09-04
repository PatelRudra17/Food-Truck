import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { ItemForm } from "@/components/items/item-form";

export const metadata = { title: "New Item" };

export default async function NewItemPage() {
  await requirePermission("ITEM_CREATE");

  const [categories, warehouses, suppliers] = await Promise.all([
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

  return (
    <div className="space-y-6">
      <div>
        <Link href="/items" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to items
        </Link>
        <PageHeader title="New Item" description="Add a new item to the catalog." />
      </div>
      <ItemForm mode="create" categories={categories} warehouses={warehouses} suppliers={suppliers} />
    </div>
  );
}
