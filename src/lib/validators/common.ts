import { z } from "zod";

// Invalid values in the URL (?page=abc, ?pageSize=99999) fall back to defaults instead of crashing the page.
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(100).catch(20),
});

export type Pagination = z.infer<typeof paginationSchema>;

/** A yyyy-MM-dd date from the URL, or "" when missing or malformed (so a bad link can't crash a query). */
export function dateParam(value: string | undefined | null): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
    ? value
    : "";
}

/** True when a number has at most `places` decimal places (e.g. money stored as Decimal(14, 2)). */
export function hasMaxDecimals(value: number, places: number): boolean {
  const scaled = value * 10 ** places;
  return Number.isFinite(scaled) && Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

/** True when a URL filter value is one of the allowed options; unknown values are then simply ignored. */
export function isOneOf<T extends string>(value: string | undefined | null, allowed: readonly T[]): value is T {
  return !!value && (allowed as readonly string[]).includes(value);
}

export function paginationMeta(total: number, { page, pageSize }: Pagination) {
  return {
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Standard discriminated result shape returned by every server action. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const GENERIC_ERROR = "Something went wrong. Please try again.";

/**
 * Turns a thrown error into a message fit for a toast. Validation and database
 * errors are translated instead of leaking raw Zod JSON or Prisma internals.
 * Prisma errors are detected by name so this file stays safe to import from client code.
 */
export function actionError(error: unknown): ActionResult<never> {
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues[0]?.message ?? "Please check the form and try again." };
  }
  if (error instanceof Error) {
    if (error.name === "PrismaClientKnownRequestError") {
      const { code, meta } = error as Error & { code?: string; meta?: { target?: unknown } };
      if (code === "P2002") {
        const target = Array.isArray(meta?.target) ? meta.target.join(", ") : "these details";
        return { ok: false, error: `A record with the same ${target} already exists.` };
      }
      if (code === "P2025") return { ok: false, error: "The record was not found. It may have been removed." };
      if (code === "P2003") return { ok: false, error: "This record is linked to other data and can't be changed that way." };
      return { ok: false, error: GENERIC_ERROR };
    }
    if (error.name.startsWith("PrismaClient")) return { ok: false, error: GENERIC_ERROR };
    return { ok: false, error: error.message };
  }
  return { ok: false, error: GENERIC_ERROR };
}
