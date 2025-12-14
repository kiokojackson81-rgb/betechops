-- Add unique constraint for commission ledger per period
CREATE UNIQUE INDEX IF NOT EXISTS "CommissionLedger_userId_periodStart_periodEnd_key"
ON "CommissionLedger"("userId", "periodStart", "periodEnd");
