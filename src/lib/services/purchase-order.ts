import { Prisma, POStatus } from "@prisma/client";

/**
 * Call from inside the Stock Inward transaction whenever an inward with
 * purchaseOrderId set moves to RECEIVED. For every inward item that carries a
 * poItemId, increments that PurchaseOrderItem.receivedQuantity, then
 * recomputes and persists the parent PO's status (APPROVED -> PARTIALLY_RECEIVED
 * -> RECEIVED) based on received vs ordered quantity across all its items.
 *
 * Throws (rolling back the caller's transaction) if the PO is not open for
 * receiving (APPROVED / PARTIALLY_RECEIVED), if a receipt references a line
 * that isn't on this PO, or if a receipt would push a line past its ordered
 * quantity.
 *
 * Never decrements receivedQuantity — cancelling/reversing an inward is a
 * separate, explicit business action, not an automatic side effect here.
 */
export async function applyReceiptToPurchaseOrder(
  tx: Prisma.TransactionClient,
  params: { poId: string; receipts: { poItemId: string; quantity: Prisma.Decimal | number }[] },
) {
  if (params.receipts.length === 0) return;

  const po = await tx.purchaseOrder.findUniqueOrThrow({
    where: { id: params.poId },
    include: { items: { include: { item: { select: { name: true } } } } },
  });

  if (po.status !== POStatus.APPROVED && po.status !== POStatus.PARTIALLY_RECEIVED) {
    throw new Error(
      `Purchase order ${po.poNumber} is ${po.status.toLowerCase().replace(/_/g, " ")} and cannot be received against.`,
    );
  }

  // Aggregate per line first so two receipts against the same line can't jointly over-receive.
  const itemsById = new Map(po.items.map((item) => [item.id, item]));
  const incomingByLine = new Map<string, Prisma.Decimal>();
  for (const receipt of params.receipts) {
    if (!itemsById.has(receipt.poItemId)) {
      throw new Error(`A received line does not belong to purchase order ${po.poNumber}.`);
    }
    const prev = incomingByLine.get(receipt.poItemId) ?? new Prisma.Decimal(0);
    incomingByLine.set(receipt.poItemId, prev.plus(new Prisma.Decimal(receipt.quantity)));
  }
  for (const [lineId, incoming] of incomingByLine) {
    const line = itemsById.get(lineId)!;
    const remaining = new Prisma.Decimal(line.quantity).minus(line.receivedQuantity);
    if (incoming.gt(remaining)) {
      throw new Error(
        `Cannot receive ${incoming.toString()} of "${line.item.name}" against ${po.poNumber}: only ${Prisma.Decimal.max(remaining, 0).toString()} remains to be received.`,
      );
    }
  }

  for (const [lineId, incoming] of incomingByLine) {
    await tx.purchaseOrderItem.update({
      where: { id: lineId },
      data: { receivedQuantity: { increment: incoming } },
    });
  }

  const receivedAfter = (item: (typeof po.items)[number]) =>
    new Prisma.Decimal(item.receivedQuantity).plus(incomingByLine.get(item.id) ?? 0);

  const fullyReceived = po.items.every((item) => receivedAfter(item).gte(new Prisma.Decimal(item.quantity)));
  const anyReceived = po.items.some((item) => receivedAfter(item).gt(0));

  const nextStatus = fullyReceived
    ? POStatus.RECEIVED
    : anyReceived
      ? POStatus.PARTIALLY_RECEIVED
      : po.status;

  if (nextStatus !== po.status) {
    await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: nextStatus } });
  }
}
