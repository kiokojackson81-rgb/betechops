import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/nextAuth";
import { getEarningsSummaryForUser } from "@/lib/earningsSummary";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { summarizeMarketingReportsForPeriod } from "@/lib/marketingPeriodTotals";
import { getSupportPeriodAggregates } from "@/lib/supportEntries";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const impersonateId = url.searchParams.get("impersonateId");
  // `getServerSession` can return various session shapes depending on adapters.
  // Explicitly type as `any` so we can safely access `user` without TypeScript
  // complaining about missing properties in some environments.
  const session: any = await getServerSession(authOptions as any);
  const actorId = session?.user?.id;

  if (!actorId && !impersonateId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (impersonateId && session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = impersonateId ?? actorId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
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

  const supportTotals = supportSummary?.aggregates ?? {
    totalSales: 0,
    totalProfit: 0,
    totalReceipts: 0,
    totalItems: 0,
  };

  const combinedSales = marketingSummary.totals.totalSales + supportTotals.totalSales;
  const combinedProfit = marketingSummary.totals.totalProfit + supportTotals.totalProfit;
  const combinedItems = marketingSummary.totals.totalItems + supportTotals.totalItems;
  const combinedReceipts = marketingSummary.totals.totalReceipts + supportTotals.totalReceipts;

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

  return NextResponse.json({
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
  });
}
