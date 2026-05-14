BEGIN;

CREATE TABLE IF NOT EXISTS public."AgentProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "referralCode" TEXT NOT NULL,
  "firstName" TEXT,
  "lastName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "nationalId" TEXT,
  "kraPin" TEXT,
  "gender" TEXT,
  "dateOfBirth" TIMESTAMP(3),
  "country" TEXT,
  "county" TEXT,
  "city" TEXT,
  "address" TEXT,
  "idFrontUrl" TEXT,
  "idBackUrl" TEXT,
  "profilePhotoUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."AgentCommission" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT,
  "orderNumber" TEXT,
  "saleAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "commissionPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "commissionAmt" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentCommission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."AgentPayout" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "method" TEXT,
  "phone" TEXT,
  "reference" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentPayout_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."AgentActivityLog" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AgentProfile_userId_key"
  ON public."AgentProfile" ("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "AgentProfile_referralCode_key"
  ON public."AgentProfile" ("referralCode");

CREATE INDEX IF NOT EXISTS "AgentProfile_status_createdAt_idx"
  ON public."AgentProfile" ("status", "createdAt");

CREATE INDEX IF NOT EXISTS "AgentCommission_agentId_createdAt_idx"
  ON public."AgentCommission" ("agentId", "createdAt");

CREATE INDEX IF NOT EXISTS "AgentCommission_status_createdAt_idx"
  ON public."AgentCommission" ("status", "createdAt");

CREATE INDEX IF NOT EXISTS "AgentPayout_agentId_createdAt_idx"
  ON public."AgentPayout" ("agentId", "createdAt");

CREATE INDEX IF NOT EXISTS "AgentPayout_status_createdAt_idx"
  ON public."AgentPayout" ("status", "createdAt");

CREATE INDEX IF NOT EXISTS "AgentActivityLog_agentId_createdAt_idx"
  ON public."AgentActivityLog" ("agentId", "createdAt");

DO $$
BEGIN
  IF to_regclass('public."User"') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'AgentProfile_userId_fkey'
    ) THEN
      ALTER TABLE public."AgentProfile"
        ADD CONSTRAINT "AgentProfile_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES public."User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'AgentCommission_agentId_fkey'
    ) THEN
      ALTER TABLE public."AgentCommission"
        ADD CONSTRAINT "AgentCommission_agentId_fkey"
        FOREIGN KEY ("agentId") REFERENCES public."User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'AgentPayout_agentId_fkey'
    ) THEN
      ALTER TABLE public."AgentPayout"
        ADD CONSTRAINT "AgentPayout_agentId_fkey"
        FOREIGN KEY ("agentId") REFERENCES public."User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'AgentActivityLog_agentId_fkey'
    ) THEN
      ALTER TABLE public."AgentActivityLog"
        ADD CONSTRAINT "AgentActivityLog_agentId_fkey"
        FOREIGN KEY ("agentId") REFERENCES public."User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END$$;

COMMIT;
