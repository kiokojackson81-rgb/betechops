BEGIN;

CREATE TABLE IF NOT EXISTS public."AgentLeadOwnership" (
  "id" TEXT NOT NULL,
  "normalizedPhone" TEXT NOT NULL,
  "customerName" TEXT,
  "customerCounty" TEXT,
  "customerLocation" TEXT,
  "productName" TEXT,
  "agentId" TEXT NOT NULL,
  "firstSaleId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "ownedUntil" TIMESTAMP(3) NOT NULL,
  "releasedAt" TIMESTAMP(3),
  "overrideNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentLeadOwnership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."AgentDuplicateReview" (
  "id" TEXT NOT NULL,
  "normalizedPhone" TEXT NOT NULL,
  "primarySaleId" TEXT NOT NULL,
  "duplicateSaleId" TEXT NOT NULL,
  "primaryAgentId" TEXT NOT NULL,
  "duplicateAgentId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "resolutionNote" TEXT,
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentDuplicateReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."AgentFraudSignal" (
  "id" TEXT NOT NULL,
  "agentId" TEXT,
  "saleId" TEXT,
  "signalType" TEXT NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "metadata" JSONB,
  "reviewedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentFraudSignal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."AgentAuditLog" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "targetAgentId" TEXT,
  "saleId" TEXT,
  "payoutId" TEXT,
  "duplicateReviewId" TEXT,
  "eventType" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."AgentSaleTimeline" (
  "id" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "note" TEXT,
  "actorUserId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentSaleTimeline_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AgentLeadOwnership_normalizedPhone_ownedUntil_idx"
  ON public."AgentLeadOwnership" ("normalizedPhone", "ownedUntil");

CREATE INDEX IF NOT EXISTS "AgentLeadOwnership_agentId_status_idx"
  ON public."AgentLeadOwnership" ("agentId", "status");

CREATE INDEX IF NOT EXISTS "AgentLeadOwnership_firstSaleId_idx"
  ON public."AgentLeadOwnership" ("firstSaleId");

CREATE UNIQUE INDEX IF NOT EXISTS "AgentDuplicateReview_primarySaleId_duplicateSaleId_key"
  ON public."AgentDuplicateReview" ("primarySaleId", "duplicateSaleId");

CREATE INDEX IF NOT EXISTS "AgentDuplicateReview_normalizedPhone_status_idx"
  ON public."AgentDuplicateReview" ("normalizedPhone", "status");

CREATE INDEX IF NOT EXISTS "AgentDuplicateReview_duplicateAgentId_status_idx"
  ON public."AgentDuplicateReview" ("duplicateAgentId", "status");

CREATE INDEX IF NOT EXISTS "AgentFraudSignal_status_riskLevel_createdAt_idx"
  ON public."AgentFraudSignal" ("status", "riskLevel", "createdAt");

CREATE INDEX IF NOT EXISTS "AgentFraudSignal_agentId_createdAt_idx"
  ON public."AgentFraudSignal" ("agentId", "createdAt");

CREATE INDEX IF NOT EXISTS "AgentFraudSignal_saleId_idx"
  ON public."AgentFraudSignal" ("saleId");

CREATE INDEX IF NOT EXISTS "AgentAuditLog_createdAt_idx"
  ON public."AgentAuditLog" ("createdAt");

CREATE INDEX IF NOT EXISTS "AgentAuditLog_eventType_createdAt_idx"
  ON public."AgentAuditLog" ("eventType", "createdAt");

CREATE INDEX IF NOT EXISTS "AgentAuditLog_targetAgentId_createdAt_idx"
  ON public."AgentAuditLog" ("targetAgentId", "createdAt");

CREATE INDEX IF NOT EXISTS "AgentAuditLog_saleId_createdAt_idx"
  ON public."AgentAuditLog" ("saleId", "createdAt");

CREATE INDEX IF NOT EXISTS "AgentAuditLog_payoutId_createdAt_idx"
  ON public."AgentAuditLog" ("payoutId", "createdAt");

CREATE INDEX IF NOT EXISTS "AgentSaleTimeline_saleId_createdAt_idx"
  ON public."AgentSaleTimeline" ("saleId", "createdAt");

CREATE INDEX IF NOT EXISTS "AgentSaleTimeline_stage_createdAt_idx"
  ON public."AgentSaleTimeline" ("stage", "createdAt");

CREATE INDEX IF NOT EXISTS "AgentSale_customerPhone_createdAt_idx"
  ON public."AgentSale" ("customerPhone", "createdAt");

CREATE INDEX IF NOT EXISTS "AgentSale_customerName_createdAt_idx"
  ON public."AgentSale" ("customerName", "createdAt");

CREATE INDEX IF NOT EXISTS "AgentPayout_reference_idx"
  ON public."AgentPayout" ("reference");

DO $$
BEGIN
  IF to_regclass('public."User"') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'AgentLeadOwnership_agentId_fkey'
    ) THEN
      ALTER TABLE public."AgentLeadOwnership"
        ADD CONSTRAINT "AgentLeadOwnership_agentId_fkey"
        FOREIGN KEY ("agentId") REFERENCES public."User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'AgentDuplicateReview_primaryAgentId_fkey'
    ) THEN
      ALTER TABLE public."AgentDuplicateReview"
        ADD CONSTRAINT "AgentDuplicateReview_primaryAgentId_fkey"
        FOREIGN KEY ("primaryAgentId") REFERENCES public."User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'AgentDuplicateReview_duplicateAgentId_fkey'
    ) THEN
      ALTER TABLE public."AgentDuplicateReview"
        ADD CONSTRAINT "AgentDuplicateReview_duplicateAgentId_fkey"
        FOREIGN KEY ("duplicateAgentId") REFERENCES public."User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'AgentDuplicateReview_resolvedById_fkey'
    ) THEN
      ALTER TABLE public."AgentDuplicateReview"
        ADD CONSTRAINT "AgentDuplicateReview_resolvedById_fkey"
        FOREIGN KEY ("resolvedById") REFERENCES public."User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'AgentFraudSignal_agentId_fkey'
    ) THEN
      ALTER TABLE public."AgentFraudSignal"
        ADD CONSTRAINT "AgentFraudSignal_agentId_fkey"
        FOREIGN KEY ("agentId") REFERENCES public."User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'AgentFraudSignal_reviewedById_fkey'
    ) THEN
      ALTER TABLE public."AgentFraudSignal"
        ADD CONSTRAINT "AgentFraudSignal_reviewedById_fkey"
        FOREIGN KEY ("reviewedById") REFERENCES public."User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'AgentAuditLog_actorUserId_fkey'
    ) THEN
      ALTER TABLE public."AgentAuditLog"
        ADD CONSTRAINT "AgentAuditLog_actorUserId_fkey"
        FOREIGN KEY ("actorUserId") REFERENCES public."User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'AgentAuditLog_targetAgentId_fkey'
    ) THEN
      ALTER TABLE public."AgentAuditLog"
        ADD CONSTRAINT "AgentAuditLog_targetAgentId_fkey"
        FOREIGN KEY ("targetAgentId") REFERENCES public."User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'AgentSaleTimeline_actorUserId_fkey'
    ) THEN
      ALTER TABLE public."AgentSaleTimeline"
        ADD CONSTRAINT "AgentSaleTimeline_actorUserId_fkey"
        FOREIGN KEY ("actorUserId") REFERENCES public."User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;

  IF to_regclass('public."AgentSale"') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'AgentLeadOwnership_firstSaleId_fkey'
    ) THEN
      ALTER TABLE public."AgentLeadOwnership"
        ADD CONSTRAINT "AgentLeadOwnership_firstSaleId_fkey"
        FOREIGN KEY ("firstSaleId") REFERENCES public."AgentSale"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'AgentDuplicateReview_primarySaleId_fkey'
    ) THEN
      ALTER TABLE public."AgentDuplicateReview"
        ADD CONSTRAINT "AgentDuplicateReview_primarySaleId_fkey"
        FOREIGN KEY ("primarySaleId") REFERENCES public."AgentSale"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'AgentDuplicateReview_duplicateSaleId_fkey'
    ) THEN
      ALTER TABLE public."AgentDuplicateReview"
        ADD CONSTRAINT "AgentDuplicateReview_duplicateSaleId_fkey"
        FOREIGN KEY ("duplicateSaleId") REFERENCES public."AgentSale"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'AgentFraudSignal_saleId_fkey'
    ) THEN
      ALTER TABLE public."AgentFraudSignal"
        ADD CONSTRAINT "AgentFraudSignal_saleId_fkey"
        FOREIGN KEY ("saleId") REFERENCES public."AgentSale"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'AgentAuditLog_saleId_fkey'
    ) THEN
      ALTER TABLE public."AgentAuditLog"
        ADD CONSTRAINT "AgentAuditLog_saleId_fkey"
        FOREIGN KEY ("saleId") REFERENCES public."AgentSale"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'AgentSaleTimeline_saleId_fkey'
    ) THEN
      ALTER TABLE public."AgentSaleTimeline"
        ADD CONSTRAINT "AgentSaleTimeline_saleId_fkey"
        FOREIGN KEY ("saleId") REFERENCES public."AgentSale"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;

  IF to_regclass('public."AgentPayout"') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'AgentAuditLog_payoutId_fkey'
    ) THEN
      ALTER TABLE public."AgentAuditLog"
        ADD CONSTRAINT "AgentAuditLog_payoutId_fkey"
        FOREIGN KEY ("payoutId") REFERENCES public."AgentPayout"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;

  IF to_regclass('public."AgentDuplicateReview"') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'AgentAuditLog_duplicateReviewId_fkey'
    ) THEN
      ALTER TABLE public."AgentAuditLog"
        ADD CONSTRAINT "AgentAuditLog_duplicateReviewId_fkey"
        FOREIGN KEY ("duplicateReviewId") REFERENCES public."AgentDuplicateReview"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END$$;

COMMIT;
