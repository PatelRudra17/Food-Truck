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
  /** `itemLabel` is user-facing (e.g. `Tomatoes (SKU-001)`) — never pass a raw id. */
  constructor(itemLabel: string, available: Prisma.Decimal, requested: Prisma.Decimal) {
    super(
      `Insufficient stock for ${itemLabel}: available ${available.toString()}, requested ${requested.toString()}.`,
    );
    this.name = "InsufficientStockError";
  }
}

export async function isNegativeStockAllowed(tx: Tx = prisma): Promise<boolean> {
  const setting = await tx.systemSetting.findUnique({ where: { key: "ALLOW_NEGATIVE_STOCK" } });
  if (setting && typeof setting.value === "boolean") return setting.value;
  return process.env.ALLOW_NEGATIVE_STOCK === "true";
}

/** Stock on hand for one item in one warehouse (0 if it has never been stocked there). */
export async function getWarehouseStock(tx: Tx, itemId: string, warehouseId: string): Promise<Prisma.Decimal> {
  const row = await tx.itemWarehouseStock.findUnique({ where: { itemId_warehouseId: { itemId, warehouseId } } });
  return new Prisma.Decimal(row?.quantity ?? 0);
}

/**
 * Applies a single stock movement atomically: locks the item row, validates the
 * resulting balance in the movement's warehouse, updates that warehouse's
 * ItemWarehouseStock row and the Item.currentStock total, and writes the
 * InventoryLedger record (whose before/after quantities are the warehouse balance).
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
  const locked = await tx.$queryRaw<{ currentStock: Prisma.Decimal; name: string; sku: string }[]>`
    SELECT "currentStock", "name", "sku" FROM "Item" WHERE id = ${params.itemId} FOR UPDATE
  `;
  if (locked.length === 0) {
    throw new Error("Item not found.");
  }
  const totalBefore = new Prisma.Decimal(locked[0].currentStock);

  // The item lock above serializes movements, so this balance can't change underneath us.
  const balance = await tx.itemWarehouseStock.findUnique({
    where: { itemId_warehouseId: { itemId: params.itemId, warehouseId: params.warehouseId } },
  });
  const beforeQty = new Prisma.Decimal(balance?.quantity ?? 0);

  const increasing = INCREASING_TYPES.includes(params.transactionType);
  const afterQty = increasing ? beforeQty.plus(quantity) : beforeQty.minus(quantity);
  const totalAfter = increasing ? totalBefore.plus(quantity) : totalBefore.minus(quantity);

  if (!increasing && afterQty.lt(0)) {
    const allowNegative = await isNegativeStockAllowed(tx);
    if (!allowNegative) {
      throw new InsufficientStockError(`"${locked[0].name}" (${locked[0].sku}) in this warehouse`, beforeQty, quantity);
    }
  }

  await tx.itemWarehouseStock.upsert({
    where: { itemId_warehouseId: { itemId: params.itemId, warehouseId: params.warehouseId } },
    create: { itemId: params.itemId, warehouseId: params.warehouseId, quantity: afterQty },
    update: { quantity: afterQty },
  });

  await tx.item.update({
    where: { id: params.itemId },
    data: { currentStock: totalAfter },
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
