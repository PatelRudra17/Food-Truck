import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export type AuditAction =
  | "LOGIN"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "CREATE"
  | "EDIT"
  | "ARCHIVE"
  | "APPROVE"
  | "REJECT"
  | "STOCK_ADJUSTMENT"
  | "DOCUMENT_VIEW"
  | "DOCUMENT_DOWNLOAD"
  | "SENSITIVE_DOCUMENT_ACCESS"
  | "EXPORT"
  | "PERMISSION_CHANGE"
  | "USER_CREATE"
  | "USER_DEACTIVATE"
  | "SETTINGS_CHANGE"
  | "MAINTENANCE_OVERRIDE"
  | "DISPATCH_OVERRIDE"
  | "VOID";

/**
 * Writes an immutable audit record. Never expose an update/delete path for AuditLog
 * from the application layer — this is the only writer.
 */
export async function writeAuditLog(params: {
  userId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
}) {
  let ipAddress: string | undefined;
  let userAgent: string | undefined;
  try {
    const hdrs = await headers();
    ipAddress = hdrs.get("x-forwarded-for") ?? undefined;
    userAgent = hdrs.get("user-agent") ?? undefined;
  } catch {
    // headers() unavailable outside a request scope (e.g. seed script) — safe to skip.
  }

  await prisma.auditLog.create({
    data: {
      userId: params.userId ?? undefined,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? undefined,
      oldValues: params.oldValues === undefined ? undefined : (params.oldValues as object),
      newValues: params.newValues === undefined ? undefined : (params.newValues as object),
      ipAddress,
      userAgent,
    },
  });
}
