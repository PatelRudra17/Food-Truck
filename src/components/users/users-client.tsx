"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { format } from "date-fns";
import { Plus, Pencil, KeyRound, UserX, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type PaginationMeta } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UserFormDialog, type RoleOption } from "@/components/users/user-form-dialog";
import { ResetPasswordDialog } from "@/components/users/reset-password-dialog";
import { deactivateUserAction, reactivateUserAction } from "@/lib/actions/user-actions";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  isActive: boolean;
  lastLoginAt: string | null;
  isSelf: boolean;
};

export function UsersClient({
  users,
  roles,
  pagination,
  canCreate,
}: {
  users: UserRow[];
  roles: RoleOption[];
  pagination: PaginationMeta;
  canCreate: boolean;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  const columns = useMemo<ColumnDef<UserRow>[]>(
    () => [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "email", header: "Email" },
      { accessorKey: "roleName", header: "Role" },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) =>
          row.original.isActive ? (
            <Badge variant="outline" className="border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              Active
            </Badge>
          ) : (
            <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
              Inactive
            </Badge>
          ),
      },
      {
        id: "lastLogin",
        header: "Last Login",
        cell: ({ row }) =>
          row.original.lastLoginAt ? format(new Date(row.original.lastLoginAt), "dd MMM yyyy, HH:mm") : "Never",
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const u = row.original;
          return (
            <div className="flex justify-end gap-1.5">
              <UserFormDialog
                trigger={
                  <Button variant="outline" size="icon-sm" title="Edit">
                    <Pencil />
                  </Button>
                }
                roles={roles}
                editing={u}
                onSaved={refresh}
              />
              <ResetPasswordDialog
                trigger={
                  <Button variant="outline" size="icon-sm" title="Reset password">
                    <KeyRound />
                  </Button>
                }
                userId={u.id}
                userName={u.name}
              />
              {!u.isSelf &&
                (u.isActive ? (
                  <ConfirmDialog
                    trigger={
                      <Button variant="outline" size="icon-sm" title="Deactivate">
                        <UserX />
                      </Button>
                    }
                    title="Deactivate user?"
                    description={`"${u.name}" will no longer be able to sign in, and their active sessions will be revoked immediately.`}
                    confirmLabel="Deactivate"
                    destructive
                    onConfirm={() => deactivateUserAction(u.id)}
                    onSuccess={refresh}
                  />
                ) : (
                  <ConfirmDialog
                    trigger={
                      <Button variant="outline" size="icon-sm" title="Reactivate">
                        <RotateCcw />
                      </Button>
                    }
                    title="Reactivate user?"
                    description={`"${u.name}" will be able to sign in again.`}
                    confirmLabel="Reactivate"
                    onConfirm={() => reactivateUserAction(u.id)}
                    onSuccess={refresh}
                  />
                ))}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roles],
  );

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <UserFormDialog
            trigger={
              <Button size="sm">
                <Plus /> New User
              </Button>
            }
            roles={roles}
            onSaved={refresh}
          />
        </div>
      )}

      <DataTable
        columns={columns}
        data={users}
        pagination={pagination}
        emptyTitle="No users found."
        emptyDescription="Create a user account to get started."
      />
    </div>
  );
}
