CREATE TABLE IF NOT EXISTS "ProductContributorProduct" (
  "productId" TEXT PRIMARY KEY REFERENCES "Product"("id") ON DELETE RESTRICT,
  "contributorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "earningKes" INTEGER NOT NULL DEFAULT 5 CHECK ("earningKes" >= 0),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ProductContributorProduct_contributorId_createdAt_idx"
  ON "ProductContributorProduct" ("contributorId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS "ProductContributorWithdrawal" (
  "id" TEXT PRIMARY KEY,
  "contributorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "amountKes" INTEGER NOT NULL CHECK ("amountKes" > 0),
  "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING', 'PAID', 'REJECTED')),
  "paymentReference" TEXT,
  "adminNote" TEXT,
  "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "processedAt" TIMESTAMPTZ,
  "processedById" TEXT REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "ProductContributorWithdrawal_contributorId_status_idx"
  ON "ProductContributorWithdrawal" ("contributorId", "status", "requestedAt" DESC);
