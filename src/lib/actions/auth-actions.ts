"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getSessionUser } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { env } from "@/lib/env";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export type LoginFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

async function recentFailedAttempts(email: string): Promise<number> {
  const since = new Date(Date.now() - env.RATE_LIMIT_LOGIN_WINDOW_MINUTES * 60 * 1000);
  return prisma.auditLog.count({
    where: {
      action: "LOGIN_FAILED",
      entityType: "User",
      entityId: email,
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

  const attempts = await recentFailedAttempts(email);
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

  redirect("/dashboard");
}

export async function logoutAction() {
  const user = await getSessionUser();
  if (user) {
    await writeAuditLog({ userId: user.id, action: "LOGOUT", entityType: "User", entityId: user.id });
  }
  await destroySession();
  redirect("/login");
}
