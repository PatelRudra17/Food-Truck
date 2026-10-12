import "server-only";
import { headers } from "next/headers";
import { forbidden } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import type { PermissionCode } from "@/lib/auth/permissions";

export class UnauthenticatedError extends Error {
  constructor() {
    super("You must be signed in to do that.");
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends Error {
  constructor(permission?: string) {
    super(
      permission
        ? `You do not have permission to perform this action (${permission}).`
        : "You do not have permission to perform this action.",
    );
    this.name = "ForbiddenError";
  }
}

/** Throws UnauthenticatedError if no valid session exists. Use at the top of every server action/route. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthenticatedError();
  return user;
}

/**
 * Denies access. Server actions get a ForbiddenError their callers turn into a
 * toast; pages and route handlers get Next's 403 (src/app/forbidden.tsx)
 * instead of a generic 500 error page.
 */
async function deny(permission: string): Promise<never> {
  const isServerAction = (await headers()).has("next-action");
  if (isServerAction) throw new ForbiddenError(permission);
  forbidden();
}

/** Throws (see deny) if the current user lacks the given permission. */
export async function requirePermission(permission: PermissionCode): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.permissions.includes(permission)) {
    await deny(permission);
  }
  return user;
}

/** Throws ForbiddenError unless the current user holds at least one of the given permissions. */
export async function requireAnyPermission(...permissions: PermissionCode[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!permissions.some((p) => user.permissions.includes(p))) {
    await deny(permissions.join(" or "));
  }
  return user;
}

export function hasPermission(user: SessionUser | null, permission: PermissionCode): boolean {
  return !!user?.permissions.includes(permission);
}
