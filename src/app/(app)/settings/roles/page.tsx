import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { RolesClient } from "@/components/roles/roles-client";

export const metadata = { title: "Roles & Permissions" };

export default async function RolesPage() {
  await requirePermission("MANAGE_ROLES");
  const user = await getSessionUser();

  const roles = await prisma.role.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true, permissions: true } } },
  });

  const rows = roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    isSystem: r.isSystem,
    userCount: r._count.users,
    permissionCount: r._count.permissions,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        description="Manage roles and the permissions each one grants."
      />
      <RolesClient roles={rows} canManage={hasPermission(user, "MANAGE_ROLES")} />
    </div>
  );
}
