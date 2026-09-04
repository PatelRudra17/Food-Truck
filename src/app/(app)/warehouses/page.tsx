import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { WarehousesClient } from "@/components/warehouses/warehouses-client";

export const metadata = { title: "Warehouses" };

export default async function WarehousesPage() {
  await requirePermission("WAREHOUSE_VIEW");
  const user = await getSessionUser();

  const [warehouses, managers] = await Promise.all([
    prisma.warehouse.findMany({
      orderBy: { name: "asc" },
      include: { manager: true, _count: { select: { items: true, locations: true } } },
    }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const rows = warehouses.map((w) => ({
    id: w.id,
    code: w.code,
    name: w.name,
    address: w.address,
    contact: w.contact,
    status: w.status,
    managerId: w.managerId,
    managerName: w.manager?.name ?? null,
    itemCount: w._count.items,
    locationCount: w._count.locations,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Warehouses" description="Manage warehouses, managers and storage locations." />
      <WarehousesClient
        warehouses={rows}
        managers={managers}
        canCreate={hasPermission(user, "WAREHOUSE_CREATE")}
        canEdit={hasPermission(user, "WAREHOUSE_EDIT")}
        canArchive={hasPermission(user, "WAREHOUSE_ARCHIVE")}
      />
    </div>
  );
}
