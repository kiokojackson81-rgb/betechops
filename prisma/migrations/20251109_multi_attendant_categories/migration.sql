-- Migration: support multiple attendant categories per user

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

BEGIN;

CREATE TABLE IF NOT EXISTS "AttendantCategoryAssignment" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "category" "AttendantCategory" NOT NULL,
  "assignedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "AttendantCategoryAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "AttendantCategoryAssignment_userId_category_key"
  ON "AttendantCategoryAssignment" ("userId", "category");

CREATE INDEX IF NOT EXISTS "AttendantCategoryAssignment_category_idx"
  ON "AttendantCategoryAssignment" ("category");

-- Seed existing users with their primary category
INSERT INTO "AttendantCategoryAssignment" ("id", "userId", "category")
SELECT
  replace(gen_random_uuid()::text, '-', '') as id,
  u."id",
  u."attendantCategory"
FROM "User" u
WHERE NOT EXISTS (
  SELECT 1 FROM "AttendantCategoryAssignment" aca
  WHERE aca."userId" = u."id" AND aca."category" = u."attendantCategory"
);

COMMIT;

