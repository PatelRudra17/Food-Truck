"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getSessionUser } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { env } from "@/lib/env";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export type LoginFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

/**
 * The client address exactly as writeAuditLog records it in AuditLog.ipAddress
 * (the x-forwarded-for header), so failed attempts can be matched back to it.
 */
async function clientIp(): Promise<string | null> {
  try {
    return (await headers()).get("x-forwarded-for");
  } catch {
    return null;
  }
}

/**
 * Failed logins for this email from this client address within the window. Counting per
 * email + IP means one attacker hammering an account locks out only their own address,
 * not the real user signing in from elsewhere.
 */
async function recentFailedAttempts(email: string, ipAddress: string | null): Promise<number> {
  const since = new Date(Date.now() - env.RATE_LIMIT_LOGIN_WINDOW_MINUTES * 60 * 1000);
  return prisma.auditLog.count({
    where: {
      action: "LOGIN_FAILED",
      entityType: "User",
      entityId: email,
      ipAddress,
      createdAt: { gte: since },
    },
  });
}

export async function loginAction(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { email, password } = parsed.data;

  const attempts = await recentFailedAttempts(email, await clientIp());
  if (attempts >= env.RATE_LIMIT_LOGIN_MAX_ATTEMPTS) {
    return {
      error: `Too many failed attempts. Try again in ${env.RATE_LIMIT_LOGIN_WINDOW_MINUTES} minutes.`,
    };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  const passwordValid = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!user || !passwordValid || !user.isActive) {
    await writeAuditLog({
      action: "LOGIN_FAILED",
      entityType: "User",
      entityId: email,
    });
    return { error: "Invalid email or password." };
  }

  await createSession(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await writeAuditLog({ userId: user.id, action: "LOGIN", entityType: "User", entityId: user.id });

  redirect(safeNextPath(formData.get("next")));
}

/** Only same-app paths are honoured, so a crafted ?next= can't send users off-site. */
function safeNextPath(next: FormDataEntryValue | null): string {
  if (typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login")) {
    return next;
  }
  return "/dashboard";
}

export async function logoutAction() {
  const user = await getSessionUser();
  if (user) {
    await writeAuditLog({ userId: user.id, action: "LOGOUT", entityType: "User", entityId: user.id });
  }
  await destroySession();
  redirect("/login");
}
