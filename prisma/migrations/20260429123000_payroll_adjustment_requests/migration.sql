CREATE TABLE IF NOT EXISTS "PayrollAdjustmentRequest" (
  "id" TEXT NOT NULL,
  "attendantId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "decidedById" TEXT,
  "payrollAdjustmentId" TEXT,
  "periodKey" TEXT NOT NULL,
  "periodLabel" TEXT NOT NULL,
  "adjustmentType" "PayrollAdjustmentType" NOT NULL,
  "adjustmentKind" "PayrollAdjustmentKind" NOT NULL DEFAULT 'DEDUCTION',
  "offenseType" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "incidentDate" TIMESTAMP(3),
  "details" TEXT NOT NULL,
  "evidenceUrl" TEXT,
  "status" "WellnessRequestStatus" NOT NULL DEFAULT 'PENDING',
  "adminComment" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollAdjustmentRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PayrollAdjustmentRequest_payrollAdjustmentId_key" ON "PayrollAdjustmentRequest"("payrollAdjustmentId");
CREATE INDEX IF NOT EXISTS "PayrollAdjustmentRequest_attendantId_periodKey_idx" ON "PayrollAdjustmentRequest"("attendantId", "periodKey");
CREATE INDEX IF NOT EXISTS "PayrollAdjustmentRequest_requestedById_createdAt_idx" ON "PayrollAdjustmentRequest"("requestedById", "createdAt");
CREATE INDEX IF NOT EXISTS "PayrollAdjustmentRequest_status_createdAt_idx" ON "PayrollAdjustmentRequest"("status", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'PayrollAdjustmentRequest' AND constraint_name = 'PayrollAdjustmentRequest_attendantId_fkey'
  ) THEN
    ALTER TABLE "PayrollAdjustmentRequest"
    ADD CONSTRAINT "PayrollAdjustmentRequest_attendantId_fkey" FOREIGN KEY ("attendantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'PayrollAdjustmentRequest' AND constraint_name = 'PayrollAdjustmentRequest_requestedById_fkey'
  ) THEN
    ALTER TABLE "PayrollAdjustmentRequest"
    ADD CONSTRAINT "PayrollAdjustmentRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'PayrollAdjustmentRequest' AND constraint_name = 'PayrollAdjustmentRequest_decidedById_fkey'
  ) THEN
    ALTER TABLE "PayrollAdjustmentRequest"
    ADD CONSTRAINT "PayrollAdjustmentRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'PayrollAdjustmentRequest' AND constraint_name = 'PayrollAdjustmentRequest_payrollAdjustmentId_fkey'
  ) THEN
    ALTER TABLE "PayrollAdjustmentRequest"
    ADD CONSTRAINT "PayrollAdjustmentRequest_payrollAdjustmentId_fkey" FOREIGN KEY ("payrollAdjustmentId") REFERENCES "AttendantPayrollAdjustment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
