-- Make this migration idempotent for shadow DBs: create enum only if missing,
-- ensure the base table exists before altering, and add the column only if missing.

DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_type WHERE lower(typname) = lower('payrolladjustmentkind')) THEN
		CREATE TYPE "PayrollAdjustmentKind" AS ENUM ('ADDITION', 'DEDUCTION');
	END IF;
END $$;

DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'AttendantPayrollAdjustment') THEN
		IF NOT EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = 'AttendantPayrollAdjustment' AND column_name = 'adjustmentKind'
		) THEN
			ALTER TABLE "AttendantPayrollAdjustment"
			ADD COLUMN "adjustmentKind" "PayrollAdjustmentKind" NOT NULL DEFAULT 'DEDUCTION';
		END IF;
	END IF;
END $$;
