import { Prisma, POStatus } from "@prisma/client";

/**
 * Call from inside the Stock Inward transaction whenever an inward with
 * purchaseOrderId set moves to RECEIVED. For every inward item that carries a
 * poItemId, increments that PurchaseOrderItem.receivedQuantity, then
 * recomputes and persists the parent PO's status (APPROVED -> PARTIALLY_RECEIVED
 * -> RECEIVED) based on received vs ordered quantity across all its items.
 *
 * Never decrements receivedQuantity — cancelling/reversing an inward is a
 * separate, explicit business action, not an automatic side effect here.
 */
export async function applyReceiptToPurchaseOrder(
  tx: Prisma.TransactionClient,
  params: { poId: string; receipts: { poItemId: string; quantity: Prisma.Decimal | number }[] },
) {
  if (params.receipts.length === 0) return;

  for (const receipt of params.receipts) {
    await tx.purchaseOrderItem.update({
      where: { id: receipt.poItemId },
      data: { receivedQuantity: { increment: new Prisma.Decimal(receipt.quantity) } },
    });
  }

  const po = await tx.purchaseOrder.findUniqueOrThrow({
    where: { id: params.poId },
    include: { items: true },
  });

  if (po.status !== POStatus.APPROVED && po.status !== POStatus.PARTIALLY_RECEIVED) {
    // PO isn't in a receivable state (e.g. still draft/pending) — leave status alone.
    return;
  }

  const fullyReceived = po.items.every((item) =>
    new Prisma.Decimal(item.receivedQuantity).gte(new Prisma.Decimal(item.quantity)),
  );
  const anyReceived = po.items.some((item) => new Prisma.Decimal(item.receivedQuantity).gt(0));

  const nextStatus = fullyReceived
    ? POStatus.RECEIVED
    : anyReceived
      ? POStatus.PARTIALLY_RECEIVED
      : po.status;

  if (nextStatus !== po.status) {
    await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: nextStatus } });
  }
}
