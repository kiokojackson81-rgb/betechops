DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'Platform' AND n.nspname = 'betechops_ops'
  ) THEN
    PERFORM 1 FROM pg_namespace WHERE nspname = 'betechops_ops';
    IF NOT FOUND THEN
      EXECUTE 'CREATE SCHEMA betechops_ops';
    END IF;
    EXECUTE 'CREATE TYPE "betechops_ops"."Platform" AS ENUM (''JUMIA'',''KILIMALL'')';
  END IF;
END $$;
