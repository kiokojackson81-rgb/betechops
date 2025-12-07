-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SUPERVISOR', 'ATTENDANT');

-- CreateEnum
CREATE TYPE "PayFrequency" AS ENUM ('MONTHLY', 'PERIOD');

-- CreateEnum
CREATE TYPE "PayrollAdjustmentType" AS ENUM ('CHAMA', 'LATENESS', 'DISCIPLINE', 'BONUS', 'COMMISSION_TOPUP', 'OTHER');

-- CreateEnum
CREATE TYPE "AttendantCategory" AS ENUM ('DIRECT_SALES_OPS', 'MARKETING_OPS', 'JUMIA_KILIMALL_OPS', 'SUPPORT_OPS', 'BETECH_OPS');

-- CreateEnum
CREATE TYPE "ShopRoleAtShop" AS ENUM ('ATTENDANT', 'SUPERVISOR');

-- CreateEnum
CREATE TYPE "MarketplaceAssignmentRole" AS ENUM ('JUMIA_KILIMALL_OPS', 'SUPERVISOR');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'IN_TRANSIT', 'AT_HUB', 'PICKED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "MarketplaceReturnStatus" AS ENUM ('WAITING_AT_HUB', 'PICKED', 'CHARGED_TO_ATTENDANT');

-- CreateEnum
CREATE TYPE "PriceSource" AS ENUM ('MANUAL', 'LEARNED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'MPESA');

-- CreateEnum
CREATE TYPE "DiscrepancyType" AS ENUM ('ORDER_NOT_IN_PAYOUT', 'AMOUNT_MISMATCH', 'FEE_MISMATCH', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DiscrepancyStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PROCESSING', 'FULFILLED', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "AttendantCategory_new" AS ENUM ('junior', 'senior', 'assistant', 'manager');

-- CreateEnum
CREATE TYPE "DocType" AS ENUM ('RECEIPT', 'INVOICE', 'QUOTATION', 'LAYAWAY');

-- CreateEnum
CREATE TYPE "CommissionRecordStatus" AS ENUM ('PENDING', 'RELEASED');

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentStatus_new" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');
ALTER TABLE "public"."Payment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "paymentStatus" TYPE "PaymentStatus_new" USING ("paymentStatus"::text::"PaymentStatus_new");
ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
DROP TYPE "public"."PaymentStatus_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "ApiCredential" DROP CONSTRAINT "ApiCredential_shopId_fkey";

-- DropForeignKey
ALTER TABLE "Attendant" DROP CONSTRAINT "Attendant_outletId_fkey";

-- DropForeignKey
ALTER TABLE "JumiaOrder" DROP CONSTRAINT "JumiaOrder_shopId_fkey";

-- DropForeignKey
ALTER TABLE "JumiaShop" DROP CONSTRAINT "JumiaShop_accountId_fkey";

-- DropForeignKey
ALTER TABLE "LoginCode" DROP CONSTRAINT "LoginCode_attendantId_fkey";

-- DropForeignKey
ALTER TABLE "ShopApiConfig" DROP CONSTRAINT "ShopApiConfig_shopId_fkey";

-- DropIndex
DROP INDEX "Product_key_key";

-- AlterTable
ALTER TABLE "ActionLog" ALTER COLUMN "before" SET DATA TYPE JSONB,
ALTER COLUMN "after" SET DATA TYPE JSONB,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ApiCredential" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CommissionEarning" ALTER COLUMN "calcDetail" SET DATA TYPE JSONB,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CommissionRule" ALTER COLUMN "effectiveFrom" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "effectiveTo" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Config" ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CostCatalog" ALTER COLUMN "effectiveFrom" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "effectiveTo" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "JumiaAccount" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "JumiaOrder" ADD COLUMN     "shopName" TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "JumiaShop" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "OrderCost" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "active",
DROP COLUMN "key",
DROP COLUMN "sellPrice",
DROP COLUMN "unit",
ADD COLUMN     "category" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastBuyingPrice" DOUBLE PRECISION,
ADD COLUMN     "minStockLevel" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "sellingPrice" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "sku" TEXT NOT NULL,
ADD COLUMN     "stockQuantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "ProfitSnapshot" ALTER COLUMN "computedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ReturnAdjustment" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ReturnCase" ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "pickedAt" TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ReturnEvidence" ALTER COLUMN "takenAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "geo" SET DATA TYPE JSONB,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ReturnPickup" ALTER COLUMN "scheduledAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SettlementRow" ALTER COLUMN "postedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "raw" SET DATA TYPE JSONB,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Shop" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ShopApiConfig" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- DropTable
DROP TABLE "ActivePeriod";

-- DropTable
DROP TABLE "AppState";

-- DropTable
DROP TABLE "Attendant";

-- DropTable
DROP TABLE "AttendantAssignment";

-- DropTable
DROP TABLE "AttendantClosing";

-- DropTable
DROP TABLE "AttendantDeposit";

-- DropTable
DROP TABLE "AttendantExpense";

-- DropTable
DROP TABLE "AttendantKPI";

-- DropTable
DROP TABLE "AttendantScope";

-- DropTable
DROP TABLE "AttendantTillCount";

-- DropTable
DROP TABLE "ChatraceSetting";

-- DropTable
DROP TABLE "LoginCode";

-- DropTable
DROP TABLE "OpsEvent";

-- DropTable
DROP TABLE "Outlet";

-- DropTable
DROP TABLE "Payment";

-- DropTable
DROP TABLE "PersonCode";

-- DropTable
DROP TABLE "PhoneMapping";

-- DropTable
DROP TABLE "PricebookRow";

-- DropTable
DROP TABLE "ReviewItem";

-- DropTable
DROP TABLE "ScopeProduct";

-- DropTable
DROP TABLE "Session";

-- DropTable
DROP TABLE "Setting";

-- DropTable
DROP TABLE "SupervisorCommission";

-- DropTable
DROP TABLE "SupplyOpeningRow";

-- DropTable
DROP TABLE "SupplyRequest";

-- DropTable
DROP TABLE "SupplyTransfer";

-- DropTable
DROP TABLE "Till";

-- DropTable
DROP TABLE "WaMessageLog";

-- DropTable
DROP TABLE "WaSession";

-- DropEnum
DROP TYPE "DepositStatus";

-- DropEnum
DROP TYPE "OutletCode";

-- DropEnum
DROP TYPE "PersonRole";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'ATTENDANT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "attendantCategory" "AttendantCategory",
    "password" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendantActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "AttendantCategory" NOT NULL,
    "metric" TEXT NOT NULL,
    "numericValue" DECIMAL(18,2),
    "intValue" INTEGER,
    "notes" TEXT,
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendantActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendantCompPlan" (
    "id" TEXT NOT NULL,
    "attendantId" TEXT NOT NULL,
    "baseSalary" INTEGER NOT NULL,
    "frequency" "PayFrequency" NOT NULL DEFAULT 'PERIOD',
    "defaultChamaDeduction" INTEGER,
    "defaultOtherDeduction" INTEGER,
    "defaultTransportAllowance" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendantCompPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendantPayrollAdjustment" (
    "id" TEXT NOT NULL,
    "attendantId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "adjustmentType" "PayrollAdjustmentType" NOT NULL,
    "label" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendantPayrollAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailySale" (
    "id" TEXT NOT NULL,
    "dailyReportId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" "PaymentMethod",
    "receiptNumber" TEXT,

    CONSTRAINT "DailySale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingDailyEntry" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "totalSales" INTEGER NOT NULL DEFAULT 0,
    "totalProfit" INTEGER NOT NULL DEFAULT 0,
    "photoUrl" TEXT,
    "tiktokPosted2Videos" BOOLEAN,
    "tiktokRepliedAll" BOOLEAN,
    "igFbYtPosted2VideosEach" BOOLEAN,
    "igFbYtRepliedAll" BOOLEAN,
    "waPostedStatus" BOOLEAN,
    "waSavedContacts" BOOLEAN,
    "waRespondedAll" BOOLEAN,
    "waPosted10Statuses" BOOLEAN,
    "waSaved10Contacts" BOOLEAN,
    "stockEnoughFastMovers" BOOLEAN,
    "shot4ProductVideos" BOOLEAN,
    "tiktokPosted4ExplanatoryVideos" BOOLEAN,
    "liveViewers" INTEGER,
    "liveSessionsCount" INTEGER,
    "liveSessionsEstimatedViewers" INTEGER,
    "liveSessionDurationMinutes" INTEGER,
    "liveSessionPlatform" TEXT,
    "shopCleaned" BOOLEAN,
    "shopWellArranged" BOOLEAN,
    "displayWellLabeled" BOOLEAN,
    "weeklyComment" TEXT,
    "payload" JSONB,
    "submittedById" TEXT,
    "submittedByName" TEXT,
    "submittedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "weeklyMeetingAttended" BOOLEAN DEFAULT false,
    "weeklyVideoCount" INTEGER DEFAULT 0,
    "weeklyVideoShootParticipated" BOOLEAN DEFAULT false,

    CONSTRAINT "MarketingDailyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingSale" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "buyingPrice" INTEGER NOT NULL,
    "sellingPrice" INTEGER NOT NULL,
    "receiptNumber" TEXT,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemsCount" INTEGER NOT NULL DEFAULT 1,
    "dailySaleId" TEXT,

    CONSTRAINT "MarketingSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingReceipt" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dailyEntryId" TEXT NOT NULL,
    "receiptNumber" TEXT,
    "sellingTotal" INTEGER NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,

    CONSTRAINT "MarketingReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingReceiptItem" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "receiptId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "buyingPrice" INTEGER NOT NULL,

    CONSTRAINT "MarketingReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportDailyEntry" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "totalSales" INTEGER NOT NULL DEFAULT 0,
    "totalProfit" INTEGER NOT NULL DEFAULT 0,
    "newBatteries" INTEGER NOT NULL DEFAULT 0,
    "changedBatteries" INTEGER NOT NULL DEFAULT 0,
    "submittedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportDailyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportSale" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "buyingPrice" INTEGER NOT NULL,
    "sellingPrice" INTEGER NOT NULL,
    "receiptNumber" TEXT,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "itemsCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportReceipt" (
    "id" TEXT NOT NULL,
    "dailyEntryId" TEXT NOT NULL,
    "receiptNumber" TEXT,
    "sellingTotal" INTEGER NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportReceiptItem" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "buyingPrice" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "attendantId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "sellingPrice" DOUBLE PRECISION NOT NULL,
    "serial" TEXT,
    "warranty" TEXT,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionPeriod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionTier" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "minSales" DOUBLE PRECISION NOT NULL,
    "maxSales" DOUBLE PRECISION NOT NULL,
    "payoutFlat" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "CommissionTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendantCommission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "shopId" TEXT,
    "sales" DOUBLE PRECISION NOT NULL,
    "payout" DOUBLE PRECISION NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendantCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserShop" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "roleAtShop" "ShopRoleAtShop" NOT NULL,

    CONSTRAINT "UserShop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" "Role" NOT NULL,

    CONSTRAINT "ShopAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendantCategoryAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "AttendantCategory" NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendantCategoryAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCost" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "byUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "PriceSource" NOT NULL,

    CONSTRAINT "ProductCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "grossCommission" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "penalties" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netCommission" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Balance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "available" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "pending" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Balance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reconciliation" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "ordersCount" INTEGER NOT NULL,
    "payoutAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "variance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discrepancy" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" "DiscrepancyType" NOT NULL,
    "status" "DiscrepancyStatus" NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "Discrepancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FulfillmentAudit" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "payload" JSONB NOT NULL,
    "s3Bucket" TEXT,
    "s3Key" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "action" TEXT,

    CONSTRAINT "FulfillmentAudit_pkey" PRIMARY KEY ("id")
);

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
    "approx" BOOLEAN NOT NULL DEFAULT false,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogCounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRecord" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "attendantId" TEXT,
    "amount" DECIMAL(14,2),
    "status" "CommissionRecordStatus" NOT NULL DEFAULT 'PENDING',
    "periodId" TEXT,
    "releasedAt" TIMESTAMP(3),
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "docType" "DocType" NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT,
    "taxRate" DECIMAL(6,2),
    "discount" DECIMAL(12,2),
    "showTax" BOOLEAN NOT NULL DEFAULT false,
    "showDiscount" BOOLEAN NOT NULL DEFAULT false,
    "paymentDetailsShown" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "warrantyText" TEXT,
    "totals" JSONB,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptFile" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "key" TEXT,
    "url" TEXT NOT NULL,
    "contentType" TEXT,
    "size" INTEGER,
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "ReceiptFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LayawayPlan" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "deposit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LayawayPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LayawayPayment" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT,
    "ref" TEXT,

    CONSTRAINT "LayawayPayment_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "_ManagedBy" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ManagedBy_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AttendantActivity_userId_entryDate_idx" ON "AttendantActivity"("userId", "entryDate");

-- CreateIndex
CREATE INDEX "AttendantActivity_category_metric_entryDate_idx" ON "AttendantActivity"("category", "metric", "entryDate");

-- CreateIndex
CREATE UNIQUE INDEX "AttendantCompPlan_attendantId_key" ON "AttendantCompPlan"("attendantId");

-- CreateIndex
CREATE INDEX "AttendantPayrollAdjustment_attendantId_periodKey_idx" ON "AttendantPayrollAdjustment"("attendantId", "periodKey");

-- CreateIndex
CREATE INDEX "DailySale_dailyReportId_idx" ON "DailySale"("dailyReportId");

-- CreateIndex
CREATE INDEX "MarketingDailyEntry_date_idx" ON "MarketingDailyEntry"("date");

-- CreateIndex
CREATE INDEX "MarketingDailyEntry_dayOfWeek_idx" ON "MarketingDailyEntry"("dayOfWeek");

-- CreateIndex
CREATE INDEX "MarketingDailyEntry_submittedById_idx" ON "MarketingDailyEntry"("submittedById");

-- CreateIndex
CREATE INDEX "MarketingSale_entryId_idx" ON "MarketingSale"("entryId");

-- CreateIndex
CREATE INDEX "MarketingSale_dailySaleId_idx" ON "MarketingSale"("dailySaleId");

-- CreateIndex
CREATE INDEX "MarketingReceipt_dailyEntryId_idx" ON "MarketingReceipt"("dailyEntryId");

-- CreateIndex
CREATE INDEX "MarketingReceiptItem_receiptId_idx" ON "MarketingReceiptItem"("receiptId");

-- CreateIndex
CREATE INDEX "SupportDailyEntry_date_idx" ON "SupportDailyEntry"("date");

-- CreateIndex
CREATE INDEX "SupportDailyEntry_submittedById_idx" ON "SupportDailyEntry"("submittedById");

-- CreateIndex
CREATE INDEX "SupportSale_entryId_idx" ON "SupportSale"("entryId");

-- CreateIndex
CREATE INDEX "SupportReceipt_dailyEntryId_idx" ON "SupportReceipt"("dailyEntryId");

-- CreateIndex
CREATE INDEX "SupportReceiptItem_receiptId_idx" ON "SupportReceiptItem"("receiptId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "UserShop_userId_shopId_key" ON "UserShop"("userId", "shopId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopAssignment_userId_shopId_role_key" ON "ShopAssignment"("userId", "shopId", "role");

-- CreateIndex
CREATE INDEX "AttendantCategoryAssignment_category_idx" ON "AttendantCategoryAssignment"("category");

-- CreateIndex
CREATE UNIQUE INDEX "AttendantCategoryAssignment_userId_category_key" ON "AttendantCategoryAssignment"("userId", "category");

-- CreateIndex
CREATE INDEX "ProductCost_productId_idx" ON "ProductCost"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionLedger_userId_periodStart_periodEnd_key" ON "CommissionLedger"("userId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "Balance_userId_key" ON "Balance"("userId");

-- CreateIndex
CREATE INDEX "Balance_userId_idx" ON "Balance"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Reconciliation_shopId_day_key" ON "Reconciliation"("shopId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "FulfillmentAudit_idempotencyKey_key" ON "FulfillmentAudit"("idempotencyKey");

-- CreateIndex
CREATE INDEX "FulfillmentAudit_shopId_orderId_idx" ON "FulfillmentAudit"("shopId", "orderId");

-- CreateIndex
CREATE INDEX "CatalogCounters_scope_shopId_computedAt_idx" ON "CatalogCounters"("scope", "shopId", "computedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogCounters_scope_shopId_key" ON "CatalogCounters"("scope", "shopId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_orderId_key" ON "Receipt"("orderId");

-- CreateIndex
CREATE INDEX "ReceiptFile_receiptId_idx" ON "ReceiptFile"("receiptId");

-- CreateIndex
CREATE UNIQUE INDEX "LayawayPlan_orderId_key" ON "LayawayPlan"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceAccount_platform_jumiaShopSid_key" ON "MarketplaceAccount"("jumiaShopSid");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceAccount_platform_kilimallShopCode_key" ON "MarketplaceAccount"("kilimallShopCode");

-- CreateIndex
CREATE INDEX "MarketplaceAccount_platform_jumiaShopSid_idx" ON "MarketplaceAccount"("platform", "jumiaShopSid");

-- CreateIndex
CREATE INDEX "MarketplaceAccount_platform_kilimallShopCode_idx" ON "MarketplaceAccount"("platform", "kilimallShopCode");

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

-- CreateIndex
CREATE INDEX "_ManagedBy_B_index" ON "_ManagedBy"("B");

-- CreateIndex
CREATE INDEX "JumiaOrder_updatedAtJumia_idx" ON "JumiaOrder"("updatedAtJumia");

-- CreateIndex
CREATE INDEX "JumiaOrder_createdAtJumia_idx" ON "JumiaOrder"("createdAtJumia");

-- CreateIndex
CREATE INDEX "JumiaOrder_shopId_updatedAtJumia_idx" ON "JumiaOrder"("shopId", "updatedAtJumia");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- AddForeignKey
ALTER TABLE "AttendantActivity" ADD CONSTRAINT "AttendantActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendantCompPlan" ADD CONSTRAINT "AttendantCompPlan_attendantId_fkey" FOREIGN KEY ("attendantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendantPayrollAdjustment" ADD CONSTRAINT "AttendantPayrollAdjustment_attendantId_fkey" FOREIGN KEY ("attendantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySale" ADD CONSTRAINT "DailySale_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "DailyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingDailyEntry" ADD CONSTRAINT "MarketingDailyEntry_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingSale" ADD CONSTRAINT "MarketingSale_dailySaleId_fkey" FOREIGN KEY ("dailySaleId") REFERENCES "DailySale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingSale" ADD CONSTRAINT "MarketingSale_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "MarketingDailyEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingReceipt" ADD CONSTRAINT "MarketingReceipt_dailyEntryId_fkey" FOREIGN KEY ("dailyEntryId") REFERENCES "MarketingDailyEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingReceiptItem" ADD CONSTRAINT "MarketingReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "MarketingReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportDailyEntry" ADD CONSTRAINT "SupportDailyEntry_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportSale" ADD CONSTRAINT "SupportSale_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "SupportDailyEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportReceipt" ADD CONSTRAINT "SupportReceipt_dailyEntryId_fkey" FOREIGN KEY ("dailyEntryId") REFERENCES "SupportDailyEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportReceiptItem" ADD CONSTRAINT "SupportReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "SupportReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JumiaShop" ADD CONSTRAINT "JumiaShop_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "JumiaAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JumiaOrder" ADD CONSTRAINT "JumiaOrder_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "JumiaShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopApiConfig" ADD CONSTRAINT "ShopApiConfig_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_attendantId_fkey" FOREIGN KEY ("attendantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionTier" ADD CONSTRAINT "CommissionTier_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "CommissionPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendantCommission" ADD CONSTRAINT "AttendantCommission_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "CommissionPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendantCommission" ADD CONSTRAINT "AttendantCommission_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendantCommission" ADD CONSTRAINT "AttendantCommission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiCredential" ADD CONSTRAINT "ApiCredential_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCatalog" ADD CONSTRAINT "CostCatalog_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderCost" ADD CONSTRAINT "OrderCost_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementRow" ADD CONSTRAINT "SettlementRow_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementRow" ADD CONSTRAINT "SettlementRow_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementRow" ADD CONSTRAINT "SettlementRow_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfitSnapshot" ADD CONSTRAINT "ProfitSnapshot_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEarning" ADD CONSTRAINT "CommissionEarning_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEarning" ADD CONSTRAINT "CommissionEarning_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnCase" ADD CONSTRAINT "ReturnCase_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnCase" ADD CONSTRAINT "ReturnCase_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnCase" ADD CONSTRAINT "ReturnCase_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnCase" ADD CONSTRAINT "ReturnCase_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnCase" ADD CONSTRAINT "ReturnCase_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnPickup" ADD CONSTRAINT "ReturnPickup_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnPickup" ADD CONSTRAINT "ReturnPickup_returnCaseId_fkey" FOREIGN KEY ("returnCaseId") REFERENCES "ReturnCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnEvidence" ADD CONSTRAINT "ReturnEvidence_returnCaseId_fkey" FOREIGN KEY ("returnCaseId") REFERENCES "ReturnCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnEvidence" ADD CONSTRAINT "ReturnEvidence_takenBy_fkey" FOREIGN KEY ("takenBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnAdjustment" ADD CONSTRAINT "ReturnAdjustment_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnAdjustment" ADD CONSTRAINT "ReturnAdjustment_returnCaseId_fkey" FOREIGN KEY ("returnCaseId") REFERENCES "ReturnCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionLog" ADD CONSTRAINT "ActionLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserShop" ADD CONSTRAINT "UserShop_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserShop" ADD CONSTRAINT "UserShop_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopAssignment" ADD CONSTRAINT "ShopAssignment_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopAssignment" ADD CONSTRAINT "ShopAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendantCategoryAssignment" ADD CONSTRAINT "AttendantCategoryAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Balance" ADD CONSTRAINT "Balance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reconciliation" ADD CONSTRAINT "Reconciliation_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discrepancy" ADD CONSTRAINT "Discrepancy_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentAudit" ADD CONSTRAINT "FulfillmentAudit_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_attendantId_fkey" FOREIGN KEY ("attendantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptFile" ADD CONSTRAINT "ReceiptFile_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LayawayPlan" ADD CONSTRAINT "LayawayPlan_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LayawayPayment" ADD CONSTRAINT "LayawayPayment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LayawayPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "_ManagedBy" ADD CONSTRAINT "_ManagedBy_A_fkey" FOREIGN KEY ("A") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ManagedBy" ADD CONSTRAINT "_ManagedBy_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

