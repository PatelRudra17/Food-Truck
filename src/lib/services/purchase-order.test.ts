import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { applyReceiptToPurchaseOrder } from "@/lib/services/purchase-order";

type Line = { id: string; quantity: number; receivedQuantity: number; item: { name: string } };

/** Minimal in-memory stand-in for the two Prisma delegates the service touches. */
function fakeTx(po: { id: string; poNumber: string; status: string; items: Line[] }) {
  const updates: { lines: Record<string, Prisma.Decimal>; status?: string } = { lines: {} };
  const tx = {
    purchaseOrder: {
      findUniqueOrThrow: async () => po,
      update: async ({ data }: { data: { status: string } }) => {
        updates.status = data.status;
      },
    },
    purchaseOrderItem: {
      update: async ({ where, data }: { where: { id: string }; data: { receivedQuantity: { increment: Prisma.Decimal } } }) => {
        updates.lines[where.id] = data.receivedQuantity.increment;
      },
    },
  } as unknown as Prisma.TransactionClient;
  return { tx, updates };
}

const basePo = (status: string, items: Line[]) => ({ id: "po1", poNumber: "PO-1", status, items });
const line = (id: string, quantity: number, receivedQuantity = 0): Line => ({
  id,
  quantity,
  receivedQuantity,
  item: { name: id },
});

describe("applyReceiptToPurchaseOrder", () => {
  it("refuses a cancelled PO", async () => {
    const { tx } = fakeTx(basePo("CANCELLED", [line("a", 10)]));
    await expect(applyReceiptToPurchaseOrder(tx, { poId: "po1", receipts: [{ poItemId: "a", quantity: 1 }] })).rejects.toThrow(
      /cannot be received against/,
    );
  });

  it("refuses receiving more than the remaining quantity (aggregated per line)", async () => {
    const { tx, updates } = fakeTx(basePo("PARTIALLY_RECEIVED", [line("a", 10, 6)]));
    await expect(
      applyReceiptToPurchaseOrder(tx, {
        poId: "po1",
        receipts: [
          { poItemId: "a", quantity: 3 },
          { poItemId: "a", quantity: 2 },
        ],
      }),
    ).rejects.toThrow(/only 4 remains/);
    expect(updates.lines).toEqual({});
  });

  it("refuses a line that is not on the PO", async () => {
    const { tx } = fakeTx(basePo("APPROVED", [line("a", 10)]));
    await expect(applyReceiptToPurchaseOrder(tx, { poId: "po1", receipts: [{ poItemId: "zzz", quantity: 1 }] })).rejects.toThrow(
      /does not belong/,
    );
  });

  it("moves APPROVED -> PARTIALLY_RECEIVED -> RECEIVED", async () => {
    const partial = fakeTx(basePo("APPROVED", [line("a", 10), line("b", 5)]));
    await applyReceiptToPurchaseOrder(partial.tx, { poId: "po1", receipts: [{ poItemId: "a", quantity: 10 }] });
    expect(partial.updates.status).toBe("PARTIALLY_RECEIVED");

    const full = fakeTx(basePo("PARTIALLY_RECEIVED", [line("a", 10, 10), line("b", 5, 2)]));
    await applyReceiptToPurchaseOrder(full.tx, { poId: "po1", receipts: [{ poItemId: "b", quantity: 3 }] });
    expect(full.updates.status).toBe("RECEIVED");
    expect(full.updates.lines.b.toString()).toBe("3");
  });
});
