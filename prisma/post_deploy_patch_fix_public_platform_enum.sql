-- Reconcile Platform enum to match Prisma expectations (public."Platform")
-- Safe and idempotent: can be run multiple times.

-- 1) Ensure public."Platform" enum exists with expected values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'Platform'
  ) THEN
    EXECUTE 'CREATE TYPE "public"."Platform" AS ENUM (''JUMIA'', ''KILIMALL'')';
  END IF;
END $$;

-- 2) If Shop.platform exists and is NOT already public."Platform", migrate it
DO $$
DECLARE
  col_type_schema text;
  col_type_name text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Shop' AND column_name = 'platform'
  ) THEN
    -- Determine current underlying type (schema + type name if enum)
    SELECT n.nspname, t.typname
      INTO col_type_schema, col_type_name
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid AND c.relname = 'Shop'
    JOIN pg_namespace cn ON cn.oid = c.relnamespace AND cn.nspname = 'public'
    JOIN pg_type t ON t.oid = a.atttypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE a.attname = 'platform'
      AND a.attnum > 0
      AND NOT a.attisdropped
    LIMIT 1;

    IF NOT (col_type_schema = 'public' AND col_type_name = 'Platform') THEN
      -- Drop default if any (ignore errors)
      BEGIN
        EXECUTE 'ALTER TABLE "Shop" ALTER COLUMN "platform" DROP DEFAULT';
      EXCEPTION WHEN others THEN
        NULL;
      END;

      -- First coerce to TEXT (works whether source is enum or already text)
      BEGIN
        EXECUTE 'ALTER TABLE "Shop" ALTER COLUMN "platform" TYPE TEXT USING ("platform"::text)';
      EXCEPTION WHEN others THEN
        NULL;
      END;

      -- Then cast to public."Platform", defaulting unknowns to JUMIA
      EXECUTE $$
        ALTER TABLE "Shop"
          ALTER COLUMN "platform" TYPE "public"."Platform"
          USING (
            CASE
              WHEN "platform" IN ('JUMIA','KILIMALL') THEN "platform"::"public"."Platform"
              ELSE 'JUMIA'::"public"."Platform"
            END
          )
      $$;

      -- Restore default
      EXECUTE 'ALTER TABLE "Shop" ALTER COLUMN "platform" SET DEFAULT ''JUMIA''::"public"."Platform"';
    END IF;
  END IF;
END $$;

-- 3) Optional cleanup: if betechops_ops.Platform exists and is unused, drop it and possibly schema
DO $$
DECLARE
  enum_in_use integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'betechops_ops' AND t.typname = 'Platform'
  ) THEN
    -- Check for any columns still using this enum
    SELECT COUNT(*) INTO enum_in_use
    FROM pg_attribute a
    JOIN pg_type t ON t.oid = a.atttypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'betechops_ops' AND t.typname = 'Platform' AND a.attisdropped = false;

    IF enum_in_use = 0 THEN
      BEGIN
        EXECUTE 'DROP TYPE "betechops_ops"."Platform"';
      EXCEPTION WHEN others THEN
        NULL;
      END;

      -- Try to drop schema if now empty
      BEGIN
        EXECUTE 'DROP SCHEMA betechops_ops RESTRICT';
      EXCEPTION WHEN others THEN
        NULL;
      END;
    END IF;
  END IF;
END $$;