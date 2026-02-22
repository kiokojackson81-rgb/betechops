ALTER TABLE "MarketplaceProfitEntry"
ADD COLUMN "isLoss" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "MarketplaceProfitEntry_isLoss_idx" ON "MarketplaceProfitEntry"("isLoss");

