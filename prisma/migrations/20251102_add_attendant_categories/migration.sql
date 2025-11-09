-- Attendant category enum and activity log

BEGIN;

CREATE TYPE "AttendantCategory" AS ENUM (
  'GENERAL',
  'DIRECT_SALES',
  'JUMIA_OPERATIONS',
  'KILIMALL_OPERATIONS',
  'PRODUCT_UPLOAD',
  'SUPPORT'
);

ALTER TABLE "User"
  ADD COLUMN "attendantCategory" "AttendantCategory" NOT NULL DEFAULT 'GENERAL';

CREATE TABLE "AttendantActivity" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "category" "AttendantCategory" NOT NULL,
  "metric" TEXT NOT NULL,
  "numericValue" DECIMAL(18, 2),
  "intValue" INTEGER,
  "notes" TEXT,
  "entryDate" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "AttendantActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AttendantActivity_userId_entryDate_idx" ON "AttendantActivity" ("userId", "entryDate");
CREATE INDEX "AttendantActivity_category_metric_entryDate_idx" ON "AttendantActivity" ("category", "metric", "entryDate");

ALTER TABLE "AttendantActivity"
  ADD CONSTRAINT "AttendantActivity_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
