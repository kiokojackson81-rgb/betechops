-- CreateTable
CREATE TABLE "MarketplaceProfitEntry" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "date" TIMESTAMPTZ(3) NOT NULL,
    "weekStart" TIMESTAMPTZ(0) NOT NULL,
    "weekEnd" TIMESTAMPTZ(3) NOT NULL,
    "periodKey" TEXT NOT NULL,
    "itemCreditTxn" TEXT NOT NULL,
    "itemCreditAmount" NUMERIC(12,2) NOT NULL,
    "commissionTxn" TEXT,
    "commissionAmount" NUMERIC(12,2) NOT NULL,
    "shippingTxn" TEXT,
    "shippingAmount" NUMERIC(12,2) NOT NULL,
    "netPayout" NUMERIC(12,2) NOT NULL,
    "buyingPrice" NUMERIC(12,2) NOT NULL,
    "profit" NUMERIC(12,2) NOT NULL,
    "marginPct" NUMERIC(8,2) NOT NULL,
    "commissionRatePct" NUMERIC(8,2) NOT NULL,
    "orderId" TEXT,
    "sku" TEXT,
    "productName" TEXT,
    "rawText" TEXT NOT NULL,
    "enteredByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceProfitEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceProfitEntry_itemCreditTxn_key" ON "MarketplaceProfitEntry"("itemCreditTxn");

-- CreateIndex
CREATE INDEX "MarketplaceProfitEntry_platform_date_idx" ON "MarketplaceProfitEntry"("platform", "date");

-- CreateIndex
CREATE INDEX "MarketplaceProfitEntry_weekStart_weekEnd_idx" ON "MarketplaceProfitEntry"("weekStart", "weekEnd");

-- CreateIndex
CREATE INDEX "MarketplaceProfitEntry_periodKey_idx" ON "MarketplaceProfitEntry"("periodKey");

-- CreateIndex
CREATE INDEX "MarketplaceProfitEntry_enteredByAdminId_createdAt_idx" ON "MarketplaceProfitEntry"("enteredByAdminId", "createdAt");

-- AddForeignKey
ALTER TABLE "MarketplaceProfitEntry" ADD CONSTRAINT "MarketplaceProfitEntry_enteredByAdminId_fkey" FOREIGN KEY ("enteredByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

