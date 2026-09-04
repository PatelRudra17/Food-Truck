import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { CategoriesClient } from "@/components/categories/categories-client";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  await requirePermission("CATEGORY_VIEW");
  const user = await getSessionUser();

  const categories = await prisma.category.findMany({
    orderBy: [{ name: "asc" }],
    include: { _count: { select: { items: true, children: true } } },
  });

  const rows = categories.map((c) => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId,
    description: c.description,
    isActive: c.isActive,
    itemCount: c._count.items,
    childCount: c._count.children,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Organize items into categories and one level of subcategories."
      />
      <CategoriesClient
        categories={rows}
        canCreate={hasPermission(user, "CATEGORY_CREATE")}
        canEdit={hasPermission(user, "CATEGORY_EDIT")}
        canArchive={hasPermission(user, "CATEGORY_ARCHIVE")}
      />
    </div>
  );
}
