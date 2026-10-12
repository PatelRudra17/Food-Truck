-- Per-warehouse stock balances.

-- CreateTable
CREATE TABLE "ItemWarehouseStock" (
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemWarehouseStock_pkey" PRIMARY KEY ("itemId","warehouseId")
);

-- CreateIndex
CREATE INDEX "ItemWarehouseStock_warehouseId_idx" ON "ItemWarehouseStock"("warehouseId");

-- AddForeignKey
ALTER TABLE "ItemWarehouseStock" ADD CONSTRAINT "ItemWarehouseStock_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemWarehouseStock" ADD CONSTRAINT "ItemWarehouseStock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: every movement already records its warehouse in the ledger, so each
-- balance is the sum of that item's movements in that warehouse.
INSERT INTO "ItemWarehouseStock" ("itemId", "warehouseId", "quantity", "updatedAt")
SELECT "itemId", "warehouseId",
       SUM(CASE WHEN "transactionType" IN ('OPENING', 'INWARD', 'TRANSFER_IN', 'ADJUSTMENT_POSITIVE')
                THEN "quantity" ELSE -"quantity" END),
       CURRENT_TIMESTAMP
FROM "InventoryLedger"
GROUP BY "itemId", "warehouseId";

-- Any stock not explained by the ledger (none in the current data) is placed in
-- the item's home warehouse, so the per-warehouse rows always sum to Item.currentStock.
INSERT INTO "ItemWarehouseStock" ("itemId", "warehouseId", "quantity", "updatedAt")
SELECT i."id", i."warehouseId", i."currentStock" - COALESCE(s.total, 0), CURRENT_TIMESTAMP
FROM "Item" i
LEFT JOIN (SELECT "itemId", SUM("quantity") AS total FROM "ItemWarehouseStock" GROUP BY "itemId") s ON s."itemId" = i."id"
WHERE i."currentStock" <> COALESCE(s.total, 0) AND i."warehouseId" IS NOT NULL
ON CONFLICT ("itemId", "warehouseId") DO UPDATE SET "quantity" = "ItemWarehouseStock"."quantity" + EXCLUDED."quantity";
