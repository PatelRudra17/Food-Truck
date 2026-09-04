import { Prisma, type PrismaClient, Grade, GradeLedgerTxnType, LedgerTxnType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applyStockMovement, isNegativeStockAllowed } from "@/lib/services/inventory";

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Grade-aware produce inventory engine.
 *
 * `Item.currentStock` (via `applyStockMovement` in `inventory.ts`) remains the
 * single source of truth for a vegetable's TOTAL stock across every grade.
 * `ItemGradeStock` / `GradeLedger` carry the same total broken down by grade
 * (RAW / GRADE_A / GRADE_B / GRADE_C / OTHER). Every call to
 * `applyGradeStockMovement` below therefore does two things atomically:
 *
 *   1. Updates the ItemGradeStock row for (itemId, warehouseId, grade) and
 *      writes a GradeLedger entry (mirrors applyStockMovement's row-lock +
 *      before/after-qty pattern, scoped to one grade instead of the whole item).
 *   2. Calls applyStockMovement for the SAME item/warehouse with a mapped
 *      generic LedgerTxnType, so Item.currentStock stays in sync with the
 *      sum of its grade balances.
 *
 * DIRECTION: `quantity` is always a positive magnitude (never signed). Because
 * `GradeLedgerTxnType.SORTING` is used for BOTH sides of grading (decrementing
 * RAW and incrementing GRADE_A/B/C/OTHER in separate calls) and
 * `GradeLedgerTxnType.ADJUSTMENT`/`RETURN` can legitimately go either way, the
 * transaction type alone is NOT enough to infer whether a call increases or
 * decreases the grade balance. Callers MUST pass an explicit `direction`.
 *
 * MAPPING TABLE — GradeLedgerTxnType + direction -> generic LedgerTxnType
 * (this is the table later modules — Sales Order fulfillment, Dispatch,
 * Transfers — need to know before calling this function):
 *
 *   PROCUREMENT  + INCREASE  -> INWARD               (goods received, grade=RAW)
 *   SORTING      + DECREASE  -> OUTWARD               (RAW consumed by grading)
 *   SORTING      + INCREASE  -> INWARD                (graded output produced)
 *     (net effect of a balanced sort — gradeA+B+C+other+waste === rawWeight —
 *      is that Item.currentStock drops by exactly wasteWeight, because the
 *      RAW decrease of rawWeight and the grade increases of
 *      (rawWeight - wasteWeight) partially cancel out. No separate generic
 *      call is needed for the waste portion; it falls out of this arithmetic.)
 *   WASTAGE      + DECREASE  -> DAMAGED_DISPOSED      (grade-level wastage)
 *   DISPOSAL     + DECREASE  -> DAMAGED_DISPOSED      (warehouse dumping)
 *   SALE         + DECREASE  -> OUTWARD               (sold to customer)
 *   DISPATCH     + DECREASE  -> OUTWARD               (left the warehouse on a trip)
 *   TRANSFER_IN  + INCREASE  -> TRANSFER_IN           (received at destination)
 *   TRANSFER_OUT + DECREASE  -> TRANSFER_OUT          (left source warehouse)
 *   RETURN       + INCREASE  -> INWARD                (customer/sales return)
 *   RETURN       + DECREASE  -> OUTWARD               (returned to supplier — rare)
 *   ADJUSTMENT   + INCREASE  -> ADJUSTMENT_POSITIVE
 *   ADJUSTMENT   + DECREASE  -> ADJUSTMENT_NEGATIVE
 *
 * WASTAGE/DISPOSAL, SALE/DISPATCH, and TRANSFER_IN/TRANSFER_OUT only ever move
 * in one direction in practice, but `direction` is still required from the
 * caller for every call — it is never inferred — to keep this function honest
 * and to avoid silent mistakes when a new call site is added later.
 */

export type GradeMovementDirection = "INCREASE" | "DECREASE";

export class InsufficientGradeStockError extends Error {
  constructor(itemId: string, warehouseId: string, grade: Grade, available: Prisma.Decimal, requested: Prisma.Decimal) {
    super(
      `Insufficient ${grade} stock for item ${itemId} at warehouse ${warehouseId}: available ${available.toString()}, requested ${requested.toString()}.`,
    );
    this.name = "InsufficientGradeStockError";
  }
}

function mapToGenericTxnType(gradeType: GradeLedgerTxnType, direction: GradeMovementDirection): LedgerTxnType {
  switch (gradeType) {
    case "PROCUREMENT":
      return LedgerTxnType.INWARD;
    case "SORTING":
      return direction === "INCREASE" ? LedgerTxnType.INWARD : LedgerTxnType.OUTWARD;
    case "WASTAGE":
    case "DISPOSAL":
      return LedgerTxnType.DAMAGED_DISPOSED;
    case "SALE":
    case "DISPATCH":
      return LedgerTxnType.OUTWARD;
    case "TRANSFER_IN":
      return LedgerTxnType.TRANSFER_IN;
    case "TRANSFER_OUT":
      return LedgerTxnType.TRANSFER_OUT;
    case "RETURN":
      return direction === "INCREASE" ? LedgerTxnType.INWARD : LedgerTxnType.OUTWARD;
    case "ADJUSTMENT":
      return direction === "INCREASE" ? LedgerTxnType.ADJUSTMENT_POSITIVE : LedgerTxnType.ADJUSTMENT_NEGATIVE;
  }
}

