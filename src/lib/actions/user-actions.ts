"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { userSchema, createUserSchema, resetPasswordSchema } from "@/lib/validators/user";
import { hashPassword } from "@/lib/auth/password";

const SUPER_ADMIN_ROLE_NAME = "Super Admin";

/** Counts other ACTIVE users (excluding excludeUserId) holding the Super Admin role. */
async function countOtherActiveSuperAdmins(excludeUserId: string): Promise<number> {
  return prisma.user.count({
    where: {
      id: { not: excludeUserId },
      isActive: true,
      role: { name: SUPER_ADMIN_ROLE_NAME },
    },
  });
}

export async function createUserAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requirePermission("MANAGE_USERS");
    const data = createUserSchema.parse(input);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new Error(`A user with email "${data.email}" already exists.`);

    const role = await prisma.role.findUnique({ where: { id: data.roleId } });
    if (!role) throw new Error("Selected role not found.");

    const passwordHash = await hashPassword(data.password);
    const created = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        roleId: data.roleId,
        isActive: data.isActive,
        passwordHash,
      },
    });

    await writeAuditLog({
      userId: actor.id,
      action: "USER_CREATE",
      entityType: "User",
      entityId: created.id,
      newValues: { name: data.name, email: data.email, roleId: data.roleId, roleName: role.name, isActive: data.isActive },
    });

    revalidatePath("/settings/users");
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateUserAction(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requirePermission("MANAGE_USERS");
    const data = userSchema.parse(input);

    const existing = await prisma.user.findUnique({ where: { id }, include: { role: true } });
    if (!existing) throw new Error("User not found.");

    if (data.email !== existing.email) {
      const emailInUse = await prisma.user.findUnique({ where: { email: data.email } });
      if (emailInUse) throw new Error(`Email "${data.email}" is already in use.`);
    }

    const isSelf = existing.id === actor.id;
    if (isSelf && !data.isActive) {
      throw new Error("You cannot deactivate your own account.");
    }

    const roleChanging = data.roleId !== existing.roleId;
    const willDeactivate = existing.isActive && !data.isActive;
    const wasSuperAdmin = existing.role.name === SUPER_ADMIN_ROLE_NAME;

    if (wasSuperAdmin && (roleChanging || willDeactivate)) {
      const others = await countOtherActiveSuperAdmins(existing.id);
      if (others === 0) {
        throw new Error(
          willDeactivate
            ? "Cannot deactivate the last active Super Admin."
            : "Cannot change the role of the last active Super Admin.",
        );
      }
    }

    const newRole = roleChanging ? await prisma.role.findUnique({ where: { id: data.roleId } }) : existing.role;
    if (!newRole) throw new Error("Selected role not found.");

    const updated = await prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email,
        roleId: data.roleId,
        isActive: data.isActive,
      },
    });

    if (willDeactivate) {
      await prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }

    await writeAuditLog({
      userId: actor.id,
      action: roleChanging ? "PERMISSION_CHANGE" : "EDIT",
      entityType: "User",
      entityId: id,
      oldValues: {
        name: existing.name,
        email: existing.email,
        roleId: existing.roleId,
        roleName: existing.role.name,
        isActive: existing.isActive,
      },
      newValues: {
        name: data.name,
        email: data.email,
        roleId: data.roleId,
        roleName: newRole.name,
        isActive: data.isActive,
      },
    });

    if (willDeactivate) {
      await writeAuditLog({
        userId: actor.id,
        action: "USER_DEACTIVATE",
        entityType: "User",
        entityId: id,
        oldValues: { isActive: true },
        newValues: { isActive: false },
      });
    }

    revalidatePath("/settings/users");
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function deactivateUserAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requirePermission("MANAGE_USERS");
    const existing = await prisma.user.findUnique({ where: { id }, include: { role: true } });
    if (!existing) throw new Error("User not found.");
    if (existing.id === actor.id) throw new Error("You cannot deactivate your own account.");
    if (!existing.isActive) throw new Error("User is already inactive.");

    if (existing.role.name === SUPER_ADMIN_ROLE_NAME) {
      const others = await countOtherActiveSuperAdmins(existing.id);
      if (others === 0) throw new Error("Cannot deactivate the last active Super Admin.");
    }

    await prisma.user.update({ where: { id }, data: { isActive: false } });
    await prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });

    await writeAuditLog({
      userId: actor.id,
      action: "USER_DEACTIVATE",
      entityType: "User",
      entityId: id,
      oldValues: { isActive: true },
      newValues: { isActive: false },
    });

    revalidatePath("/settings/users");
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function reactivateUserAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requirePermission("MANAGE_USERS");
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new Error("User not found.");
    if (existing.isActive) throw new Error("User is already active.");

    await prisma.user.update({ where: { id }, data: { isActive: true } });

    await writeAuditLog({
      userId: actor.id,
      action: "EDIT",
      entityType: "User",
      entityId: id,
      oldValues: { isActive: false },
      newValues: { isActive: true },
    });

    revalidatePath("/settings/users");
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function resetUserPasswordAction(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requirePermission("MANAGE_USERS");
    const data = resetPasswordSchema.parse(input);

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new Error("User not found.");

    const passwordHash = await hashPassword(data.newPassword);
    await prisma.user.update({ where: { id }, data: { passwordHash } });

    // Revoke existing sessions so the new password takes effect immediately.
    await prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });

    await writeAuditLog({
      userId: actor.id,
      action: "EDIT",
      entityType: "User",
      entityId: id,
      newValues: { passwordReset: true },
    });

    revalidatePath("/settings/users");
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}
