import { NextResponse } from "next/server";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import { requireAttendant } from "@/lib/auth";
import { getSupportPeriodAggregates } from "@/lib/supportEntries";
import { getOrCreateCommissionPeriod } from "@/lib/commission";
import getAttendantCommissionSummary from "@/lib/attendantCommission";
import { summarizePosReceiptsForPeriod } from "@/lib/posReceiptSummary";
import { getUserCommissionConfigLike } from "@/lib/userCommissionConfig";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAttendant(req, ["SUPPORT_OPS", "ADMIN"]);
  if (!auth.ok) return auth.res;

  let period = getTradingPeriodFor(new Date());
  try {
    const url = new URL(req.url);
    const periodKey = url.searchParams.get("periodKey");
    const parsedPeriod = parseTradingPeriodKey(periodKey ?? undefined);
    if (parsedPeriod) {
      period = parsedPeriod;
    }
    const dateParam = url.searchParams.get("date");
    if (!parsedPeriod && dateParam) {
      const parsed = new Date(dateParam);
      if (!Number.isNaN(parsed.getTime())) period = getTradingPeriodFor(parsed);
    }
  } catch {
    // ignore malformed URLs and fall back to current date
  }

  await getOrCreateCommissionPeriod(period.start);

  const [summary, attendantSummary, commissionConfig] = await Promise.all([
    getSupportPeriodAggregates({ userId: auth.user.id, period }),
    getAttendantCommissionSummary({ attendantId: auth.user.id, start: period.start, end: period.end }),
    getUserCommissionConfigLike(auth.user.id),
  ]);
  const posSummary = await summarizePosReceiptsForPeriod({
    start: period.start,
    end: period.end,
    userId: auth.user.id,
    ownershipMode: "staffOnly",
    supportPricingScope: "any",
    profitRecognitionMode: "salesDate",
    paymentScope: commissionConfig.salesCommissionMode === "POS_PROFIT_10" ? "all" : "paidOnly",
  });
  const aggregates = summary.aggregates;
  const usesPosProfit10 = commissionConfig.salesCommissionMode === "POS_PROFIT_10";
  const directCommission = usesPosProfit10
    ? Math.round(Math.max(0, Number(posSummary.totalProfit ?? 0)) * 0.1)
    : attendantSummary.directSalesCommission;

  return NextResponse.json({
    period: {
      key: period.key,
      label: period.label,
      start: period.start.toISOString(),
      end: period.end.toISOString(),
    },
    aggregates: {
      ...aggregates,
      totalSales: usesPosProfit10 ? Number(posSummary.totalSales ?? 0) : aggregates.totalSales,
      totalProfit: usesPosProfit10 ? Number(posSummary.totalProfit ?? 0) : aggregates.totalProfit,
      totalReceipts: usesPosProfit10 ? Number(posSummary.totalReceipts ?? 0) : aggregates.totalReceipts,
      totalItems: usesPosProfit10 ? Number(posSummary.totalItems ?? 0) : aggregates.totalItems,
      batteryEarnings: (aggregates.newBatteries + aggregates.changedBatteries) * 70,
      commission: usesPosProfit10 ? directCommission : attendantSummary.totalCommission,
      directCommission,
      nextTarget: null,
      commissionBreakdown: usesPosProfit10
        ? {
            ...(attendantSummary.breakdown ?? {}),
            direct: directCommission,
            total: directCommission,
            source: "POS_PROFIT_10",
          }
        : attendantSummary.breakdown ?? undefined,
    },
  });
}
