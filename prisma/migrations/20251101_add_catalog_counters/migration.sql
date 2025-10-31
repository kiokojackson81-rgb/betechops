-- CreateTable
CREATE TABLE "CatalogCounters" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "shopId" TEXT,

    "total" INTEGER NOT NULL DEFAULT 0,
    "active" INTEGER NOT NULL DEFAULT 0,
    "inactive" INTEGER NOT NULL DEFAULT 0,
    "deleted" INTEGER NOT NULL DEFAULT 0,
    "pending" INTEGER NOT NULL DEFAULT 0,
    "visibleLive" INTEGER NOT NULL DEFAULT 0,

    "qcApproved" INTEGER NOT NULL DEFAULT 0,
    "qcPending" INTEGER NOT NULL DEFAULT 0,
    "qcRejected" INTEGER NOT NULL DEFAULT 0,
    "qcNotReady" INTEGER NOT NULL DEFAULT 0,

    "byStatus" JSONB,
    "byQcStatus" JSONB,
    "approx" BOOLEAN NOT NULL DEFAULT FALSE,

    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogCounters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CatalogCounters_scope_shopId_key" ON "CatalogCounters" ("scope", "shopId");

-- CreateIndex
CREATE INDEX "CatalogCounters_scope_shopId_computedAt_idx" ON "CatalogCounters" ("scope", "shopId", "computedAt");
