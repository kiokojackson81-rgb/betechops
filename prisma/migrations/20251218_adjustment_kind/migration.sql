CREATE TYPE "PayrollAdjustmentKind" AS ENUM ('ADDITION', 'DEDUCTION');

ALTER TABLE "AttendantPayrollAdjustment"
ADD COLUMN "adjustmentKind" "PayrollAdjustmentKind" NOT NULL DEFAULT 'DEDUCTION';
