import { Prisma } from "@prisma/client";

type Qty = Prisma.Decimal | number | string;

/** Adds up requested quantities per item (an outward may list the same item on several lines). */
export function sumQtyByItem(lines: readonly { itemId: string; quantity: Qty }[]): Map<string, Prisma.Decimal> {
  const totals = new Map<string, Prisma.Decimal>();
  for (const line of lines) {
    totals.set(line.itemId, (totals.get(line.itemId) ?? new Prisma.Decimal(0)).plus(line.quantity));
  }
  return totals;
}

/**
 * Stock still free to promise in a warehouse: the balance on hand minus what other
 * outwards (pending approval or approved but not yet issued) have already requested.
 */
export function freeStock(balance: Qty, reserved: Qty): Prisma.Decimal {
  return new Prisma.Decimal(balance).minus(reserved);
}

/** Null when the request fits in the free stock, otherwise the user-facing reason it doesn't. */
export function reservationShortfallMessage(params: {
  itemLabel: string;
  requested: Qty;
  balance: Qty;
  reserved: Qty;
}): string | null {
  const requested = new Prisma.Decimal(params.requested);
  const reserved = new Prisma.Decimal(params.reserved);
  const free = freeStock(params.balance, reserved);
  if (requested.lte(free)) return null;
  const freeLabel = Prisma.Decimal.max(free, 0).toString();
  return reserved.gt(0)
    ? `Requested quantity for ${params.itemLabel} (${requested.toString()}) exceeds available stock (${freeLabel}): ${new Prisma.Decimal(params.balance).toString()} in stock, ${reserved.toString()} already reserved by other pending or approved outwards.`
    : `Requested quantity for ${params.itemLabel} (${requested.toString()}) exceeds available stock (${freeLabel}).`;
}
