-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."DepositStatus" AS ENUM ('VALID', 'PENDING', 'INVALID');

-- CreateEnum
CREATE TYPE "public"."MarketplaceAssignmentRole" AS ENUM ('JUMIA_KILIMALL_OPS', 'SUPERVISOR');

-- CreateEnum
CREATE TYPE "public"."MarketplaceReturnStatus" AS ENUM ('WAITING_AT_HUB', 'PICKED', 'CHARGED_TO_ATTENDANT');

-- CreateEnum
CREATE TYPE "public"."OutletCode" AS ENUM ('BRIGHT', 'BARAKA_A', 'BARAKA_B', 'BARAKA_C', 'GENERAL');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "public"."PersonRole" AS ENUM ('attendant', 'supervisor', 'supplier', 'assistant');

-- CreateEnum
CREATE TYPE "public"."Platform" AS ENUM ('JUMIA', 'KILIMALL');

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'SUPERVISOR', 'ATTENDANT');

-- CreateTable
CREATE TABLE "public"."ActionLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSON,
    "after" JSON,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ActivePeriod" (
    "id" TEXT NOT NULL,
    "outletName" TEXT NOT NULL,
    "periodStartAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ActivePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ApiCredential" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "apiBase" TEXT NOT NULL,
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "issuer" TEXT,
    "clientId" TEXT,
    "refreshToken" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shopId" TEXT,

    CONSTRAINT "ApiCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AppState" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppState_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."Attendant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "outletId" TEXT,
    "loginCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AttendantAssignment" (
    "code" TEXT NOT NULL,
    "outlet" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "productKeys" JSONB,
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),

    CONSTRAINT "AttendantAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AttendantClosing" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "outletName" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "closingQty" DOUBLE PRECISION NOT NULL,
    "wasteQty" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "AttendantClosing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AttendantDeposit" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "outletName" TEXT NOT NULL,
    "code" TEXT,
    "note" TEXT,
    "amount" INTEGER NOT NULL,
    "status" "public"."DepositStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifyPayload" JSONB,

    CONSTRAINT "AttendantDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AttendantExpense" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "outletName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendantExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AttendantKPI" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "attendantId" TEXT NOT NULL,
    "outletName" TEXT NOT NULL,
    "sales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expenses" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "np" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salaryDay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roiVsSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wasteCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wastePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "depositExpected" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "depositActual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "depositGap" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalWeight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commissionTarget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commissionKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commissionAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "redFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendantKPI_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AttendantScope" (
    "id" TEXT NOT NULL,
    "codeNorm" TEXT NOT NULL,
    "outletName" TEXT NOT NULL,

    CONSTRAINT "AttendantScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AttendantTillCount" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "outletName" TEXT NOT NULL,
    "counted" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "AttendantTillCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChatraceSetting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "apiBase" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "fromPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatraceSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CommissionEarning" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "basis" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL,
    "calcDetail" JSON NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionEarning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CommissionRule" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "shopId" TEXT,
    "sku" TEXT,
    "category" TEXT,
    "type" TEXT NOT NULL,
    "rateDecimal" DECIMAL(6,4) NOT NULL,
    "effectiveFrom" TIMESTAMP(6) NOT NULL,
    "effectiveTo" TIMESTAMP(6),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Config" (
    "key" TEXT NOT NULL,
    "json" JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Config_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."CostCatalog" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "shopId" TEXT,
    "cost" DECIMAL(12,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(6) NOT NULL,
    "effectiveTo" TIMESTAMP(6),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DailyReport" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "productsCount" INTEGER NOT NULL,
    "totalSales" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "day" TEXT NOT NULL,
    "tasks" JSONB,
    "submittedBy" TEXT,
    "newProducts" INTEGER DEFAULT 0,
    "productsEdited" INTEGER DEFAULT 0,
    "copiesUploaded" INTEGER DEFAULT 0,
    "walkInServed" INTEGER DEFAULT 0,
    "purchasesMade" INTEGER DEFAULT 0,
    "liveSessionsCount" INTEGER DEFAULT 0,
    "commissionEarned" DECIMAL(12,2),
    "confirmedCompetitiveness" BOOLEAN DEFAULT false,
    "marketEngagement" JSONB,
    "concerns" TEXT,

    CONSTRAINT "DailyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JumiaAccount" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JumiaAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JumiaOrder" (
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
    "totalAmountLocalCurrency" TEXT,
    "totalAmountLocalValue" DOUBLE PRECISION,
    "shopName" TEXT,

    CONSTRAINT "JumiaOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JumiaShop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "lastOrdersUpdatedBefore" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JumiaShop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LoginCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "attendantId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MarketplaceAccount" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "platform" "public"."Platform" NOT NULL,
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
CREATE TABLE "public"."MarketplaceAccountAssignment" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "accountId" TEXT NOT NULL,
    "attendantId" TEXT NOT NULL,
    "role" "public"."MarketplaceAssignmentRole" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceAccountAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MarketplaceOrder" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "accountId" TEXT NOT NULL,
    "platform" "public"."Platform" NOT NULL,
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
CREATE TABLE "public"."MarketplacePayoutWeek" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
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
CREATE TABLE "public"."MarketplacePricingTemplate" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "platform" "public"."Platform" NOT NULL,
    "normalizedProductName" TEXT NOT NULL,
    "sellingPrice" DECIMAL(14,2) NOT NULL,
    "defaultBuyingPrice" DECIMAL(14,2) NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplacePricingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MarketplaceReturn" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "accountId" TEXT NOT NULL,
    "platform" "public"."Platform" NOT NULL,
    "marketplaceOrderId" TEXT,
    "orderItemId" TEXT NOT NULL,
    "attendantId" TEXT,
    "expectedAmount" DECIMAL(14,2) NOT NULL,
    "status" "public"."MarketplaceReturnStatus" NOT NULL DEFAULT 'WAITING_AT_HUB',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "processedById" TEXT,
    "processedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "MarketplaceReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MarketplaceReturnAttachment" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "returnId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceReturnAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OpsEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entity_id" TEXT,
    "outlet_id" TEXT,
    "supplier_id" TEXT,
    "actor_role" TEXT,
    "dedupe_key" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "handled_at" TIMESTAMPTZ(6),

    CONSTRAINT "OpsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrderCost" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "costSource" TEXT NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Outlet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Outlet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "outletCode" "public"."OutletCode" NOT NULL,
    "amount" INTEGER NOT NULL,
    "msisdn" TEXT NOT NULL,
    "status" "public"."PaymentStatus" DEFAULT 'PENDING',
    "merchantRequestId" TEXT,
    "checkoutRequestId" TEXT,
    "mpesaReceipt" TEXT,
    "businessShortCode" TEXT,
    "partyb" TEXT,
    "storeNumber" TEXT,
    "headOfficeNumber" TEXT,
    "accountReference" TEXT,
    "description" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "partyB" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PersonCode" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "code" TEXT NOT NULL,
    "role" "public"."PersonRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PersonCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PhoneMapping" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "outlet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhoneMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PricebookRow" (
    "id" TEXT NOT NULL,
    "outletName" TEXT NOT NULL,
    "productKey" TEXT NOT NULL,
    "sellPrice" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PricebookRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Product" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "sellPrice" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProfitSnapshot" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "revenue" DECIMAL(12,2) NOT NULL,
    "fees" DECIMAL(12,2) NOT NULL,
    "shipping" DECIMAL(12,2) NOT NULL,
    "refunds" DECIMAL(12,2) NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "qty" INTEGER NOT NULL,
    "profit" DECIMAL(12,2) NOT NULL,
    "computedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfitSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReturnAdjustment" (
    "id" TEXT NOT NULL,
    "returnCaseId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "commissionImpact" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReturnCase" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "reasonCode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "resolution" TEXT,
    "createdBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReturnEvidence" (
    "id" TEXT NOT NULL,
    "returnCaseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "takenBy" TEXT NOT NULL,
    "takenAt" TIMESTAMP(6) NOT NULL,
    "geo" JSON,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReturnPickup" (
    "id" TEXT NOT NULL,
    "returnCaseId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(6) NOT NULL,
    "carrier" TEXT NOT NULL,
    "tracking" TEXT,
    "assignedTo" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnPickup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReviewItem" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "outlet" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ScopeProduct" (
    "id" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "productKey" TEXT NOT NULL,

    CONSTRAINT "ScopeProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "attendantId" TEXT NOT NULL,
    "outletCode" TEXT,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Setting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SettlementRow" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "orderId" TEXT,
    "orderItemId" TEXT,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "ref" TEXT,
    "postedAt" TIMESTAMP(6) NOT NULL,
    "raw" JSON NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Shop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "platform" "public"."Platform" NOT NULL DEFAULT 'JUMIA',
    "credentialsEncrypted" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ShopApiConfig" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'JUMIA',
    "apiKey" TEXT NOT NULL,
    "apiSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopApiConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SupervisorCommission" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "outletName" TEXT NOT NULL,
    "supervisorCode" TEXT,
    "supervisorPhone" TEXT,
    "salesKsh" INTEGER NOT NULL DEFAULT 0,
    "expensesKsh" INTEGER NOT NULL DEFAULT 0,
    "wasteKsh" INTEGER NOT NULL DEFAULT 0,
    "profitKsh" INTEGER NOT NULL DEFAULT 0,
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "commissionKsh" INTEGER NOT NULL DEFAULT 0,
    "periodKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'calculated',
    "note" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupervisorCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SupplyOpeningRow" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "outletName" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "buyPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(6),
    "lockedBy" TEXT,

    CONSTRAINT "SupplyOpeningRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SupplyRequest" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outlet" TEXT NOT NULL,
    "productKey" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "requestedBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SupplyTransfer" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "fromOutletName" TEXT NOT NULL,
    "toOutletName" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplyTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Till" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "label" TEXT NOT NULL,
    "tillNumber" TEXT NOT NULL,
    "storeNumber" TEXT NOT NULL,
    "headOfficeNumber" TEXT NOT NULL,
    "outletCode" "public"."OutletCode" NOT NULL,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Till_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "role" "public"."Role" NOT NULL DEFAULT 'ATTENDANT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "password" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WaMessageLog" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "attendantId" TEXT,
    "direction" TEXT NOT NULL,
    "templateName" TEXT,
    "payload" JSONB NOT NULL,
    "waMessageId" TEXT,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT,

    CONSTRAINT "WaMessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WaSession" (
    "id" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "code" TEXT,
    "outlet" TEXT,
    "state" TEXT NOT NULL DEFAULT 'IDLE',
    "cursor" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "lastFinalizeAt" TIMESTAMP(3),

    CONSTRAINT "WaSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionLog_entity_entityId_idx" ON "public"."ActionLog"("entity" ASC, "entityId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ActivePeriod_outletName_key" ON "public"."ActivePeriod"("outletName" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ApiCredential_scope_shopId_key" ON "public"."ApiCredential"("scope" ASC, "shopId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Attendant_loginCode_key" ON "public"."Attendant"("loginCode" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AttendantAssignment_code_key" ON "public"."AttendantAssignment"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AttendantClosing_date_outletName_itemKey_key" ON "public"."AttendantClosing"("date" ASC, "outletName" ASC, "itemKey" ASC);

-- CreateIndex
CREATE INDEX "AttendantKPI_attendant_date_idx" ON "public"."AttendantKPI"("attendantId" ASC, "date" ASC);

-- CreateIndex
CREATE INDEX "AttendantKPI_outlet_date_idx" ON "public"."AttendantKPI"("outletName" ASC, "date" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "attendantkpi_date_attendant_outlet_uq" ON "public"."AttendantKPI"("date" ASC, "attendantId" ASC, "outletName" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AttendantScope_codeNorm_key" ON "public"."AttendantScope"("codeNorm" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AttendantTillCount_date_outletName_key" ON "public"."AttendantTillCount"("date" ASC, "outletName" ASC);

-- CreateIndex
CREATE INDEX "CommissionRule_scope_shopId_sku_category_effectiveFrom_idx" ON "public"."CommissionRule"("scope" ASC, "shopId" ASC, "sku" ASC, "category" ASC, "effectiveFrom" ASC);

-- CreateIndex
CREATE INDEX "CostCatalog_sku_shopId_effectiveFrom_idx" ON "public"."CostCatalog"("sku" ASC, "shopId" ASC, "effectiveFrom" ASC);

-- CreateIndex
CREATE INDEX "DailyReport_date_idx" ON "public"."DailyReport"("date" ASC);

-- CreateIndex
CREATE INDEX "DailyReport_userId_idx" ON "public"."DailyReport"("userId" ASC);

-- CreateIndex
CREATE INDEX "JumiaOrder_shopId_status_idx" ON "public"."JumiaOrder"("shopId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "JumiaShop_accountId_idx" ON "public"."JumiaShop"("accountId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "LoginCode_code_key" ON "public"."LoginCode"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceAccount_platform_jumiaShopSid_key" ON "public"."MarketplaceAccount"("platform" ASC, "jumiaShopSid" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceAccount_platform_kilimallShopCode_key" ON "public"."MarketplaceAccount"("platform" ASC, "kilimallShopCode" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceAccountAssignment_accountId_attendantId_role_key" ON "public"."MarketplaceAccountAssignment"("accountId" ASC, "attendantId" ASC, "role" ASC);

-- CreateIndex
CREATE INDEX "MarketplaceAccountAssignment_attendantId_role_idx" ON "public"."MarketplaceAccountAssignment"("attendantId" ASC, "role" ASC);

-- CreateIndex
CREATE INDEX "MarketplaceOrder_accountId_orderedAt_idx" ON "public"."MarketplaceOrder"("accountId" ASC, "orderedAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceOrder_platform_orderItemId_key" ON "public"."MarketplaceOrder"("platform" ASC, "orderItemId" ASC);

-- CreateIndex
CREATE INDEX "MarketplaceOrder_pricedById_idx" ON "public"."MarketplaceOrder"("pricedById" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplacePayoutWeek_accountId_statementNumber_key" ON "public"."MarketplacePayoutWeek"("accountId" ASC, "statementNumber" ASC);

-- CreateIndex
CREATE INDEX "MarketplacePayoutWeek_accountId_weekEnd_idx" ON "public"."MarketplacePayoutWeek"("accountId" ASC, "weekEnd" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplacePricingTemplate_platform_normalizedProductName_s_key" ON "public"."MarketplacePricingTemplate"("platform" ASC, "normalizedProductName" ASC, "sellingPrice" ASC);

-- CreateIndex
CREATE INDEX "MarketplaceReturn_attendantId_status_idx" ON "public"."MarketplaceReturn"("attendantId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "MarketplaceReturn_dueAt_status_idx" ON "public"."MarketplaceReturn"("dueAt" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceReturn_platform_orderItemId_key" ON "public"."MarketplaceReturn"("platform" ASC, "orderItemId" ASC);

-- CreateIndex
CREATE INDEX "MarketplaceReturnAttachment_returnId_idx" ON "public"."MarketplaceReturnAttachment"("returnId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Outlet_code_key" ON "public"."Outlet"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Outlet_name_key" ON "public"."Outlet"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_checkoutRequestId_key" ON "public"."Payment"("checkoutRequestId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PersonCode_code_key" ON "public"."PersonCode"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PhoneMapping_code_key" ON "public"."PhoneMapping"("code" ASC);

-- CreateIndex
CREATE INDEX "phonemapping_code_idx" ON "public"."PhoneMapping"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PricebookRow_outletName_productKey_key" ON "public"."PricebookRow"("outletName" ASC, "productKey" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Product_key_key" ON "public"."Product"("key" ASC);

-- CreateIndex
CREATE INDEX "ReturnCase_shopId_status_idx" ON "public"."ReturnCase"("shopId" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ScopeProduct_scopeId_productKey_key" ON "public"."ScopeProduct"("scopeId" ASC, "productKey" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "public"."Session"("token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "public"."Setting"("key" ASC);

-- CreateIndex
CREATE INDEX "SettlementRow_orderId_orderItemId_idx" ON "public"."SettlementRow"("orderId" ASC, "orderItemId" ASC);

-- CreateIndex
CREATE INDEX "SettlementRow_shopId_postedAt_idx" ON "public"."SettlementRow"("shopId" ASC, "postedAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ShopApiConfig_shopId_key" ON "public"."ShopApiConfig"("shopId" ASC);

-- CreateIndex
CREATE INDEX "SupervisorCommission_date_outlet_idx" ON "public"."SupervisorCommission"("date" ASC, "outletName" ASC);

-- CreateIndex
CREATE INDEX "SupervisorCommission_period_supervisor_idx" ON "public"."SupervisorCommission"("periodKey" ASC, "supervisorCode" ASC);

-- CreateIndex
CREATE INDEX "supervisorcommission_outlet_date_idx" ON "public"."SupervisorCommission"("outletName" ASC, "date" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SupplyOpeningRow_date_outletName_itemKey_key" ON "public"."SupplyOpeningRow"("date" ASC, "outletName" ASC, "itemKey" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Till_tillNumber_key" ON "public"."Till"("tillNumber" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "WaMessageLog_waMessageId_key" ON "public"."WaMessageLog"("waMessageId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "WaSession_phoneE164_key" ON "public"."WaSession"("phoneE164" ASC);

-- AddForeignKey
ALTER TABLE "public"."ApiCredential" ADD CONSTRAINT "ApiCredential_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "public"."Shop"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Attendant" ADD CONSTRAINT "Attendant_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "public"."Outlet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JumiaOrder" ADD CONSTRAINT "JumiaOrder_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "public"."JumiaShop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JumiaShop" ADD CONSTRAINT "JumiaShop_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."JumiaAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LoginCode" ADD CONSTRAINT "LoginCode_attendantId_fkey" FOREIGN KEY ("attendantId") REFERENCES "public"."Attendant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceAccountAssignment" ADD CONSTRAINT "MarketplaceAccountAssignment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."MarketplaceAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceAccountAssignment" ADD CONSTRAINT "MarketplaceAccountAssignment_attendantId_fkey" FOREIGN KEY ("attendantId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."MarketplaceAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_pricedById_fkey" FOREIGN KEY ("pricedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplacePayoutWeek" ADD CONSTRAINT "MarketplacePayoutWeek_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."MarketplaceAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplacePricingTemplate" ADD CONSTRAINT "MarketplacePricingTemplate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceReturn" ADD CONSTRAINT "MarketplaceReturn_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."MarketplaceAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceReturn" ADD CONSTRAINT "MarketplaceReturn_attendantId_fkey" FOREIGN KEY ("attendantId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceReturn" ADD CONSTRAINT "MarketplaceReturn_marketplaceOrderId_fkey" FOREIGN KEY ("marketplaceOrderId") REFERENCES "public"."MarketplaceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceReturn" ADD CONSTRAINT "MarketplaceReturn_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceReturnAttachment" ADD CONSTRAINT "MarketplaceReturnAttachment_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "public"."MarketplaceReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceReturnAttachment" ADD CONSTRAINT "MarketplaceReturnAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShopApiConfig" ADD CONSTRAINT "ShopApiConfig_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "public"."Shop"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

