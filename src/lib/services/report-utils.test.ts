import { describe, expect, it } from "vitest";
import { likePattern, matchesQuery, normalizeQuery, paginateRows, parseReportPage } from "./report-utils";

describe("parseReportPage", () => {
  it("defaults to page 1 of 20", () => {
    expect(parseReportPage({})).toEqual({ page: 1, pageSize: 20, skip: 0, take: 20 });
  });
  it("caps the page size at the export limit and ignores junk", () => {
    expect(parseReportPage({ page: "abc", pageSize: "99999" })).toMatchObject({ page: 1, pageSize: 5000 });
    expect(parseReportPage({ page: "3", pageSize: "10" })).toEqual({ page: 3, pageSize: 10, skip: 20, take: 10 });
  });
});

describe("paginateRows", () => {
  const rows = Array.from({ length: 191 }, (_, i) => i);
  it("returns one page of an in-memory report with the full total", () => {
    const result = paginateRows(rows, {});
    expect(result.rows).toHaveLength(20);
    expect(result.total).toBe(191);
    expect(result.pageSize).toBe(20);
  });
  it("returns the last partial page", () => {
    const result = paginateRows(rows, { page: "10", pageSize: "20" });
    expect(result.rows).toEqual([180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190]);
  });
  it("lets the export fetch everything in one page", () => {
    expect(paginateRows(rows, { page: "1", pageSize: "5000" }).rows).toHaveLength(191);
  });
});

describe("search helpers", () => {
  it("normalizes blank searches to undefined", () => {
    expect(normalizeQuery("   ")).toBeUndefined();
    expect(normalizeQuery(undefined)).toBeUndefined();
    expect(normalizeQuery("  abc ")).toBe("abc");
  });
  it("matches case-insensitively against any field", () => {
    expect(matchesQuery("fresh", "Fresh Farms Ltd", null)).toBe(true);
    expect(matchesQuery("zzz", "Fresh Farms Ltd", undefined)).toBe(false);
    expect(matchesQuery(undefined, "anything")).toBe(true);
  });
  it("escapes LIKE wildcards", () => {
    expect(likePattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
  });
});
