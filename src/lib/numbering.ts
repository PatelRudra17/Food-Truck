import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClient;

const PREFIXES = {
  STOCK_INWARD: "INW",
  STOCK_OUTWARD: "OUT",
  STOCK_TRANSFER: "TRF",
  STOCK_ADJUSTMENT: "ADJ",
  PURCHASE_ORDER: "PO",
  GATE_ENTRY: "GTI",
  GATE_EXIT: "GTO",
  PROCUREMENT: "PROC",
  PROCUREMENT_BATCH: "BAT",
  SALES_ORDER: "SO",
  TRIP: "TRIP",
  CRATE_RETURN: "CRT",
  WASTAGE: "WST",
} as const;

export type NumberingDoc = keyof typeof PREFIXES;

/**
 * Generates a sequential, human-readable document number like "INW-2026-000123".
 * Must be called inside the same database transaction as the document it numbers,
 * so a rollback also rolls back the sequence increment.
 */
export async function nextDocumentNumber(tx: Tx, doc: NumberingDoc): Promise<string> {
  const year = new Date().getFullYear();
  const key = `${doc}-${year}`;

  const sequence = await tx.numberSequence.upsert({
    where: { key },
    create: { key, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  });

  const padded = String(sequence.lastValue).padStart(6, "0");
  return `${PREFIXES[doc]}-${year}-${padded}`;
}
