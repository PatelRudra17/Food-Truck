// Sequential master-data codes (EMP-001, LAB-001, ...). Codes are derived from the
// highest existing numeric suffix rather than a row count, so deletions can't make a
// code repeat, and the create is retried when two requests race for the same code.

/** Formats the code after `max` (the highest numeric suffix in use, or null when none). */
export function nextCodeFromMax(prefix: string, max: number | bigint | null | undefined, pad = 3): string {
  const next = Number(max ?? 0) + 1;
  return `${prefix}-${String(next).padStart(pad, "0")}`;
}

/** Highest numeric suffix among codes shaped `${prefix}-<digits>`; other codes are ignored. */
export function maxCodeSuffix(prefix: string, codes: readonly string[]): number | null {
  const pattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)$`);
  let max: number | null = null;
  for (const code of codes) {
    const match = pattern.exec(code);
    if (match) max = Math.max(max ?? 0, Number(match[1]));
  }
  return max;
}

/** True for a Prisma unique-constraint violation (P2002) on the given field. */
export function isUniqueConflict(error: unknown, field: string): boolean {
  if (!(error instanceof Error) || error.name !== "PrismaClientKnownRequestError") return false;
  const { code, meta } = error as Error & { code?: string; meta?: { target?: unknown } };
  if (code !== "P2002") return false;
  const target = meta?.target;
  if (Array.isArray(target)) return target.includes(field);
  return typeof target === "string" ? target.includes(field) : true;
}

/**
 * Runs `attempt` (typically a whole `$transaction` that picks the next code and inserts
 * the row) and retries it when it loses a race on the unique `field`.
 */
export async function retryOnUniqueConflict<T>(field: string, attempt: () => Promise<T>, maxAttempts = 5): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await attempt();
    } catch (error) {
      if (i >= maxAttempts || !isUniqueConflict(error, field)) throw error;
    }
  }
}
