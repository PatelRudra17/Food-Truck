"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guard";
import type { NotificationType, Prisma } from "@prisma/client";

/*
 * Read state: a notification sent to one user uses its own isRead flag; one sent
 * to a whole role records each reader in NotificationRead, so one person
 * reading it doesn't mark it read for the rest of the role.
 */
type Viewer = { id: string; roleId: string };

function mine(user: Viewer): Prisma.NotificationWhereInput {
  return { OR: [{ userId: user.id }, { roleId: user.roleId }] };
}

function readState(user: Viewer, isRead: boolean): Prisma.NotificationWhereInput {
  return {
    OR: [
      { userId: user.id, isRead },
      { roleId: user.roleId, reads: isRead ? { some: { userId: user.id } } : { none: { userId: user.id } } },
    ],
  };
}

async function findMine(user: Viewer, args: Omit<Prisma.NotificationFindManyArgs, "include" | "select">) {
  const rows = await prisma.notification.findMany({
    ...args,
    include: { reads: { where: { userId: user.id }, select: { userId: true } } },
  });
  return rows.map(({ reads, ...n }) => ({ ...n, isRead: n.userId ? n.isRead : reads.length > 0 }));
}

export async function getMyNotifications(limit = 20) {
  const user = await requireUser();
  return findMine(user, { where: mine(user), orderBy: { createdAt: "desc" }, take: limit });
}

export async function getUnreadNotificationCount() {
  const user = await requireUser();
  return prisma.notification.count({ where: readState(user, false) });
}

async function markRead(user: Viewer, where: Prisma.NotificationWhereInput) {
  await prisma.notification.updateMany({ where: { AND: [where, { userId: user.id }] }, data: { isRead: true } });
  const roleWide = await prisma.notification.findMany({
    where: { AND: [where, { roleId: user.roleId, reads: { none: { userId: user.id } } }] },
    select: { id: true },
  });
  if (roleWide.length > 0) {
    await prisma.notificationRead.createMany({
      data: roleWide.map((n) => ({ notificationId: n.id, userId: user.id })),
      skipDuplicates: true,
    });
  }
}

export async function markNotificationRead(id: string) {
  const user = await requireUser();
  await markRead(user, { id });
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await markRead(user, readState(user, false));
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

  const where: Prisma.NotificationWhereInput = {
    AND: [
      params.isRead !== undefined ? readState(user, params.isRead) : mine(user),
      ...(params.type ? [{ type: params.type }] : []),
    ],
  };

  const [rows, total] = await Promise.all([
    findMine(user, {
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where }),
  ]);

  return { rows, total, page, pageSize };
}
