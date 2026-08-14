-- Lipa Pole Pole / Lay-By module
-- Keeps advance collections separate from final receipt/project recognition.

-- Product configuration
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "lipaPolePoleEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "lipaPolePoleMinDeposit" DECIMAL(12,2);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "lipaPolePoleMaxDays" INTEGER;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "lipaPolePoleDefaultDays" INTEGER;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "lipaPolePoleTerms" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LipaPolePoleStatus') THEN
    CREATE TYPE "LipaPolePoleStatus" AS ENUM (
      'DRAFT',
      'ACTIVE',
      'DUE_SOON',
      'OVERDUE',
      'ON_HOLD',
      'COMPLETED',
      'AWAITING_CONVERSION',
      'CONVERTED_TO_POS',
      'CONVERTED_TO_PROJECT',
      'CANCELLED',
      'REFUNDED',
      'CLOSED'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LipaPolePolePaymentStatus') THEN
    CREATE TYPE "LipaPolePolePaymentStatus" AS ENUM (
      'PENDING',
      'SUCCESS',
      'FAILED',
      'REVERSED'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LipaPolePolePaymentMode') THEN
    CREATE TYPE "LipaPolePolePaymentMode" AS ENUM (
      'FLEXIBLE',
      'SCHEDULED'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LipaPolePoleReservationMode') THEN
    CREATE TYPE "LipaPolePoleReservationMode" AS ENUM (
      'NONE',
      'SOFT_RESERVE',
      'HARD_RESERVE'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LipaPolePolePaymentMethod') THEN
    CREATE TYPE "LipaPolePolePaymentMethod" AS ENUM (
      'MPESA',
      'CASH',
      'BANK',
      'CARD',
      'OTHER'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "LipaPolePole" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "productId" TEXT,
  "publicToken" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "agreedUnitPrice" DECIMAL(14,2) NOT NULL,
  "agreedTotal" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'KES',
  "status" "LipaPolePoleStatus" NOT NULL DEFAULT 'DRAFT',
  "paymentMode" "LipaPolePolePaymentMode" NOT NULL DEFAULT 'FLEXIBLE',
  "reservationMode" "LipaPolePoleReservationMode" NOT NULL DEFAULT 'SOFT_RESERVE',
  "expectedCompletionDate" TIMESTAMP(3),
  "assignedToId" TEXT,
  "salespersonId" TEXT,
  "source" TEXT,
  "notes" TEXT,
  "completedAt" TIMESTAMP(3),
  "convertedAt" TIMESTAMP(3),
  "convertedById" TEXT,
  "convertedReceiptId" TEXT,
  "convertedProjectId" TEXT,
  "fulfilledAt" TIMESTAMP(3),
  "fulfilledById" TEXT,
  "fulfillmentMethod" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LipaPolePole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LipaPolePolePayment" (
  "id" TEXT NOT NULL,
  "lipaPolePoleId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "method" "LipaPolePolePaymentMethod" NOT NULL,
  "reference" TEXT,
  "status" "LipaPolePolePaymentStatus" NOT NULL DEFAULT 'PENDING',
  "receivedById" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "reversedAt" TIMESTAMP(3),
  "reversedById" TEXT,
  "reversalReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LipaPolePolePayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LipaPolePoleInstallment" (
  "id" TEXT NOT NULL,
  "lipaPolePoleId" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "expectedAmount" DECIMAL(14,2) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LipaPolePoleInstallment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LipaPolePoleAssignment" (
  "id" TEXT NOT NULL,
  "lipaPolePoleId" TEXT NOT NULL,
  "assignedToId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedById" TEXT,
  "assignmentMethod" TEXT,
  "notes" TEXT,
  CONSTRAINT "LipaPolePoleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LipaPolePoleReminder" (
  "id" TEXT NOT NULL,
  "lipaPolePoleId" TEXT NOT NULL,
  "reminderType" TEXT NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3),
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "providerMessageId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "payloadSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LipaPolePoleReminder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LipaPolePoleFollowUp" (
  "id" TEXT NOT NULL,
  "lipaPolePoleId" TEXT NOT NULL,
  "assignedToId" TEXT,
  "outcome" TEXT,
  "taskType" TEXT NOT NULL,
  "taskDate" TIMESTAMP(3),
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LipaPolePoleFollowUp_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LipaPolePolePromise" (
  "id" TEXT NOT NULL,
  "lipaPolePoleId" TEXT NOT NULL,
  "promiseAmount" DECIMAL(14,2) NOT NULL,
  "promiseDate" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LipaPolePolePromise_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LipaPolePoleAdjustment" (
  "id" TEXT NOT NULL,
  "lipaPolePoleId" TEXT NOT NULL,
  "adjustmentType" TEXT NOT NULL,
  "oldValue" JSONB,
  "newValue" JSONB,
  "reason" TEXT NOT NULL,
  "approvedById" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LipaPolePoleAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LipaPolePoleRefund" (
  "id" TEXT NOT NULL,
  "lipaPolePoleId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "refundMethod" TEXT,
  "refundReference" TEXT,
  "reason" TEXT NOT NULL,
  "approvedById" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LipaPolePoleRefund_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LipaPolePoleEvent" (
  "id" TEXT NOT NULL,
  "lipaPolePoleId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "actorId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LipaPolePoleEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LipaPolePole_reference_key" ON "LipaPolePole"("reference");
CREATE UNIQUE INDEX IF NOT EXISTS "LipaPolePole_publicToken_key" ON "LipaPolePole"("publicToken");
CREATE UNIQUE INDEX IF NOT EXISTS "LipaPolePole_convertedReceiptId_key" ON "LipaPolePole"("convertedReceiptId");
CREATE UNIQUE INDEX IF NOT EXISTS "LipaPolePole_convertedProjectId_key" ON "LipaPolePole"("convertedProjectId");
CREATE INDEX IF NOT EXISTS "LipaPolePole_customerId_createdAt_idx" ON "LipaPolePole"("customerId", "createdAt");
CREATE INDEX IF NOT EXISTS "LipaPolePole_productId_createdAt_idx" ON "LipaPolePole"("productId", "createdAt");
CREATE INDEX IF NOT EXISTS "LipaPolePole_status_expectedCompletionDate_idx" ON "LipaPolePole"("status", "expectedCompletionDate");
CREATE INDEX IF NOT EXISTS "LipaPolePole_assignedToId_status_expectedCompletionDate_idx" ON "LipaPolePole"("assignedToId", "status", "expectedCompletionDate");
CREATE INDEX IF NOT EXISTS "LipaPolePole_source_createdAt_idx" ON "LipaPolePole"("source", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "LipaPolePolePayment_lipaPolePoleId_reference_key" ON "LipaPolePolePayment"("lipaPolePoleId", "reference");
CREATE UNIQUE INDEX IF NOT EXISTS "LipaPolePolePayment_reference_key" ON "LipaPolePolePayment"("reference");
CREATE INDEX IF NOT EXISTS "LipaPolePolePayment_status_receivedAt_idx" ON "LipaPolePolePayment"("status", "receivedAt");
CREATE INDEX IF NOT EXISTS "LipaPolePolePayment_receivedById_receivedAt_idx" ON "LipaPolePolePayment"("receivedById", "receivedAt");

CREATE INDEX IF NOT EXISTS "LipaPolePoleInstallment_lipaPolePoleId_dueDate_idx" ON "LipaPolePoleInstallment"("lipaPolePoleId", "dueDate");
CREATE INDEX IF NOT EXISTS "LipaPolePoleAssignment_lipaPolePoleId_assignedAt_idx" ON "LipaPolePoleAssignment"("lipaPolePoleId", "assignedAt");
CREATE INDEX IF NOT EXISTS "LipaPolePoleAssignment_assignedToId_assignedAt_idx" ON "LipaPolePoleAssignment"("assignedToId", "assignedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "LipaPolePoleReminder_idempotencyKey_key" ON "LipaPolePoleReminder"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "LipaPolePoleReminder_lipaPolePoleId_scheduledFor_idx" ON "LipaPolePoleReminder"("lipaPolePoleId", "scheduledFor");
CREATE INDEX IF NOT EXISTS "LipaPolePoleReminder_status_scheduledFor_idx" ON "LipaPolePoleReminder"("status", "scheduledFor");
CREATE INDEX IF NOT EXISTS "LipaPolePoleFollowUp_lipaPolePoleId_createdAt_idx" ON "LipaPolePoleFollowUp"("lipaPolePoleId", "createdAt");
CREATE INDEX IF NOT EXISTS "LipaPolePoleFollowUp_assignedToId_taskDate_idx" ON "LipaPolePoleFollowUp"("assignedToId", "taskDate");
CREATE INDEX IF NOT EXISTS "LipaPolePolePromise_lipaPolePoleId_promiseDate_idx" ON "LipaPolePolePromise"("lipaPolePoleId", "promiseDate");
CREATE INDEX IF NOT EXISTS "LipaPolePolePromise_status_promiseDate_idx" ON "LipaPolePolePromise"("status", "promiseDate");
CREATE INDEX IF NOT EXISTS "LipaPolePoleAdjustment_lipaPolePoleId_createdAt_idx" ON "LipaPolePoleAdjustment"("lipaPolePoleId", "createdAt");
CREATE INDEX IF NOT EXISTS "LipaPolePoleRefund_lipaPolePoleId_createdAt_idx" ON "LipaPolePoleRefund"("lipaPolePoleId", "createdAt");
CREATE INDEX IF NOT EXISTS "LipaPolePoleEvent_lipaPolePoleId_createdAt_idx" ON "LipaPolePoleEvent"("lipaPolePoleId", "createdAt");
CREATE INDEX IF NOT EXISTS "LipaPolePoleEvent_eventType_createdAt_idx" ON "LipaPolePoleEvent"("eventType", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LipaPolePole_customerId_fkey' AND table_name = 'LipaPolePole'
  ) THEN
    ALTER TABLE "LipaPolePole"
      ADD CONSTRAINT "LipaPolePole_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LipaPolePole_productId_fkey' AND table_name = 'LipaPolePole'
  ) THEN
    ALTER TABLE "LipaPolePole"
      ADD CONSTRAINT "LipaPolePole_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LipaPolePole_assignedToId_fkey' AND table_name = 'LipaPolePole'
  ) THEN
    ALTER TABLE "LipaPolePole"
      ADD CONSTRAINT "LipaPolePole_assignedToId_fkey"
      FOREIGN KEY ("assignedToId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LipaPolePole_salespersonId_fkey' AND table_name = 'LipaPolePole'
  ) THEN
    ALTER TABLE "LipaPolePole"
      ADD CONSTRAINT "LipaPolePole_salespersonId_fkey"
      FOREIGN KEY ("salespersonId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LipaPolePole_convertedById_fkey' AND table_name = 'LipaPolePole'
  ) THEN
    ALTER TABLE "LipaPolePole"
      ADD CONSTRAINT "LipaPolePole_convertedById_fkey"
      FOREIGN KEY ("convertedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LipaPolePole_convertedReceiptId_fkey' AND table_name = 'LipaPolePole'
  ) THEN
    ALTER TABLE "LipaPolePole"
      ADD CONSTRAINT "LipaPolePole_convertedReceiptId_fkey"
      FOREIGN KEY ("convertedReceiptId") REFERENCES "Receipt"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LipaPolePole_fulfilledById_fkey' AND table_name = 'LipaPolePole'
  ) THEN
    ALTER TABLE "LipaPolePole"
      ADD CONSTRAINT "LipaPolePole_fulfilledById_fkey"
      FOREIGN KEY ("fulfilledById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LipaPolePole_createdById_fkey' AND table_name = 'LipaPolePole'
  ) THEN
    ALTER TABLE "LipaPolePole"
      ADD CONSTRAINT "LipaPolePole_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LipaPolePolePayment_lipaPolePoleId_fkey' AND table_name = 'LipaPolePolePayment'
  ) THEN
    ALTER TABLE "LipaPolePolePayment"
      ADD CONSTRAINT "LipaPolePolePayment_lipaPolePoleId_fkey"
      FOREIGN KEY ("lipaPolePoleId") REFERENCES "LipaPolePole"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LipaPolePolePayment_receivedById_fkey' AND table_name = 'LipaPolePolePayment'
  ) THEN
    ALTER TABLE "LipaPolePolePayment"
      ADD CONSTRAINT "LipaPolePolePayment_receivedById_fkey"
      FOREIGN KEY ("receivedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LipaPolePolePayment_reversedById_fkey' AND table_name = 'LipaPolePolePayment'
  ) THEN
    ALTER TABLE "LipaPolePolePayment"
      ADD CONSTRAINT "LipaPolePolePayment_reversedById_fkey"
      FOREIGN KEY ("reversedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LipaPolePoleInstallment_lipaPolePoleId_fkey' AND table_name = 'LipaPolePoleInstallment'
  ) THEN
    ALTER TABLE "LipaPolePoleInstallment"
      ADD CONSTRAINT "LipaPolePoleInstallment_lipaPolePoleId_fkey"
      FOREIGN KEY ("lipaPolePoleId") REFERENCES "LipaPolePole"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LipaPolePoleAssignment_lipaPolePoleId_fkey' AND table_name = 'LipaPolePoleAssignment'
  ) THEN
    ALTER TABLE "LipaPolePoleAssignment"
      ADD CONSTRAINT "LipaPolePoleAssignment_lipaPolePoleId_fkey"
      FOREIGN KEY ("lipaPolePoleId") REFERENCES "LipaPolePole"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LipaPolePoleAssignment_assignedToId_fkey' AND table_name = 'LipaPolePoleAssignment'
  ) THEN
    ALTER TABLE "LipaPolePoleAssignment"
      ADD CONSTRAINT "LipaPolePoleAssignment_assignedToId_fkey"
      FOREIGN KEY ("assignedToId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LipaPolePoleAssignment_assignedById_fkey' AND table_name = 'LipaPolePoleAssignment'
  ) THEN
    ALTER TABLE "LipaPolePoleAssignment"
      ADD CONSTRAINT "LipaPolePoleAssignment_assignedById_fkey"
      FOREIGN KEY ("assignedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LipaPolePoleReminder_lipaPolePoleId_fkey' AND table_name = 'LipaPolePoleReminder'
  ) THEN
    ALTER TABLE "LipaPolePoleReminder"
      ADD CONSTRAINT "LipaPolePoleReminder_lipaPolePoleId_fkey"
      FOREIGN KEY ("lipaPolePoleId") REFERENCES "LipaPolePole"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LipaPolePoleFollowUp_lipaPolePoleId_fkey' AND table_name = 'LipaPolePoleFollowUp'
  ) THEN
    ALTER TABLE "LipaPolePoleFollowUp"
      ADD CONSTRAINT "LipaPolePoleFollowUp_lipaPolePoleId_fkey"
      FOREIGN KEY ("lipaPolePoleId") REFERENCES "LipaPolePole"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LipaPolePoleFollowUp_assignedToId_fkey' AND table_name = 'LipaPolePoleFollowUp'
  ) THEN
    ALTER TABLE "LipaPolePoleFollowUp"
      ADD CONSTRAINT "LipaPolePoleFollowUp_assignedToId_fkey"
      FOREIGN KEY ("assignedToId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LipaPolePoleFollowUp_createdById_fkey' AND table_name = 'LipaPolePoleFollowUp'
  ) THEN
    ALTER TABLE "LipaPolePoleFollowUp"
      ADD CONSTRAINT "LipaPolePoleFollowUp_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LipaPolePolePromise_lipaPolePoleId_fkey' AND table_name = 'LipaPolePolePromise'
  ) THEN
    ALTER TABLE "LipaPolePolePromise"
      ADD CONSTRAINT "LipaPolePolePromise_lipaPolePoleId_fkey"
      FOREIGN KEY ("lipaPolePoleId") REFERENCES "LipaPolePole"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LipaPolePolePromise_createdById_fkey' AND table_name = 'LipaPolePolePromise'
  ) THEN
    ALTER TABLE "LipaPolePolePromise"
      ADD CONSTRAINT "LipaPolePolePromise_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LipaPolePoleAdjustment_lipaPolePoleId_fkey' AND table_name = 'LipaPolePoleAdjustment'
  ) THEN
    ALTER TABLE "LipaPolePoleAdjustment"
      ADD CONSTRAINT "LipaPolePoleAdjustment_lipaPolePoleId_fkey"
      FOREIGN KEY ("lipaPolePoleId") REFERENCES "LipaPolePole"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LipaPolePoleAdjustment_approvedById_fkey' AND table_name = 'LipaPolePoleAdjustment'
  ) THEN
    ALTER TABLE "LipaPolePoleAdjustment"
      ADD CONSTRAINT "LipaPolePoleAdjustment_approvedById_fkey"
      FOREIGN KEY ("approvedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LipaPolePoleAdjustment_createdById_fkey' AND table_name = 'LipaPolePoleAdjustment'
  ) THEN
    ALTER TABLE "LipaPolePoleAdjustment"
      ADD CONSTRAINT "LipaPolePoleAdjustment_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LipaPolePoleRefund_lipaPolePoleId_fkey' AND table_name = 'LipaPolePoleRefund'
  ) THEN
    ALTER TABLE "LipaPolePoleRefund"
      ADD CONSTRAINT "LipaPolePoleRefund_lipaPolePoleId_fkey"
      FOREIGN KEY ("lipaPolePoleId") REFERENCES "LipaPolePole"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LipaPolePoleRefund_approvedById_fkey' AND table_name = 'LipaPolePoleRefund'
  ) THEN
    ALTER TABLE "LipaPolePoleRefund"
      ADD CONSTRAINT "LipaPolePoleRefund_approvedById_fkey"
      FOREIGN KEY ("approvedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LipaPolePoleRefund_createdById_fkey' AND table_name = 'LipaPolePoleRefund'
  ) THEN
    ALTER TABLE "LipaPolePoleRefund"
      ADD CONSTRAINT "LipaPolePoleRefund_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LipaPolePoleEvent_lipaPolePoleId_fkey' AND table_name = 'LipaPolePoleEvent'
  ) THEN
    ALTER TABLE "LipaPolePoleEvent"
      ADD CONSTRAINT "LipaPolePoleEvent_lipaPolePoleId_fkey"
      FOREIGN KEY ("lipaPolePoleId") REFERENCES "LipaPolePole"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LipaPolePoleEvent_actorId_fkey' AND table_name = 'LipaPolePoleEvent'
  ) THEN
    ALTER TABLE "LipaPolePoleEvent"
      ADD CONSTRAINT "LipaPolePoleEvent_actorId_fkey"
      FOREIGN KEY ("actorId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
