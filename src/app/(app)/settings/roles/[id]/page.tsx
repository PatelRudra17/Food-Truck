import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { RoleFormDialog } from "@/components/roles/role-form-dialog";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { PermissionMatrix } from "@/components/roles/permission-matrix";

export const metadata = { title: "Role Detail" };

export default async function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("MANAGE_ROLES");
  const { id } = await params;
  const user = await getSessionUser();

  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { users: true } },
    },
  });
  if (!role) notFound();

  const initialCodes = role.permissions.map((rp) => rp.permission.code);
  const canManage = hasPermission(user, "MANAGE_ROLES");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/settings/roles"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to roles
        </Link>
        <PageHeader
          title={role.name}
          description={role.description ?? `${role._count.users} user(s) assigned.`}
          actions={
            <div className="flex items-center gap-2">
              {role.isSystem ? (
                <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
                  System Role
                </Badge>
              ) : (
                <Badge variant="outline" className="border-transparent bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                  Custom Role
                </Badge>
              )}
              {canManage && !role.isSystem && (
                <RoleFormDialog
                  trigger={
                    <Button variant="outline" size="sm">
                      <Pencil /> Edit
                    </Button>
                  }
                  editing={{ id: role.id, name: role.name, description: role.description }}
                />
              )}
            </div>
          }
        />
      </div>

      <PermissionMatrix roleId={role.id} initialCodes={initialCodes} disabled={!canManage} />
    </div>
  );
}
