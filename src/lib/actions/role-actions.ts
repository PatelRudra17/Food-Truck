"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { roleSchema, savePermissionsSchema } from "@/lib/validators/role";
import { ALL_PERMISSIONS } from "@/lib/auth/permissions";

export async function createRoleAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requirePermission("MANAGE_ROLES");
    const data = roleSchema.parse(input);

    const existing = await prisma.role.findUnique({ where: { name: data.name } });
    if (existing) throw new Error(`A role named "${data.name}" already exists.`);

    const created = await prisma.role.create({
      data: { name: data.name, description: data.description, isSystem: false },
    });

    await writeAuditLog({
      userId: actor.id,
      action: "CREATE",
      entityType: "Role",
      entityId: created.id,
      newValues: data,
    });

    revalidatePath("/settings/roles");
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateRoleAction(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requirePermission("MANAGE_ROLES");
    const data = roleSchema.parse(input);

    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) throw new Error("Role not found.");
    if (existing.isSystem) {
      throw new Error("System roles cannot be renamed — only their permissions can be changed.");
    }

    if (data.name !== existing.name) {
      const nameInUse = await prisma.role.findUnique({ where: { name: data.name } });
      if (nameInUse) throw new Error(`A role named "${data.name}" already exists.`);
    }

    const updated = await prisma.role.update({
      where: { id },
      data: { name: data.name, description: data.description },
    });

    await writeAuditLog({
      userId: actor.id,
      action: "EDIT",
      entityType: "Role",
      entityId: id,
      oldValues: { name: existing.name, description: existing.description },
      newValues: data,
    });

    revalidatePath("/settings/roles");
    revalidatePath(`/settings/roles/${id}`);
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteRoleAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requirePermission("MANAGE_ROLES");
    const existing = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!existing) throw new Error("Role not found.");
    if (existing.isSystem) throw new Error("System roles cannot be deleted.");
    if (existing._count.users > 0) {
      throw new Error(
        `Cannot delete this role — ${existing._count.users} user(s) are still assigned to it. Reassign them first.`,
      );
    }

    await prisma.role.delete({ where: { id } });

    await writeAuditLog({
      userId: actor.id,
      action: "ARCHIVE",
      entityType: "Role",
      entityId: id,
      oldValues: { name: existing.name, description: existing.description },
    });

    revalidatePath("/settings/roles");
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function saveRolePermissionsAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requirePermission("MANAGE_ROLES");
    const data = savePermissionsSchema.parse(input);

    const role = await prisma.role.findUnique({ where: { id: data.roleId } });
    if (!role) throw new Error("Role not found.");

    const validCodes = new Set<string>(ALL_PERMISSIONS);
    const requestedCodes = Array.from(new Set(data.permissionCodes.filter((c) => validCodes.has(c))));

    // Removing these from Super Admin could leave nobody able to manage users or roles.
    if (role.name === "Super Admin") {
      const missing = ["MANAGE_USERS", "MANAGE_ROLES"].filter((c) => !requestedCodes.includes(c));
      if (missing.length > 0) {
        throw new Error(`Super Admin must keep ${missing.join(" and ")} so the system stays manageable.`);
      }
    }

    const [permissions, current] = await Promise.all([
      prisma.permission.findMany({ where: { code: { in: requestedCodes } } }),
      prisma.rolePermission.findMany({ where: { roleId: data.roleId }, include: { permission: true } }),
    ]);

    const currentCodes = new Set(current.map((rp) => rp.permission.code));
    const nextCodes = new Set(requestedCodes);

    const toAdd = permissions.filter((p) => !currentCodes.has(p.code));
    const toRemove = current.filter((rp) => !nextCodes.has(rp.permission.code));

    await prisma.$transaction(async (tx) => {
      if (toRemove.length > 0) {
        await tx.rolePermission.deleteMany({
          where: { roleId: data.roleId, permissionId: { in: toRemove.map((rp) => rp.permissionId) } },
        });
      }
      if (toAdd.length > 0) {
        await tx.rolePermission.createMany({
          data: toAdd.map((p) => ({ roleId: data.roleId, permissionId: p.id })),
          skipDuplicates: true,
        });
      }
    });

    await writeAuditLog({
      userId: actor.id,
      action: "PERMISSION_CHANGE",
      entityType: "Role",
      entityId: data.roleId,
      oldValues: { roleName: role.name, permissions: Array.from(currentCodes).sort() },
      newValues: { roleName: role.name, permissions: Array.from(nextCodes).sort() },
    });

    revalidatePath("/settings/roles");
    revalidatePath(`/settings/roles/${data.roleId}`);
    return { ok: true, data: { id: data.roleId } };
  } catch (error) {
    return actionError(error);
  }
}
