-- Create Jumia multi-account order ingestion tables
DROP TABLE IF EXISTS "JumiaOrder";

CREATE TABLE "JumiaAccount" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JumiaAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JumiaShop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "lastOrdersUpdatedBefore" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JumiaShop_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "JumiaShop_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "JumiaAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "JumiaOrder" (
    "id" TEXT NOT NULL,
    "number" INTEGER,
    "status" TEXT NOT NULL,
    "hasMultipleStatus" BOOLEAN,
    "pendingSince" TEXT,
    "totalItems" INTEGER,
    "packedItems" INTEGER,
    "countryCode" TEXT,
    "isPrepayment" BOOLEAN,
    "createdAtJumia" TIMESTAMP(3),
    "updatedAtJumia" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shopId" TEXT NOT NULL,
    CONSTRAINT "JumiaOrder_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "JumiaOrder_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "JumiaShop"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "JumiaShop_accountId_idx" ON "JumiaShop"("accountId");
CREATE INDEX "JumiaOrder_shopId_status_idx" ON "JumiaOrder"("shopId", "status");
