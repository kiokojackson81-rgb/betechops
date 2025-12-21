-- Ensure the DailyReport.submittedBy column exists for backfill scripts.
ALTER TABLE "DailyReport"
ADD COLUMN IF NOT EXISTS "submittedBy" TEXT;
