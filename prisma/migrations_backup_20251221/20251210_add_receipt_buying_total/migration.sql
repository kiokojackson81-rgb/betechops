-- Add receipt-level buying totals for marketing and support receipts
ALTER TABLE "MarketingReceipt"
ADD COLUMN "buyingTotal" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "SupportReceipt"
ADD COLUMN "buyingTotal" INTEGER NOT NULL DEFAULT 0;