/** Finds (or atomically creates, starting at quantity 0) the ItemGradeStock row id for (itemId, warehouseId, grade). */
async function getOrCreateGradeStockId(
  tx: Prisma.TransactionClient,
  itemId: string,
  warehouseId: string,
  grade: Grade,
): Promise<string> {
  const existing = await tx.itemGradeStock.findUnique({
    where: { itemId_warehouseId_grade: { itemId, warehouseId, grade } },
    select: { id: true },
  });
  if (existing) return existing.id;

  try {
    const created = await tx.itemGradeStock.create({
      data: { itemId, warehouseId, grade, quantity: 0 },
      select: { id: true },
    });
    return created.id;
  } catch {
    // Lost a create race against a concurrent transaction — the row exists now, re-fetch it.
    const retry = await tx.itemGradeStock.findUnique({
      where: { itemId_warehouseId_grade: { itemId, warehouseId, grade } },
      select: { id: true },
    });
    if (!retry) throw new Error(`Failed to create or find ItemGradeStock for item ${itemId}/${warehouseId}/${grade}.`);
    return retry.id;
  }
}

/**
 * Applies a single grade-aware stock movement atomically: locks the
 * ItemGradeStock row (creating it at quantity 0 first if needed), validates
 * the resulting balance, updates its quantity, writes a GradeLedger record,
 * AND calls applyStockMovement so Item.currentStock stays in sync. See the
 * file-level comment above for the full direction/mapping rules.
 *
 * MUST be called with a transaction client (`prisma.$transaction(async (tx) => ...)`).
 */
export async function applyGradeStockMovement(
  tx: Prisma.TransactionClient,
  params: {
    itemId: string;
    warehouseId: string;
    grade: Grade;
    transactionType: GradeLedgerTxnType;
    direction: GradeMovementDirection;
    quantity: Prisma.Decimal | number | string; // always a positive magnitude
    referenceType: string;
    referenceId: string;
    referenceNumber: string;
    batchId?: string;
    userId: string;
    reason?: string;
  },
) {
  const quantity = new Prisma.Decimal(params.quantity);
  if (quantity.lte(0)) {
    throw new Error("Grade stock movement quantity must be greater than zero.");
  }

  const stockId = await getOrCreateGradeStockId(tx, params.itemId, params.warehouseId, params.grade);

  // Row-level lock so concurrent movements on the same item/warehouse/grade serialize instead of racing.
  const locked = await tx.$queryRaw<{ quantity: Prisma.Decimal }[]>`
    SELECT quantity FROM "ItemGradeStock" WHERE id = ${stockId} FOR UPDATE
  `;
  if (locked.length === 0) {
    throw new Error(`ItemGradeStock ${stockId} not found.`);
  }
  const beforeQty = new Prisma.Decimal(locked[0].quantity);

  const increasing = params.direction === "INCREASE";
  const afterQty = increasing ? beforeQty.plus(quantity) : beforeQty.minus(quantity);

  if (!increasing && afterQty.lt(0)) {
    const allowNegative = await isNegativeStockAllowed(tx);
    if (!allowNegative) {
      throw new InsufficientGradeStockError(params.itemId, params.warehouseId, params.grade, beforeQty, quantity);
    }
  }

  await tx.itemGradeStock.update({
    where: { id: stockId },
    data: { quantity: afterQty },
  });

  await tx.gradeLedger.create({
    data: {
      itemId: params.itemId,
      warehouseId: params.warehouseId,
      grade: params.grade,
      transactionType: params.transactionType,
      quantity,
      beforeQty,
      afterQty,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      referenceNumber: params.referenceNumber,
      batchId: params.batchId,
      userId: params.userId,
      reason: params.reason,
    },
  });

  // Keep Item.currentStock (the generic total across all grades) in sync.
  const genericTxnType = mapToGenericTxnType(params.transactionType, params.direction);
  await applyStockMovement(tx, {
    itemId: params.itemId,
    warehouseId: params.warehouseId,
    transactionType: genericTxnType,
    quantity,
    referenceType: params.referenceType,
    referenceId: params.referenceId,
    referenceNumber: params.referenceNumber,
    userId: params.userId,
    reason: params.reason,
  });

  return { beforeQty, afterQty };
}

/**
 * Returns the current balance for every grade of an item at a warehouse
 * (including grades with no ItemGradeStock row yet, reported as 0). Used by
 * Sales Order stock-checks and the Sorting/Wastage UI — a clean, reusable
 * read path so callers never query ItemGradeStock directly.
 */
export async function getItemGradeStock(
  itemId: string,
  warehouseId: string,
  tx: Tx = prisma,
): Promise<{ grade: Grade; quantity: number }[]> {
  const rows = await tx.itemGradeStock.findMany({
    where: { itemId, warehouseId },
    select: { grade: true, quantity: true },
  });
  const byGrade = new Map(rows.map((r) => [r.grade, Number(r.quantity)]));
  return Object.values(Grade).map((grade) => ({ grade, quantity: byGrade.get(grade) ?? 0 }));
}
