DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AttendantPayrollAdjustment_recurringItemId_periodKey_key'
  ) THEN
    ALTER TABLE "AttendantPayrollAdjustment"
      DROP CONSTRAINT "AttendantPayrollAdjustment_recurringItemId_periodKey_key";
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AttendantPayrollAdjustment_recurringItemId_periodKey_occurrenceDate_key'
  ) THEN
    ALTER TABLE "AttendantPayrollAdjustment"
      ADD CONSTRAINT "AttendantPayrollAdjustment_recurringItemId_periodKey_occurrenceDate_key"
      UNIQUE ("recurringItemId", "periodKey", "occurrenceDate");
  END IF;
END $$;
