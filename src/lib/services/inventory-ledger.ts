import "server-only";
import { Prisma, LedgerTxnType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type LedgerQuery = {
  q?: string;
  itemId?: string;
  warehouseId?: string;
  transactionType?: string;
  dateFrom?: string;
  dateTo?: string;
};

/** True for a real calendar date in `yyyy-MM-dd` form (what `<input type="date">` sends). */
function isValidDateParam(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00.000`).getTime());
}

/** Parses ledger filter params from either awaited Next.js searchParams or a URLSearchParams getter. */
export function parseLedgerQuery(get: (key: string) => string | null | undefined): LedgerQuery {
  const pick = (key: string) => {
    const value = get(key);
    return value && value.length > 0 ? value : undefined;
  };
  // Malformed dates (e.g. ?dateFrom=abc) are ignored rather than reaching Prisma as Invalid Date.
  const pickDate = (key: string) => {
    const value = pick(key);
    return value && isValidDateParam(value) ? value : undefined;
  };
  return {
    q: pick("q"),
    itemId: pick("itemId"),
    warehouseId: pick("warehouseId"),
    transactionType: pick("transactionType"),
    dateFrom: pickDate("dateFrom"),
    dateTo: pickDate("dateTo"),
  };
}

export function buildLedgerWhere(filters: LedgerQuery): Prisma.InventoryLedgerWhereInput {
  const where: Prisma.InventoryLedgerWhereInput = {};

  if (filters.q) {
    where.referenceNumber = { contains: filters.q, mode: "insensitive" };
  }
  if (filters.itemId) where.itemId = filters.itemId;
  if (filters.warehouseId) where.warehouseId = filters.warehouseId;
  if (filters.transactionType && filters.transactionType in LedgerTxnType) {
    where.transactionType = filters.transactionType as LedgerTxnType;
  }
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(`${filters.dateFrom}T00:00:00.000`);
    if (filters.dateTo) where.createdAt.lte = new Date(`${filters.dateTo}T23:59:59.999`);
  }

  return where;
}

const LEDGER_INCLUDE = {
  item: { select: { id: true, name: true, sku: true } },
  warehouse: { select: { id: true, name: true, code: true } },
  user: { select: { id: true, name: true } },
} satisfies Prisma.InventoryLedgerInclude;

export async function queryLedgerPage(
  filters: LedgerQuery,
  pagination: { page: number; pageSize: number },
) {
  const where = buildLedgerWhere(filters);
  const [rows, total] = await Promise.all([
    prisma.inventoryLedger.findMany({
      where,
      include: LEDGER_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    prisma.inventoryLedger.count({ where }),
  ]);
  return { rows, total };
}

/** For exports: fetches every matching row (capped) without pagination. */
export async function queryLedgerForExport(filters: LedgerQuery, cap = 20000) {
  const where = buildLedgerWhere(filters);
  return prisma.inventoryLedger.findMany({
    where,
    include: LEDGER_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: cap,
  });
}

/**
 * Best-effort link to the source document for a ledger reference, or null if not mapped.
 * SORTING/UNLOADING rows carry the procurement batch number as their referenceNumber
 * (their referenceId is the sorting/unloading record, which has no page of its own).
 */
export function referenceHref(
  referenceType: string,
  referenceId: string,
  referenceNumber?: string,
): string | null {
  switch (referenceType) {
    case "StockInward":
      return `/stock/inward/${referenceId}`;
    case "StockOutward":
      return `/stock/outward/${referenceId}`;
    case "StockTransfer":
      return `/stock/transfer/${referenceId}`;
    case "StockAdjustment":
      return `/stock/adjustment/${referenceId}`;
    case "OPENING_BALANCE":
    case "ITEM_OPENING_BALANCE":
      return `/items/${referenceId}`;
    case "SORTING":
    case "UNLOADING":
      return referenceNumber
        ? `/procurement/batches?q=${encodeURIComponent(referenceNumber)}`
        : "/procurement/batches";
    case "WASTAGE":
      return referenceNumber ? `/wastage?q=${encodeURIComponent(referenceNumber)}` : "/wastage";
    case "Trip":
      return `/dispatch/trips/${referenceId}`;
    default:
      return null;
  }
}
