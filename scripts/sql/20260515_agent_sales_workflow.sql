BEGIN;

CREATE TABLE IF NOT EXISTS public."AgentSale" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "customerLocation" TEXT NOT NULL,
  "customerCounty" TEXT,
  "productName" TEXT NOT NULL,
  "productCategory" TEXT,
  "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paymentType" TEXT NOT NULL,
  "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "mpesaReference" TEXT,
  "deliveryMethod" TEXT,
  "deliveryNotes" TEXT,
  "customerNotes" TEXT,
  "internalAgentNotes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending_review',
  "commissionPct" DOUBLE PRECISION NOT NULL DEFAULT 6,
  "potentialCommission" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "commissionLocked" BOOLEAN NOT NULL DEFAULT TRUE,
  "receiptId" TEXT,
  "receiptNumber" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentSale_pkey" PRIMARY KEY ("id")
);

ALTER TABLE public."AgentCommission"
  ADD COLUMN IF NOT EXISTS "sourceType" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceId" TEXT,
  ADD COLUMN IF NOT EXISTS "orderNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "saleAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "commissionPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "commissionAmt" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "AgentSale_agentId_createdAt_idx"
  ON public."AgentSale" ("agentId", "createdAt");

CREATE INDEX IF NOT EXISTS "AgentSale_status_createdAt_idx"
  ON public."AgentSale" ("status", "createdAt");

CREATE INDEX IF NOT EXISTS "AgentSale_paymentType_createdAt_idx"
  ON public."AgentSale" ("paymentType", "createdAt");

CREATE INDEX IF NOT EXISTS "AgentSale_receiptId_idx"
  ON public."AgentSale" ("receiptId");

CREATE INDEX IF NOT EXISTS "AgentSale_createdAt_idx"
  ON public."AgentSale" ("createdAt");

CREATE INDEX IF NOT EXISTS "AgentCommission_sourceType_sourceId_idx"
  ON public."AgentCommission" ("sourceType", "sourceId");

DO $$
BEGIN
  IF to_regclass('public."User"') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'AgentSale_agentId_fkey'
    ) THEN
      ALTER TABLE public."AgentSale"
        ADD CONSTRAINT "AgentSale_agentId_fkey"
        FOREIGN KEY ("agentId") REFERENCES public."User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;

  IF to_regclass('public."Receipt"') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'AgentSale_receiptId_fkey'
    ) THEN
      ALTER TABLE public."AgentSale"
        ADD CONSTRAINT "AgentSale_receiptId_fkey"
        FOREIGN KEY ("receiptId") REFERENCES public."Receipt"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'AgentCommission_sourceType_sourceId_key'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public."AgentCommission"
      WHERE "sourceId" IS NOT NULL
      GROUP BY "sourceType", "sourceId"
      HAVING COUNT(*) > 1
    ) THEN
      CREATE UNIQUE INDEX "AgentCommission_sourceType_sourceId_key"
        ON public."AgentCommission" ("sourceType", "sourceId")
        WHERE "sourceId" IS NOT NULL;
    ELSE
      RAISE NOTICE 'Skipped AgentCommission_sourceType_sourceId_key because duplicate source ids already exist.';
    END IF;
  END IF;
END$$;

COMMIT;
