/**
 * Shared expiry-status computation for Vehicle and Driver documents (and the
 * Vehicle master's own registration/insurance/PUC/fitness/permit date fields).
 * Feeds the dashboard's "Expiring Documents" KPI indirectly by keeping the
 * underlying expiryDate columns accurate — this module only renders status.
 */

export type ExpiryStatus = "EXPIRED" | "DUE_SOON" | "VALID" | "NONE";

export const DEFAULT_DUE_SOON_DAYS = 30;

export function getExpiryStatus(
  date: Date | string | null | undefined,
  dueSoonDays: number = DEFAULT_DUE_SOON_DAYS,
): ExpiryStatus {
  if (!date) return "NONE";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "NONE";
  const now = new Date();
  const dueBy = new Date(Date.now() + dueSoonDays * 86400000);
  if (d.getTime() < now.getTime()) return "EXPIRED";
  if (d.getTime() <= dueBy.getTime()) return "DUE_SOON";
  return "VALID";
}

/** Worst status among several dates — EXPIRED beats DUE_SOON beats VALID beats NONE. */
export function worstExpiryStatus(dates: (Date | string | null | undefined)[]): ExpiryStatus {
  const rank: Record<ExpiryStatus, number> = { EXPIRED: 3, DUE_SOON: 2, VALID: 1, NONE: 0 };
  let worst: ExpiryStatus = "NONE";
  for (const date of dates) {
    const status = getExpiryStatus(date);
    if (rank[status] > rank[worst]) worst = status;
  }
  return worst;
}
