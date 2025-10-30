-- Create betechops_ops.Platform enum if missing and cast Shop.platform to use it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'Platform' AND n.nspname = 'betechops_ops'
  ) THEN
    -- Ensure schema exists
    PERFORM 1 FROM pg_namespace WHERE nspname = 'betechops_ops';
    IF NOT FOUND THEN
      EXECUTE 'CREATE SCHEMA betechops_ops';
    END IF;
    EXECUTE 'CREATE TYPE "betechops_ops"."Platform" AS ENUM (''JUMIA'',''KILIMALL'')';
  END IF;
END $$;

-- Make Shop.platform use the enum type
ALTER TABLE "Shop"
  ALTER COLUMN "platform" TYPE "betechops_ops"."Platform"
  USING ("platform"::text::"betechops_ops"."Platform");
