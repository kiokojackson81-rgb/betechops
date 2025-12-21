-- Add MarketingReceipt and MarketingReceiptItem for marketing tracker receipts
CREATE TABLE IF NOT EXISTS "MarketingReceipt" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "dailyEntryId" TEXT NOT NULL,
  "receiptNumber" TEXT,
  "sellingTotal" INTEGER NOT NULL,
  "paymentMethod" "PaymentMethod" NOT NULL,
  CONSTRAINT "MarketingReceipt_dailyEntryId_fkey" FOREIGN KEY ("dailyEntryId") REFERENCES "MarketingDailyEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "MarketingReceipt_dailyEntryId_idx" ON "MarketingReceipt"("dailyEntryId");

CREATE TABLE IF NOT EXISTS "MarketingReceiptItem" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "receiptId" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "buyingPrice" INTEGER NOT NULL,
  CONSTRAINT "MarketingReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "MarketingReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "MarketingReceiptItem_receiptId_idx" ON "MarketingReceiptItem"("receiptId");
