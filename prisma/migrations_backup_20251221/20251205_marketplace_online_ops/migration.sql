-- CreateEnum
CREATE TYPE "MarketplaceAssignmentRole" AS ENUM ('JUMIA_KILIMALL_OPS', 'SUPERVISOR');

-- CreateEnum
CREATE TYPE "MarketplaceReturnStatus" AS ENUM ('WAITING_AT_HUB', 'PICKED', 'CHARGED_TO_ATTENDANT');

-- CreateTable
CREATE TABLE "MarketplaceAccount" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "displayName" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "jumiaShopSid" TEXT,
    "kilimallShopCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceAccountAssignment" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "attendantId" TEXT NOT NULL,
    "role" "MarketplaceAssignmentRole" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceAccountAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplacePayoutWeek" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "statementNumber" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "grossSales" DECIMAL(14,2) NOT NULL,
    "payoutAmount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "rawPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplacePayoutWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceOrder" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "orderedAt" TIMESTAMP(3) NOT NULL,
    "productName" TEXT NOT NULL,
    "productUrl" TEXT,
    "sellingPrice" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "buyingPrice" DECIMAL(14,2),
    "profit" DECIMAL(14,2),
    "pricedById" TEXT,
    "pricedAt" TIMESTAMP(3),
    "isReturned" BOOLEAN NOT NULL DEFAULT false,
    "rawPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplacePricingTemplate" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "normalizedProductName" TEXT NOT NULL,
    "sellingPrice" DECIMAL(14,2) NOT NULL,
    "defaultBuyingPrice" DECIMAL(14,2) NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplacePricingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceReturn" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "marketplaceOrderId" TEXT,
    "orderItemId" TEXT NOT NULL,
    "attendantId" TEXT,
    "expectedAmount" DECIMAL(14,2) NOT NULL,
    "status" "MarketplaceReturnStatus" NOT NULL DEFAULT 'WAITING_AT_HUB',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "processedById" TEXT,
    "processedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "MarketplaceReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceReturnAttachment" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceReturnAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceAccount_platform_jumiaShopSid_key" ON "MarketplaceAccount"("platform", "jumiaShopSid");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceAccount_platform_kilimallShopCode_key" ON "MarketplaceAccount"("platform", "kilimallShopCode");

-- CreateIndex
CREATE INDEX "MarketplaceAccountAssignment_attendantId_role_idx" ON "MarketplaceAccountAssignment"("attendantId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceAccountAssignment_accountId_attendantId_role_key" ON "MarketplaceAccountAssignment"("accountId", "attendantId", "role");

-- CreateIndex
CREATE INDEX "MarketplacePayoutWeek_accountId_weekEnd_idx" ON "MarketplacePayoutWeek"("accountId", "weekEnd");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplacePayoutWeek_accountId_statementNumber_key" ON "MarketplacePayoutWeek"("accountId", "statementNumber");

-- CreateIndex
CREATE INDEX "MarketplaceOrder_accountId_orderedAt_idx" ON "MarketplaceOrder"("accountId", "orderedAt");

-- CreateIndex
CREATE INDEX "MarketplaceOrder_pricedById_idx" ON "MarketplaceOrder"("pricedById");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceOrder_platform_orderItemId_key" ON "MarketplaceOrder"("platform", "orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplacePricingTemplate_platform_normalizedProductName_s_key" ON "MarketplacePricingTemplate"("platform", "normalizedProductName", "sellingPrice");

-- CreateIndex
CREATE INDEX "MarketplaceReturn_attendantId_status_idx" ON "MarketplaceReturn"("attendantId", "status");

-- CreateIndex
CREATE INDEX "MarketplaceReturn_dueAt_status_idx" ON "MarketplaceReturn"("dueAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceReturn_platform_orderItemId_key" ON "MarketplaceReturn"("platform", "orderItemId");

-- CreateIndex
CREATE INDEX "MarketplaceReturnAttachment_returnId_idx" ON "MarketplaceReturnAttachment"("returnId");

-- AddForeignKey
ALTER TABLE "MarketplaceAccountAssignment" ADD CONSTRAINT "MarketplaceAccountAssignment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MarketplaceAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceAccountAssignment" ADD CONSTRAINT "MarketplaceAccountAssignment_attendantId_fkey" FOREIGN KEY ("attendantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplacePayoutWeek" ADD CONSTRAINT "MarketplacePayoutWeek_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MarketplaceAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MarketplaceAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_pricedById_fkey" FOREIGN KEY ("pricedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplacePricingTemplate" ADD CONSTRAINT "MarketplacePricingTemplate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceReturn" ADD CONSTRAINT "MarketplaceReturn_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MarketplaceAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceReturn" ADD CONSTRAINT "MarketplaceReturn_marketplaceOrderId_fkey" FOREIGN KEY ("marketplaceOrderId") REFERENCES "MarketplaceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceReturn" ADD CONSTRAINT "MarketplaceReturn_attendantId_fkey" FOREIGN KEY ("attendantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceReturn" ADD CONSTRAINT "MarketplaceReturn_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceReturnAttachment" ADD CONSTRAINT "MarketplaceReturnAttachment_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "MarketplaceReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceReturnAttachment" ADD CONSTRAINT "MarketplaceReturnAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

