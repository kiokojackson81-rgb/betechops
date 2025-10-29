-- Ensure Postgres enum "Platform" exists with required values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t WHERE t.typname = 'Platform'
  ) THEN
    CREATE TYPE "Platform" AS ENUM ('JUMIA', 'KILIMALL');
  END IF;
END$$;

-- Ensure enum contains both values (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'Platform' AND e.enumlabel = 'JUMIA'
  ) THEN
    ALTER TYPE "Platform" ADD VALUE 'JUMIA';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'Platform' AND e.enumlabel = 'KILIMALL'
  ) THEN
    ALTER TYPE "Platform" ADD VALUE 'KILIMALL';
  END IF;
END$$;

-- Cast Shop.platform from text to enum safely
ALTER TABLE "Shop" ALTER COLUMN "platform" DROP DEFAULT;
ALTER TABLE "Shop"
  ALTER COLUMN "platform" TYPE "Platform"
  USING (
    CASE
      WHEN "platform" IN ('JUMIA','KILIMALL') THEN "platform"::"Platform"
      ELSE 'JUMIA'::"Platform"
    END
  );
ALTER TABLE "Shop" ALTER COLUMN "platform" SET DEFAULT 'JUMIA'::"Platform";

-- Optional: tighten nullability if desired (schema already defines non-null)
-- ALTER TABLE "Shop" ALTER COLUMN "platform" SET NOT NULL;
