/*
  Warnings:

  - The `status` column on the `Discrepancy` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Made the column `grossCommission` on table `CommissionLedger` required. This step will fail if there are existing NULL values in that column.
  - Made the column `penalties` on table `CommissionLedger` required. This step will fail if there are existing NULL values in that column.
  - Made the column `netCommission` on table `CommissionLedger` required. This step will fail if there are existing NULL values in that column.
  - Changed the type of `kind` on the `Discrepancy` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `amount` on table `Discrepancy` required. This step will fail if there are existing NULL values in that column.
  - Made the column `idempotencyKey` on table `FulfillmentAudit` required. This step will fail if there are existing NULL values in that column.
  - Changed the type of `source` on the `ProductCost` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `payoutAmount` on table `Reconciliation` required. This step will fail if there are existing NULL values in that column.
  - Made the column `variance` on table `Reconciliation` required. This step will fail if there are existing NULL values in that column.
  - Changed the type of `role` on the `ShopAssignment` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `roleAtShop` on the `UserShop` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ShopRoleAtShop" AS ENUM ('ATTENDANT', 'SUPERVISOR');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'IN_TRANSIT', 'AT_HUB', 'PICKED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "PriceSource" AS ENUM ('MANUAL', 'LEARNED');

-- CreateEnum
CREATE TYPE "DiscrepancyType" AS ENUM ('ORDER_NOT_IN_PAYOUT', 'AMOUNT_MISMATCH', 'FEE_MISMATCH', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DiscrepancyStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');

-- DropForeignKey
ALTER TABLE "public"."AttendantActivity" DROP CONSTRAINT "AttendantActivity_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."AttendantCategoryAssignment" DROP CONSTRAINT "AttendantCategoryAssignment_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Discrepancy" DROP CONSTRAINT "fk_discrepancy_shop";

-- DropForeignKey
ALTER TABLE "public"."FulfillmentAudit" DROP CONSTRAINT "fk_fulfill_shop";

-- DropForeignKey
ALTER TABLE "public"."JumiaOrder" DROP CONSTRAINT "JumiaOrder_shopId_fkey";

-- DropForeignKey
ALTER TABLE "public"."JumiaShop" DROP CONSTRAINT "JumiaShop_accountId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Reconciliation" DROP CONSTRAINT "fk_recon_shop";

-- DropForeignKey
ALTER TABLE "public"."ShopAssignment" DROP CONSTRAINT "fk_shopassignment_shop";

-- DropForeignKey
ALTER TABLE "public"."ShopAssignment" DROP CONSTRAINT "fk_shopassignment_user";

-- DropForeignKey
ALTER TABLE "public"."UserShop" DROP CONSTRAINT "fk_usershop_shop";

-- DropForeignKey
ALTER TABLE "public"."UserShop" DROP CONSTRAINT "fk_usershop_user";

-- AlterTable
ALTER TABLE "ActionLog" ALTER COLUMN "before" SET DATA TYPE JSONB,
ALTER COLUMN "after" SET DATA TYPE JSONB,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AttendantActivity" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "entryDate" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AttendantCategoryAssignment" ALTER COLUMN "assignedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CommissionEarning" ALTER COLUMN "calcDetail" SET DATA TYPE JSONB,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CommissionLedger" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "periodStart" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "periodEnd" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "grossCommission" SET NOT NULL,
ALTER COLUMN "penalties" SET NOT NULL,
ALTER COLUMN "netCommission" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CommissionRule" ALTER COLUMN "effectiveFrom" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "effectiveTo" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CostCatalog" ALTER COLUMN "effectiveFrom" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "effectiveTo" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Discrepancy" ALTER COLUMN "id" DROP DEFAULT,
DROP COLUMN "kind",
ADD COLUMN     "kind" "DiscrepancyType" NOT NULL,
ALTER COLUMN "amount" SET NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "DiscrepancyStatus" NOT NULL DEFAULT 'OPEN',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "FulfillmentAudit" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "idempotencyKey" SET NOT NULL,
ALTER COLUMN "ok" DROP DEFAULT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "JumiaAccount" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "JumiaOrder" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "JumiaShop" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "OrderCost" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProductCost" ALTER COLUMN "id" DROP DEFAULT,
DROP COLUMN "source",
ADD COLUMN     "source" "PriceSource" NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProfitSnapshot" ALTER COLUMN "computedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Reconciliation" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "day" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "payoutAmount" SET NOT NULL,
ALTER COLUMN "variance" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ReturnAdjustment" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ReturnCase" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "dueAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "pickedAt" SET DATA TYPE TIMESTAMP(3);

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
ALTER TABLE "ShopAssignment" ALTER COLUMN "id" DROP DEFAULT,
DROP COLUMN "role",
ADD COLUMN     "role" "Role" NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UserShop" ALTER COLUMN "id" DROP DEFAULT,
DROP COLUMN "roleAtShop",
ADD COLUMN     "roleAtShop" "ShopRoleAtShop" NOT NULL;

-- CreateTable
CREATE TABLE "DailyReport" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "productsCount" INTEGER NOT NULL,
    "totalSales" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyReport_date_idx" ON "DailyReport"("date");

-- CreateIndex
CREATE INDEX "DailyReport_userId_idx" ON "DailyReport"("userId");

-- CreateIndex
CREATE INDEX "JumiaOrder_updatedAtJumia_idx" ON "JumiaOrder"("updatedAtJumia");

-- CreateIndex
CREATE INDEX "JumiaOrder_createdAtJumia_idx" ON "JumiaOrder"("createdAtJumia");

-- CreateIndex
CREATE INDEX "JumiaOrder_shopId_updatedAtJumia_idx" ON "JumiaOrder"("shopId", "updatedAtJumia");

-- CreateIndex
CREATE UNIQUE INDEX "ShopAssignment_userId_shopId_role_key" ON "ShopAssignment"("userId", "shopId", "role");

-- AddForeignKey
ALTER TABLE "AttendantActivity" ADD CONSTRAINT "AttendantActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JumiaShop" ADD CONSTRAINT "JumiaShop_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "JumiaAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JumiaOrder" ADD CONSTRAINT "JumiaOrder_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "JumiaShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCatalog" ADD CONSTRAINT "CostCatalog_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderCost" ADD CONSTRAINT "OrderCost_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementRow" ADD CONSTRAINT "SettlementRow_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementRow" ADD CONSTRAINT "SettlementRow_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementRow" ADD CONSTRAINT "SettlementRow_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfitSnapshot" ADD CONSTRAINT "ProfitSnapshot_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEarning" ADD CONSTRAINT "CommissionEarning_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEarning" ADD CONSTRAINT "CommissionEarning_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnCase" ADD CONSTRAINT "ReturnCase_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnCase" ADD CONSTRAINT "ReturnCase_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnCase" ADD CONSTRAINT "ReturnCase_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnCase" ADD CONSTRAINT "ReturnCase_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnCase" ADD CONSTRAINT "ReturnCase_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnPickup" ADD CONSTRAINT "ReturnPickup_returnCaseId_fkey" FOREIGN KEY ("returnCaseId") REFERENCES "ReturnCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnPickup" ADD CONSTRAINT "ReturnPickup_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnEvidence" ADD CONSTRAINT "ReturnEvidence_returnCaseId_fkey" FOREIGN KEY ("returnCaseId") REFERENCES "ReturnCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnEvidence" ADD CONSTRAINT "ReturnEvidence_takenBy_fkey" FOREIGN KEY ("takenBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnAdjustment" ADD CONSTRAINT "ReturnAdjustment_returnCaseId_fkey" FOREIGN KEY ("returnCaseId") REFERENCES "ReturnCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnAdjustment" ADD CONSTRAINT "ReturnAdjustment_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionLog" ADD CONSTRAINT "ActionLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserShop" ADD CONSTRAINT "UserShop_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserShop" ADD CONSTRAINT "UserShop_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopAssignment" ADD CONSTRAINT "ShopAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopAssignment" ADD CONSTRAINT "ShopAssignment_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendantCategoryAssignment" ADD CONSTRAINT "AttendantCategoryAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reconciliation" ADD CONSTRAINT "Reconciliation_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discrepancy" ADD CONSTRAINT "Discrepancy_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentAudit" ADD CONSTRAINT "FulfillmentAudit_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "FulfillmentAudit_shop_order_idx" RENAME TO "FulfillmentAudit_shopId_orderId_idx";

-- RenameIndex
ALTER INDEX "ProductCost_product_idx" RENAME TO "ProductCost_productId_idx";

-- RenameIndex
ALTER INDEX "Reconciliation_shop_day_unique" RENAME TO "Reconciliation_shopId_day_key";

-- RenameIndex (safe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'i' AND relname = 'ShopAssignment_user_shop_role_unique') THEN
    ALTER INDEX "ShopAssignment_user_shop_role_unique" RENAME TO "ShopAssignment_userId_shopId_role_key";
  END IF;
END$$;

-- RenameIndex
ALTER INDEX "UserShop_user_shop_unique" RENAME TO "UserShop_userId_shopId_key";
