-- No-op migration: receiptKey and unique indexes were applied directly via a safe SQL script.
-- This placeholder ensures the migration history contains this step without altering the database.

-- Already applied SQL (for reference):
-- ALTER TABLE "MarketingReceipt" ADD COLUMN IF NOT EXISTS "receiptKey" text;
-- ALTER TABLE "SupportReceipt" ADD COLUMN IF NOT EXISTS "receiptKey" text;
-- CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uniq_marketing_receipt_receiptkey ON "MarketingReceipt" ("receiptKey");
-- CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uniq_support_receipt_receiptkey ON "SupportReceipt" ("receiptKey");
-- CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uniq_marketing_receipt_in_entry ON "MarketingReceipt" ("dailyEntryId","receiptNumber","paymentMethod");
-- CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uniq_support_receipt_in_entry ON "SupportReceipt" ("dailyEntryId","receiptNumber","paymentMethod");

-- No further SQL to execute.
