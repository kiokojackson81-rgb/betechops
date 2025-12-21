-- Minimal migration to ensure AttendantPayrollAdjustment exists before
-- the later adjustment-kind migration runs. This avoids the shadow DB
-- error where the ALTER runs before the CREATE.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE lower(typname) = lower('payrolladjustmenttype')
  ) THEN
    CREATE TYPE "PayrollAdjustmentType" AS ENUM ('CHAMA', 'LATENESS', 'DISCIPLINE', 'BONUS', 'COMMISSION_TOPUP', 'OTHER');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'AttendantPayrollAdjustment'
  ) THEN
    CREATE TABLE "AttendantPayrollAdjustment" (
      "id" TEXT PRIMARY KEY,
      "attendantId" TEXT NOT NULL,
      "periodKey" TEXT NOT NULL,
      "periodLabel" TEXT NOT NULL,
      "adjustmentType" "PayrollAdjustmentType" NOT NULL,
      "label" TEXT NOT NULL,
      "amount" INTEGER NOT NULL,
      "createdById" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS "AttendantPayrollAdjustment_attendantId_periodKey_idx" ON "AttendantPayrollAdjustment"("attendantId", "periodKey");
  END IF;
END $$;

-- Add a placeholder foreign key only if User exists and the constraint is missing
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'User'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public' AND table_name = 'AttendantPayrollAdjustment' AND constraint_name = 'AttendantPayrollAdjustment_attendantId_fkey'
    ) THEN
      ALTER TABLE "AttendantPayrollAdjustment"
      ADD CONSTRAINT "AttendantPayrollAdjustment_attendantId_fkey" FOREIGN KEY ("attendantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

