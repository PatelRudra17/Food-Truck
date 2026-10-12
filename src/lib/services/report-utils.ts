// Pure helpers for src/lib/services/reports.ts (kept free of "server-only"/Prisma so they can be unit-tested).

/** Pages the UI may request; the export route asks for up to EXPORT_MAX_PAGE_SIZE rows in one go. */
export const DEFAULT_REPORT_PAGE_SIZE = 20;
export const EXPORT_MAX_PAGE_SIZE = 5000;

export interface PageInput {
  page?: string;
  pageSize?: string;
}

export function parseReportPage(
  filters: PageInput,
  defaultPageSize = DEFAULT_REPORT_PAGE_SIZE,
  maxPageSize = EXPORT_MAX_PAGE_SIZE,
) {
  const page = Math.max(1, Math.floor(Number(filters.page)) || 1);
  const pageSize = Math.min(maxPageSize, Math.max(1, Math.floor(Number(filters.pageSize)) || defaultPageSize));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

/** Pages a report that is built in memory (aggregations, expiry buckets) the same way as the database-paged ones. */
export function paginateRows<T>(rows: T[], filters: PageInput) {
  const { page, pageSize, skip, take } = parseReportPage(filters);
  return { rows: rows.slice(skip, skip + take), total: rows.length, page, pageSize };
}

/** Normalises the free-text search box: trims it and treats blank as "no search". */
export function normalizeQuery(q: string | undefined | null): string | undefined {
  const trimmed = q?.trim();
  return trimmed ? trimmed.slice(0, 100) : undefined;
}

/** Case-insensitive "contains" match of the search text against any of the given fields (no search matches all). */
export function matchesQuery(q: string | undefined, ...fields: (string | null | undefined)[]): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return fields.some((field) => !!field && field.toLowerCase().includes(needle));
}

/** Escapes LIKE/ILIKE wildcards so the search text is matched literally in a raw SQL pattern. */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
