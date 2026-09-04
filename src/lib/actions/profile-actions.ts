"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { updateProfileSchema, changePasswordSchema } from "@/lib/validators/profile";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { hashToken } from "@/lib/crypto";
import { env } from "@/lib/env";

export async function updateProfileAction(input: unknown): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const data = updateProfileSchema.parse(input);

    const existing = await prisma.user.findUnique({ where: { id: user.id } });
    if (!existing) throw new Error("User not found.");

    await prisma.user.update({ where: { id: user.id }, data: { name: data.name } });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "User",
      entityId: user.id,
      oldValues: { name: existing.name },
      newValues: { name: data.name },
    });

    revalidatePath("/profile");
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function changeMyPasswordAction(input: unknown): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const data = changePasswordSchema.parse(input);

    const existing = await prisma.user.findUnique({ where: { id: user.id } });
    if (!existing) throw new Error("User not found.");

    const valid = await verifyPassword(data.currentPassword, existing.passwordHash);
    if (!valid) throw new Error("Current password is incorrect.");

    const passwordHash = await hashPassword(data.newPassword);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "User",
      entityId: user.id,
      newValues: { passwordChanged: true },
    });

    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function getMySessions() {
  const user = await requireUser();
  const jar = await cookies();
  const currentToken = jar.get(env.SESSION_COOKIE_NAME)?.value;
  const currentTokenHash = currentToken ? hashToken(currentToken) : null;

  const sessions = await prisma.session.findMany({
    where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  return sessions.map((s) => ({
    id: s.id,
    ipAddress: s.ipAddress,
    userAgent: s.userAgent,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    isCurrent: s.tokenHash === currentTokenHash,
  }));
}

export async function revokeSessionAction(id: string): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const session = await prisma.session.findUnique({ where: { id } });
    if (!session || session.userId !== user.id) throw new Error("Session not found.");

    await prisma.session.update({ where: { id }, data: { revokedAt: new Date() } });

    revalidatePath("/profile");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function revokeOtherSessionsAction(): Promise<ActionResult<undefined>> {
  try {
    const user = await requireUser();
    const jar = await cookies();
    const currentToken = jar.get(env.SESSION_COOKIE_NAME)?.value;
    const currentTokenHash = currentToken ? hashToken(currentToken) : null;

    await prisma.session.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
        ...(currentTokenHash ? { tokenHash: { not: currentTokenHash } } : {}),
      },
      data: { revokedAt: new Date() },
    });

    revalidatePath("/profile");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}
