DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttendantCategory') THEN
    BEGIN
      ALTER TYPE "AttendantCategory" ADD VALUE IF NOT EXISTS 'GENERAL_OPS';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
