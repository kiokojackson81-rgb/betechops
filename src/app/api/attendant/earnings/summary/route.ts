import { NextResponse } from "next/server";
import { getEarningsSummaryForUser } from "@/lib/earningsSummary";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { summarizeMarketingReportsForPeriod } from "@/lib/marketingPeriodTotals";
import { getSupportPeriodAggregates } from "@/lib/supportEntries";
import { prisma } from "@/lib/prisma";
import { getOrCreateCommissionPeriod } from "@/lib/commission";
import { composeIdentityResponse, resolveTargetUserId } from "@/lib/resolveTargetUser";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const identity = await resolveTargetUserId(req, { allowedImpersonationRoles: ["ADMIN" as Role] });
  const meta = identity;
  const userId = identity.resolvedUserId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  await getOrCreateCommissionPeriod(now);
  const period = getTradingPeriodFor(now);

  const [summary, marketingSummary, supportSummary, ledger] = await Promise.all([
    getEarningsSummaryForUser({ userId }),
    summarizeMarketingReportsForPeriod({ userId, period }),
    getSupportPeriodAggregates({ userId, period }),
    prisma.commissionLedger.findUnique({
      where: {
        userId_periodStart_periodEnd: {
          userId,
          periodStart: period.start,
          periodEnd: period.end,
        },
      },
    }),
  ]);
  // Merge per-receipt maps from marketing and support to avoid double-counting
  const marketingPer = (marketingSummary as any)?.perReceipts ?? {};
  const supportPer = (supportSummary as any)?.perReceipts ?? {};
  const merged = new Map<string, { sales: number; profit: number; items: number; mpesa: number; cash: number }>();

  for (const [k, v] of Object.entries(marketingPer) as [string, any][]) {
    merged.set(k, { sales: v.sales ?? 0, profit: v.profit ?? 0, items: v.items ?? 0, mpesa: v.mpesa ?? 0, cash: v.cash ?? 0 });
  }
  for (const [k, v] of Object.entries(supportPer) as [string, any][]) {
    if (merged.has(k)) continue; // marketing wins
    merged.set(k, { sales: v.sales ?? 0, profit: v.profit ?? 0, items: v.items ?? 0, mpesa: v.mpesa ?? 0, cash: v.cash ?? 0 });
  }

  let combinedSales = 0;
  let combinedProfit = 0;
  let combinedItems = 0;
  let combinedReceipts = 0;
  const combinedPaymentStats = { totalSalesMpesa: 0, totalSalesCash: 0, countMpesaReceipts: 0, countCashReceipts: 0 };
  for (const [, v] of merged) {
    combinedSales += v.sales;
    combinedProfit += v.profit;
    combinedItems += v.items;
    combinedPaymentStats.totalSalesMpesa += v.mpesa;
    combinedPaymentStats.totalSalesCash += v.cash;
    if (v.mpesa > 0) combinedPaymentStats.countMpesaReceipts += 1;
    if (v.cash > 0) combinedPaymentStats.countCashReceipts += 1;
  }
  combinedReceipts = merged.size;

  const detail = ledger?.detail as Record<string, any> | undefined;
  const marketingCommission = detail && typeof detail === "object" ? Number(detail.marketing?.commission ?? 0) : 0;
  const supportCommission = detail && typeof detail === "object" ? Number(detail.support?.commission ?? 0) : 0;

  let salesCommission = marketingCommission + supportCommission;
  if (salesCommission === 0 && ledger) {
    salesCommission = Number(ledger.grossCommission ?? 0);
  }
  if (salesCommission === 0) {
    salesCommission = summary.salesCommission;
  }

  const grossCommission =
    salesCommission +
    summary.newProductCommission +
    summary.copiedCommission +
    summary.editedCommission +
    summary.commissionTopUpTotal;

  const totalEarnings = summary.baseSalary + summary.transportAllowance + grossCommission + summary.bonusTotal;
  const totalDeductions =
    summary.chamaTotal + summary.latenessTotal + summary.disciplineTotal + summary.otherDeductionsTotal;
  const netPay = totalEarnings - totalDeductions;

  const payload = {
    // expose canonical per-receipt keys for clients to dedupe local receipts
    perReceiptCanonicalKeys: Array.from(merged.keys()),
    ...summary,
    totalSales: combinedSales,
    totalProfit: combinedProfit,
    totalNewProducts: marketingSummary.totals.totalNewProducts,
    totalEditedProducts: marketingSummary.totals.totalEditedProducts,
    totalCopiedProducts: marketingSummary.totals.totalCopiedProducts,
    salesCommission,
    grossCommission,
    totalEarnings,
    totalDeductions,
    netPay,
    totalItems: combinedItems,
    totalReceipts: combinedReceipts,
    walkInsServed: marketingSummary.totals.walkInsServed,
    walkInsPurchased: marketingSummary.totals.walkInsPurchased,
    ledger: ledger
      ? {
          grossCommission: Number(ledger.grossCommission),
          netCommission: Number(ledger.netCommission),
          penalties: Number(ledger.penalties),
          detail: ledger.detail,
        }
      : null,
  };

  return NextResponse.json(composeIdentityResponse(meta, payload));
}
