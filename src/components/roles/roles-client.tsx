"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil, Trash2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RoleFormDialog } from "@/components/roles/role-form-dialog";
import { deleteRoleAction } from "@/lib/actions/role-actions";

export type RoleRow = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissionCount: number;
};

export function RolesClient({ roles, canManage }: { roles: RoleRow[]; canManage: boolean }) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <RoleFormDialog
            trigger={
              <Button size="sm">
                <Plus /> New Role
              </Button>
            }
            onSaved={(id) => router.push(`/settings/roles/${id}`)}
          />
        </div>
      )}

      {roles.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No roles yet" description="Create a role to get started." />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Users</TableHead>
                <TableHead className="text-right">Permissions</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <Link href={`/settings/roles/${r.id}`} className="hover:underline">
                      {r.name}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-sm truncate text-muted-foreground">{r.description ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.userCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.permissionCount}</TableCell>
                  <TableCell>
                    {r.isSystem ? (
                      <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
                        System
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-transparent bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                        Custom
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="outline" size="icon-sm" asChild title="Manage permissions">
                        <Link href={`/settings/roles/${r.id}`}>
                          <ShieldCheck />
                        </Link>
                      </Button>
                      {canManage && !r.isSystem && (
                        <>
                          <RoleFormDialog
                            trigger={
                              <Button variant="outline" size="icon-sm" title="Edit">
                                <Pencil />
                              </Button>
                            }
                            editing={r}
                            onSaved={refresh}
                          />
                          <ConfirmDialog
                            trigger={
                              <Button variant="outline" size="icon-sm" title="Delete" disabled={r.userCount > 0}>
                                <Trash2 />
                              </Button>
                            }
                            title="Delete role?"
                            description={`"${r.name}" will be permanently removed. This cannot be undone.`}
                            confirmLabel="Delete"
                            destructive
                            onConfirm={() => deleteRoleAction(r.id)}
                            onSuccess={refresh}
                          />
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
