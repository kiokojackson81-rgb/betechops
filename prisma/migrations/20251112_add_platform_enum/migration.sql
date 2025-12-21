-- Ensure Postgres enum type for Shop.platform matches Prisma schema

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'Platform'
  ) THEN
    CREATE TYPE "Platform" AS ENUM ('JUMIA', 'KILIMALL');
  END IF;
END
$$;

ALTER TABLE "Shop" ALTER COLUMN "platform" DROP DEFAULT;

ALTER TABLE "Shop"
  ALTER COLUMN "platform"
  TYPE "Platform"
  USING CASE
    WHEN "platform" IN ('JUMIA', 'KILIMALL') THEN "platform"::"Platform"
    ELSE 'JUMIA'::"Platform"
  END;

ALTER TABLE "Shop" ALTER COLUMN "platform" SET DEFAULT 'JUMIA';
