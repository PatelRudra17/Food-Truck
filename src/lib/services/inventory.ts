import { Prisma, type PrismaClient, LedgerTxnType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient | PrismaClient;

const INCREASING_TYPES: LedgerTxnType[] = [
  LedgerTxnType.OPENING,
  LedgerTxnType.INWARD,
  LedgerTxnType.TRANSFER_IN,
  LedgerTxnType.ADJUSTMENT_POSITIVE,
];

export class InsufficientStockError extends Error {
  constructor(itemId: string, available: Prisma.Decimal, requested: Prisma.Decimal) {
    super(
      `Insufficient stock for item ${itemId}: available ${available.toString()}, requested ${requested.toString()}.`,
    );
    this.name = "InsufficientStockError";
  }
}

export async function isNegativeStockAllowed(tx: Tx = prisma): Promise<boolean> {
  const setting = await tx.systemSetting.findUnique({ where: { key: "ALLOW_NEGATIVE_STOCK" } });
  if (setting && typeof setting.value === "boolean") return setting.value;
  return process.env.ALLOW_NEGATIVE_STOCK === "true";
}

/**
 * Applies a single stock movement atomically: locks the item row, validates the
 * resulting balance, updates Item.currentStock, and writes the InventoryLedger record.
 *
 * MUST be called with a transaction client (`prisma.$transaction(async (tx) => ...)`)
 * so the movement, the referencing document, and the audit log commit or roll back together.
 */
export async function applyStockMovement(
  tx: Prisma.TransactionClient,
  params: {
    itemId: string;
    warehouseId: string;
    transactionType: LedgerTxnType;
    quantity: Prisma.Decimal | number | string; // always a positive magnitude
    referenceType: string;
    referenceId: string;
    referenceNumber: string;
    userId: string;
    reason?: string;
  },
) {
  const quantity = new Prisma.Decimal(params.quantity);
  if (quantity.lte(0)) {
    throw new Error("Stock movement quantity must be greater than zero.");
  }

  // Row-level lock so concurrent movements on the same item serialize instead of racing.
  const locked = await tx.$queryRaw<{ currentStock: Prisma.Decimal }[]>`
    SELECT "currentStock" FROM "Item" WHERE id = ${params.itemId} FOR UPDATE
  `;
  if (locked.length === 0) {
    throw new Error(`Item ${params.itemId} not found.`);
  }
  const beforeQty = new Prisma.Decimal(locked[0].currentStock);

  const increasing = INCREASING_TYPES.includes(params.transactionType);
  const afterQty = increasing ? beforeQty.plus(quantity) : beforeQty.minus(quantity);

  if (!increasing && afterQty.lt(0)) {
    const allowNegative = await isNegativeStockAllowed(tx);
    if (!allowNegative) {
      throw new InsufficientStockError(params.itemId, beforeQty, quantity);
    }
  }

  await tx.item.update({
    where: { id: params.itemId },
    data: { currentStock: afterQty },
  });

  await tx.inventoryLedger.create({
    data: {
      itemId: params.itemId,
      warehouseId: params.warehouseId,
      transactionType: params.transactionType,
      quantity,
      beforeQty,
      afterQty,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      referenceNumber: params.referenceNumber,
      userId: params.userId,
      reason: params.reason,
    },
  });

  return { beforeQty, afterQty };
}
