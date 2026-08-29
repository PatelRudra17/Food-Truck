"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guard";

export async function getMyNotifications(limit = 20) {
  const user = await requireUser();
  return prisma.notification.findMany({
    where: { OR: [{ userId: user.id }, { roleId: user.roleId }] },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getUnreadNotificationCount() {
  const user = await requireUser();
  return prisma.notification.count({
    where: { OR: [{ userId: user.id }, { roleId: user.roleId }], isRead: false },
  });
}

export async function markNotificationRead(id: string) {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { id, OR: [{ userId: user.id }, { roleId: user.roleId }] },
    data: { isRead: true },
  });
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { OR: [{ userId: user.id }, { roleId: user.roleId }], isRead: false },
    data: { isRead: true },
  });
  revalidatePath("/", "layout");
}
