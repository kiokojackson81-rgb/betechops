-- Migration: fix legacy AttendantCategory enum values to match Prisma schema
-- To apply:
--   1) Backup your production database (pg_dump or Neon snapshot).
--   2) Merge this migration into main and push to remote.
--   3) On deploy / CI run: `npx prisma migrate deploy` (ensure `DATABASE_URL` is set).
--
-- This migration converts legacy enum values (GENERAL, DIRECT_SALES, PRODUCT_UPLOAD,
-- JUMIA_OPERATIONS, KILIMALL_OPERATIONS, SUPPORT) to the new names expected by
-- the Prisma schema and application code.
-- Mapping (applied exactly):
--   GENERAL                 -> BETECH_OPS
--   DIRECT_SALES            -> DIRECT_SALES_OPS
--   PRODUCT_UPLOAD          -> MARKETING_OPS
--   JUMIA_OPERATIONS        -> JUMIA_KILIMALL_OPS
--   KILIMALL_OPERATIONS     -> JUMIA_KILIMALL_OPS
--   SUPPORT                 -> SUPPORT_OPS

BEGIN;
-- 1) create new enum type with desired labels
CREATE TYPE "AttendantCategory_new" AS ENUM (
  'DIRECT_SALES_OPS',
  'MARKETING_OPS',
  'JUMIA_KILIMALL_OPS',
  'SUPPORT_OPS',
  'BETECH_OPS'
);

-- 2) User.attendantCategory
ALTER TABLE "User"
  ALTER COLUMN "attendantCategory" DROP DEFAULT,
  ALTER COLUMN "attendantCategory" TYPE text USING "attendantCategory"::text;

UPDATE "User"
SET "attendantCategory" =
  CASE "attendantCategory"
    WHEN 'GENERAL'            THEN 'BETECH_OPS'
    WHEN 'DIRECT_SALES'       THEN 'DIRECT_SALES_OPS'
    WHEN 'PRODUCT_UPLOAD'     THEN 'MARKETING_OPS'
    WHEN 'JUMIA_OPERATIONS'   THEN 'JUMIA_KILIMALL_OPS'
    WHEN 'KILIMALL_OPERATIONS' THEN 'JUMIA_KILIMALL_OPS'
    WHEN 'SUPPORT'            THEN 'SUPPORT_OPS'
    ELSE 'BETECH_OPS'
  END;

ALTER TABLE "User"
  ALTER COLUMN "attendantCategory" TYPE "AttendantCategory_new"
  USING "attendantCategory"::text::"AttendantCategory_new";

-- 3) AttendantActivity.category
ALTER TABLE "AttendantActivity"
  ALTER COLUMN "category" TYPE text USING "category"::text;

UPDATE "AttendantActivity"
SET "category" =
  CASE "category"
    WHEN 'GENERAL'            THEN 'BETECH_OPS'
    WHEN 'DIRECT_SALES'       THEN 'DIRECT_SALES_OPS'
    WHEN 'PRODUCT_UPLOAD'     THEN 'MARKETING_OPS'
    WHEN 'JUMIA_OPERATIONS'   THEN 'JUMIA_KILIMALL_OPS'
    WHEN 'KILIMALL_OPERATIONS' THEN 'JUMIA_KILIMALL_OPS'
    WHEN 'SUPPORT'            THEN 'SUPPORT_OPS'
    ELSE 'BETECH_OPS'
  END;

ALTER TABLE "AttendantActivity"
  ALTER COLUMN "category" TYPE "AttendantCategory_new"
  USING "category"::text::"AttendantCategory_new";

-- 4) AttendantCategoryAssignment.category (if present)
ALTER TABLE "AttendantCategoryAssignment"
  ALTER COLUMN "category" TYPE text USING "category"::text;

UPDATE "AttendantCategoryAssignment"
SET "category" =
  CASE "category"
    WHEN 'GENERAL'            THEN 'BETECH_OPS'
    WHEN 'DIRECT_SALES'       THEN 'DIRECT_SALES_OPS'
    WHEN 'PRODUCT_UPLOAD'     THEN 'MARKETING_OPS'
    WHEN 'JUMIA_OPERATIONS'   THEN 'JUMIA_KILIMALL_OPS'
    WHEN 'KILIMALL_OPERATIONS' THEN 'JUMIA_KILIMALL_OPS'
    WHEN 'SUPPORT'            THEN 'SUPPORT_OPS'
    ELSE 'BETECH_OPS'
  END;

ALTER TABLE "AttendantCategoryAssignment"
  ALTER COLUMN "category" TYPE "AttendantCategory_new"
  USING "category"::text::"AttendantCategory_new";

-- 5) drop old enum type and rename new to original name
DROP TYPE IF EXISTS "AttendantCategory";
ALTER TYPE "AttendantCategory_new" RENAME TO "AttendantCategory";

COMMIT;
