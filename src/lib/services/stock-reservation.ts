import "server-only";
import { OutwardStatus, Prisma } from "@prisma/client";
import { getWarehouseStock, isNegativeStockAllowed } from "@/lib/services/inventory";
import { reservationShortfallMessage, sumQtyByItem } from "@/lib/services/stock-reservation-utils";

/** Outwards that hold a claim on stock: requested or approved, but not yet issued. */
export const RESERVING_OUTWARD_STATUSES: OutwardStatus[] = [OutwardStatus.PENDING_APPROVAL, OutwardStatus.APPROVED];

/**
 * Throws unless every item's requested quantity fits in the warehouse balance minus the
 * quantities other pending/approved outwards already requested for the same item and
 * warehouse. Item rows are locked first, so two approvals racing for the same stock
 * serialize instead of both passing. Skipped when negative stock is allowed.
 */
export async function assertOutwardQtyAvailable(
  tx: Prisma.TransactionClient,
  params: {
    warehouseId: string;
    lines: readonly { itemId: string; quantity: Prisma.Decimal | number | string }[];
    /** The outward being checked, so its own lines aren't counted as reserved. */
    excludeOutwardId?: string;
  },
): Promise<void> {
  if (await isNegativeStockAllowed(tx)) return;

  const totals = sumQtyByItem(params.lines);
  const itemIds = [...totals.keys()].sort();
  if (itemIds.length === 0) return;

  const locked = await tx.$queryRaw<{ id: string; name: string; sku: string }[]>`
    SELECT id, name, sku FROM "Item" WHERE id IN (${Prisma.join(itemIds)}) ORDER BY id FOR UPDATE
  `;
  const itemMap = new Map(locked.map((item) => [item.id, item]));

  const reservedRows = await tx.stockOutwardItem.groupBy({
    by: ["itemId"],
    where: {
      itemId: { in: itemIds },
      outward: {
        warehouseId: params.warehouseId,
        status: { in: RESERVING_OUTWARD_STATUSES },
        ...(params.excludeOutwardId ? { id: { not: params.excludeOutwardId } } : {}),
      },
    },
    _sum: { requestedQty: true },
  });
  const reservedByItem = new Map(reservedRows.map((row) => [row.itemId, row._sum.requestedQty ?? new Prisma.Decimal(0)]));

  for (const itemId of itemIds) {
    const item = itemMap.get(itemId);
    if (!item) throw new Error("One of the selected items no longer exists.");
    const message = reservationShortfallMessage({
      itemLabel: `"${item.name}" (${item.sku})`,
      requested: totals.get(itemId)!,
      balance: await getWarehouseStock(tx, itemId, params.warehouseId),
      reserved: reservedByItem.get(itemId) ?? 0,
    });
    if (message) throw new Error(message);
  }
}
