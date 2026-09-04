import "server-only";
import type { Prisma } from "@prisma/client";

export type ItemListParams = {
  q?: string;
  categoryId?: string;
  warehouseId?: string;
  status?: "active" | "inactive" | "all";
  sortBy?: "name" | "currentStock" | "reorderLevel";
  sortDir?: "asc" | "desc";
};

/** Shared filter/sort builder used by both the /items list page and the Excel export route. */
export function buildItemWhere(params: ItemListParams): Prisma.ItemWhereInput {
  const where: Prisma.ItemWhereInput = {};

  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: "insensitive" } },
      { sku: { contains: params.q, mode: "insensitive" } },
      { itemCode: { contains: params.q, mode: "insensitive" } },
      { barcode: { contains: params.q, mode: "insensitive" } },
    ];
  }
  if (params.categoryId) where.categoryId = params.categoryId;
  if (params.warehouseId) where.warehouseId = params.warehouseId;
  if (params.status === "active") where.isActive = true;
  if (params.status === "inactive") where.isActive = false;

  return where;
}

export function buildItemOrderBy(params: ItemListParams): Prisma.ItemOrderByWithRelationInput {
  const dir = params.sortDir === "desc" ? "desc" : "asc";
  switch (params.sortBy) {
    case "currentStock":
      return { currentStock: dir };
    case "reorderLevel":
      return { reorderLevel: dir };
    case "name":
    default:
      return { name: dir };
  }
}

export function parseItemListParams(searchParams: Record<string, string | string[] | undefined>): ItemListParams {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return {
    q: one(searchParams.q) || undefined,
    categoryId: one(searchParams.categoryId) || undefined,
    warehouseId: one(searchParams.warehouseId) || undefined,
    status: (one(searchParams.status) as ItemListParams["status"]) || "active",
    sortBy: (one(searchParams.sortBy) as ItemListParams["sortBy"]) || "name",
    sortDir: (one(searchParams.sortDir) as ItemListParams["sortDir"]) || "asc",
  };
}
