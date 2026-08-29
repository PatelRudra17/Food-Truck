import "server-only";
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

/** Throws ForbiddenError if the current user lacks the given permission. */
export async function requirePermission(permission: PermissionCode): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.permissions.includes(permission)) {
    throw new ForbiddenError(permission);
  }
  return user;
}

export function hasPermission(user: SessionUser | null, permission: PermissionCode): boolean {
  return !!user?.permissions.includes(permission);
}
