-- AlterTable
ALTER TABLE "StockInwardItem" ADD COLUMN     "poItemId" TEXT;

-- CreateIndex
CREATE INDEX "StockInwardItem_poItemId_idx" ON "StockInwardItem"("poItemId");

-- AddForeignKey
ALTER TABLE "StockInwardItem" ADD CONSTRAINT "StockInwardItem_poItemId_fkey" FOREIGN KEY ("poItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
