DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'PayrollAdjustmentType' AND e.enumlabel = 'CASH_ADVANCE'
  ) THEN
    ALTER TYPE "PayrollAdjustmentType" ADD VALUE 'CASH_ADVANCE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LeaveRequestType') THEN
    CREATE TYPE "LeaveRequestType" AS ENUM ('ANNUAL', 'SICK', 'EMERGENCY', 'UNPAID', 'OTHER');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WellnessRequestStatus') THEN
    CREATE TYPE "WellnessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

CREATE TABLE "LeaveBalance" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "annualEntitlement" INTEGER NOT NULL DEFAULT 21,
  "sickEntitlement" INTEGER NOT NULL DEFAULT 10,
  "emergencyEntitlement" INTEGER NOT NULL DEFAULT 5,
  "annualUsed" INTEGER NOT NULL DEFAULT 0,
  "sickUsed" INTEGER NOT NULL DEFAULT 0,
  "emergencyUsed" INTEGER NOT NULL DEFAULT 0,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeaveBalance_userId_key" ON "LeaveBalance"("userId");

ALTER TABLE "LeaveBalance"
  ADD CONSTRAINT "LeaveBalance_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeaveBalance"
  ADD CONSTRAINT "LeaveBalance_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "LeaveRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "type" "LeaveRequestType" NOT NULL,
  "status" "WellnessRequestStatus" NOT NULL DEFAULT 'PENDING',
  "daysRequested" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "supportingDocumentUrl" TEXT,
  "managerComment" TEXT,
  "approvedById" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeaveRequest_userId_createdAt_idx" ON "LeaveRequest"("userId", "createdAt");
CREATE INDEX "LeaveRequest_status_createdAt_idx" ON "LeaveRequest"("status", "createdAt");

ALTER TABLE "LeaveRequest"
  ADD CONSTRAINT "LeaveRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeaveRequest"
  ADD CONSTRAINT "LeaveRequest_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CashAdvance" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "requestedAmount" INTEGER NOT NULL,
  "approvedAmount" INTEGER,
  "status" "WellnessRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT NOT NULL,
  "repaymentPeriod" INTEGER,
  "installmentAmount" INTEGER,
  "remainingBalance" INTEGER NOT NULL DEFAULT 0,
  "hrComment" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CashAdvance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CashAdvance_userId_createdAt_idx" ON "CashAdvance"("userId", "createdAt");
CREATE INDEX "CashAdvance_status_createdAt_idx" ON "CashAdvance"("status", "createdAt");

ALTER TABLE "CashAdvance"
  ADD CONSTRAINT "CashAdvance_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CashAdvance"
  ADD CONSTRAINT "CashAdvance_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CashAdvanceInstallment" (
  "id" TEXT NOT NULL,
  "cashAdvanceId" TEXT NOT NULL,
  "dueDate" DATE NOT NULL,
  "periodKey" TEXT NOT NULL,
  "periodLabel" TEXT NOT NULL,
  "sequenceNumber" INTEGER NOT NULL,
  "amount" INTEGER NOT NULL,
  "isPaid" BOOLEAN NOT NULL DEFAULT false,
  "deductedAt" TIMESTAMP(3),
  "payrollAdjustmentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CashAdvanceInstallment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CashAdvanceInstallment_cashAdvanceId_dueDate_idx" ON "CashAdvanceInstallment"("cashAdvanceId", "dueDate");
CREATE INDEX "CashAdvanceInstallment_isPaid_dueDate_idx" ON "CashAdvanceInstallment"("isPaid", "dueDate");

ALTER TABLE "CashAdvanceInstallment"
  ADD CONSTRAINT "CashAdvanceInstallment_cashAdvanceId_fkey"
  FOREIGN KEY ("cashAdvanceId") REFERENCES "CashAdvance"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
