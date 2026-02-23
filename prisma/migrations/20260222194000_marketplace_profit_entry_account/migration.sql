-- Add accountId FK to profit entries and make txn unique per account.

ALTER TABLE "MarketplaceProfitEntry"
ADD COLUMN "accountId" TEXT;

-- Remove old unique index on itemCreditTxn and replace with composite unique.
DROP INDEX IF EXISTS "MarketplaceProfitEntry_itemCreditTxn_key";

CREATE UNIQUE INDEX "MarketplaceProfitEntry_accountId_itemCreditTxn_key"
ON "MarketplaceProfitEntry"("accountId", "itemCreditTxn");

CREATE INDEX "MarketplaceProfitEntry_accountId_date_idx"
ON "MarketplaceProfitEntry"("accountId", "date");

ALTER TABLE "MarketplaceProfitEntry"
ADD CONSTRAINT "MarketplaceProfitEntry_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "MarketplaceAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
