-- Create link between MarketingSale and DailySale
ALTER TABLE "MarketingSale" ADD COLUMN "dailySaleId" TEXT;
ALTER TABLE "MarketingSale"
  ADD CONSTRAINT "MarketingSale_dailySaleId_fkey"
  FOREIGN KEY ("dailySaleId") REFERENCES "DailySale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "MarketingSale_dailySaleId_idx" ON "MarketingSale"("dailySaleId");
