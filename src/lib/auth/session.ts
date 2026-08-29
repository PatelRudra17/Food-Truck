import "server-only";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { generateToken, hashToken } from "@/lib/crypto";

const TTL_MS = env.SESSION_TTL_HOURS * 60 * 60 * 1000;

export async function createSession(userId: string) {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const hdrs = await headers();
  const expiresAt = new Date(Date.now() + TTL_MS);

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      ipAddress: hdrs.get("x-forwarded-for") ?? undefined,
      userAgent: hdrs.get("user-agent") ?? undefined,
    },
  });

  const jar = await cookies();
  jar.set(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(env.SESSION_COOKIE_NAME)?.value;
  if (token) {
    const tokenHash = hashToken(token);
    await prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  jar.delete(env.SESSION_COOKIE_NAME);
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  isActive: boolean;
  permissions: string[];
};

/** Resolves the current session's user, or null if unauthenticated/expired. Does not throw. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(env.SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          role: { include: { permissions: { include: { permission: true } } } },
        },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return null;
  }
  if (!session.user.isActive) {
    return null;
  }

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    roleId: session.user.roleId,
    roleName: session.user.role.name,
    isActive: session.user.isActive,
    permissions: session.user.role.permissions.map((rp) => rp.permission.code),
  };
}
