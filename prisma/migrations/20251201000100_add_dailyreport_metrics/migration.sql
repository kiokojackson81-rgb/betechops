-- Migration: add_dailyreport_metrics
BEGIN;

ALTER TABLE "DailyReport"
  ADD COLUMN IF NOT EXISTS "newProducts" integer DEFAULT 0;

ALTER TABLE "DailyReport"
  ADD COLUMN IF NOT EXISTS "productsEdited" integer DEFAULT 0;

ALTER TABLE "DailyReport"
  ADD COLUMN IF NOT EXISTS "copiesUploaded" integer DEFAULT 0;

ALTER TABLE "DailyReport"
  ADD COLUMN IF NOT EXISTS "walkInServed" integer DEFAULT 0;

ALTER TABLE "DailyReport"
  ADD COLUMN IF NOT EXISTS "purchasesMade" integer DEFAULT 0;

ALTER TABLE "DailyReport"
  ADD COLUMN IF NOT EXISTS "liveSessionsCount" integer DEFAULT 0;

ALTER TABLE "DailyReport"
  ADD COLUMN IF NOT EXISTS "commissionEarned" numeric(12,2);

ALTER TABLE "DailyReport"
  ADD COLUMN IF NOT EXISTS "confirmedCompetitiveness" boolean DEFAULT false;

ALTER TABLE "DailyReport"
  ADD COLUMN IF NOT EXISTS "marketEngagement" jsonb;

ALTER TABLE "DailyReport"
  ADD COLUMN IF NOT EXISTS "concerns" text;

COMMIT;
