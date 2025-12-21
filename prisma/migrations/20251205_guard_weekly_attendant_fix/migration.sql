-- Migration: guard-weekly-and-attendant-fix
-- Purpose: Add guarded ALTERs for marketing tables and safe enum conversion

-- 1) Guarded alterations for MarketingReceipt
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'MarketingReceipt'
  ) THEN
    ALTER TABLE "MarketingReceipt"
      ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
      ALTER COLUMN "updatedAt" DROP DEFAULT,
      ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);
  END IF;
END $$;

-- 2) Guarded alterations for MarketingReceiptItem
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'MarketingReceiptItem'
  ) THEN
    ALTER TABLE "MarketingReceiptItem"
      ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
      ALTER COLUMN "updatedAt" DROP DEFAULT,
      ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);
  END IF;
END $$;

-- 3) Guarded alteration for MarketingSale.itemsCount
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'MarketingSale'
      AND column_name = 'itemsCount'
  ) THEN
    ALTER TABLE "MarketingSale" ALTER COLUMN "itemsCount" SET NOT NULL;
  END IF;
END $$;

-- 4) Safe enum conversion for AttendantCategory (create new type if needed,
--    drop defaults then cast to text and to the new enum)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'attendantcategory_new'
  ) THEN
    CREATE TYPE "AttendantCategory_new" AS ENUM (
      'junior', 'senior', 'assistant', 'manager'
    );
  END IF;
END $$;

-- User.attendantCategory
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'User'
      AND column_name = 'attendantCategory'
  ) THEN
    ALTER TABLE "User"
      ALTER COLUMN "attendantCategory" DROP DEFAULT,
      ALTER COLUMN "attendantCategory" TYPE text USING "attendantCategory"::text;

    -- Map legacy values to new labels where needed; adjust CASE mapping if required
    UPDATE "User"
    SET "attendantCategory" = CASE
      WHEN "attendantCategory"::text = 'ATTENDANT' THEN 'junior'
      WHEN "attendantCategory"::text = 'SENIOR_ATTENDANT' THEN 'senior'
      ELSE "attendantCategory"::text
    END
    WHERE "attendantCategory" IS NOT NULL;

    ALTER TABLE "User"
      ALTER COLUMN "attendantCategory" TYPE "AttendantCategory_new" USING "attendantCategory"::text::"AttendantCategory_new";
  END IF;
END $$;

-- AttendantActivity.category
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'AttendantActivity'
      AND column_name = 'category'
  ) THEN
    ALTER TABLE "AttendantActivity"
      ALTER COLUMN "category" DROP DEFAULT,
      ALTER COLUMN "category" TYPE text USING "category"::text;

    UPDATE "AttendantActivity"
    SET "category" = CASE
      WHEN "category"::text = 'ATTENDANT' THEN 'junior'
      WHEN "category"::text = 'SENIOR_ATTENDANT' THEN 'senior'
      ELSE "category"::text
    END
    WHERE "category" IS NOT NULL;

    ALTER TABLE "AttendantActivity"
      ALTER COLUMN "category" TYPE "AttendantCategory_new" USING "category"::text::"AttendantCategory_new";
  END IF;
END $$;

-- AttendantCategoryAssignment.category (if present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'AttendantCategoryAssignment'
      AND column_name = 'category'
  ) THEN
    ALTER TABLE "AttendantCategoryAssignment"
      ALTER COLUMN "category" DROP DEFAULT,
      ALTER COLUMN "category" TYPE text USING "category"::text;

    UPDATE "AttendantCategoryAssignment"
    SET "category" = CASE
      WHEN "category"::text = 'ATTENDANT' THEN 'junior'
      WHEN "category"::text = 'SENIOR_ATTENDANT' THEN 'senior'
      ELSE "category"::text
    END
    WHERE "category" IS NOT NULL;

    ALTER TABLE "AttendantCategoryAssignment"
      ALTER COLUMN "category" TYPE "AttendantCategory_new" USING "category"::text::"AttendantCategory_new";
  END IF;
END $$;

-- If you later want to drop the old enum and rename the new one, do that in a controlled follow-up migration.
