import type { Prisma, PrismaClient, NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient | PrismaClient;

export async function notifyUser(
  tx: Tx,
  params: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
  },
) {
  return tx.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      entityType: params.entityType,
      entityId: params.entityId,
    },
  });
}

/** Broadcasts a notification to every active user holding the given role. */
export async function notifyRole(
  tx: Tx,
  params: {
    roleId: string;
    type: NotificationType;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
  },
) {
  return tx.notification.create({
    data: {
      roleId: params.roleId,
      type: params.type,
      title: params.title,
      message: params.message,
      entityType: params.entityType,
      entityId: params.entityId,
    },
  });
}

export async function notifyRoleByName(
  roleName: string,
  params: Omit<Parameters<typeof notifyRole>[1], "roleId">,
) {
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) return;
  return notifyRole(prisma, { ...params, roleId: role.id });
}
