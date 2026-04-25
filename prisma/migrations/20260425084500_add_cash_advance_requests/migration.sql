DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CashAdvanceRequestStatus') THEN
    CREATE TYPE "CashAdvanceRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

CREATE TABLE "CashAdvanceRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "requestedAmount" INTEGER NOT NULL,
  "approvedAmount" INTEGER,
  "status" "CashAdvanceRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT NOT NULL,
  "adminComment" TEXT,
  "payrollAdjustmentId" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CashAdvanceRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CashAdvanceRequest_userId_createdAt_idx" ON "CashAdvanceRequest"("userId", "createdAt");
CREATE INDEX "CashAdvanceRequest_status_createdAt_idx" ON "CashAdvanceRequest"("status", "createdAt");

ALTER TABLE "CashAdvanceRequest"
  ADD CONSTRAINT "CashAdvanceRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CashAdvanceRequest"
  ADD CONSTRAINT "CashAdvanceRequest_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
