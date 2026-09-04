"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guard";
import type { NotificationType } from "@prisma/client";

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

/** Paginated, filterable variant of getMyNotifications() for the full /notifications page. */
export async function getMyNotificationsPaginated(params: {
  page?: number;
  pageSize?: number;
  isRead?: boolean;
  type?: NotificationType;
}) {
  const user = await requireUser();
  const page = params.page && params.page > 0 ? params.page : 1;
  const pageSize = params.pageSize && params.pageSize > 0 ? Math.min(params.pageSize, 100) : 20;

  const where = {
    OR: [{ userId: user.id }, { roleId: user.roleId }],
    ...(params.isRead !== undefined ? { isRead: params.isRead } : {}),
    ...(params.type ? { type: params.type } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where }),
  ]);

  return { rows, total, page, pageSize };
}
