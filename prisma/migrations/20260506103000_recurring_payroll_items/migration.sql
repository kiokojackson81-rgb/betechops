DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PayrollAdjustmentCadence') THEN
    CREATE TYPE "PayrollAdjustmentCadence" AS ENUM ('WEEKLY', 'MONTHLY');
  END IF;
END $$;

ALTER TABLE "AttendantPayrollAdjustment"
  ADD COLUMN IF NOT EXISTS "recurringItemId" TEXT,
  ADD COLUMN IF NOT EXISTS "occurrenceDate" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "AttendantRecurringPayrollItem" (
  "id" TEXT NOT NULL,
  "attendantId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "adjustmentType" "PayrollAdjustmentType" NOT NULL,
  "adjustmentKind" "PayrollAdjustmentKind" NOT NULL DEFAULT 'DEDUCTION',
  "amount" INTEGER NOT NULL,
  "cadence" "PayrollAdjustmentCadence" NOT NULL,
  "dayOfWeek" INTEGER,
  "dayOfMonth" INTEGER,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendantRecurringPayrollItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AttendantRecurringPayrollItem_attendantId_isActive_idx"
  ON "AttendantRecurringPayrollItem"("attendantId", "isActive");

CREATE INDEX IF NOT EXISTS "AttendantPayrollAdjustment_recurringItemId_periodKey_idx"
  ON "AttendantPayrollAdjustment"("recurringItemId", "periodKey");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AttendantPayrollAdjustment_recurringItemId_periodKey_key'
  ) THEN
    ALTER TABLE "AttendantPayrollAdjustment"
      ADD CONSTRAINT "AttendantPayrollAdjustment_recurringItemId_periodKey_key"
      UNIQUE ("recurringItemId", "periodKey");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AttendantPayrollAdjustment_recurringItemId_fkey'
  ) THEN
    ALTER TABLE "AttendantPayrollAdjustment"
      ADD CONSTRAINT "AttendantPayrollAdjustment_recurringItemId_fkey"
      FOREIGN KEY ("recurringItemId") REFERENCES "AttendantRecurringPayrollItem"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AttendantRecurringPayrollItem_attendantId_fkey'
  ) THEN
    ALTER TABLE "AttendantRecurringPayrollItem"
      ADD CONSTRAINT "AttendantRecurringPayrollItem_attendantId_fkey"
      FOREIGN KEY ("attendantId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
