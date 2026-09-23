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
  const aggregates = summary.aggregates;
  const usesPosProfit10 = commissionConfig.salesCommissionMode === "POS_PROFIT_10";
  // Support entries are a working record and can be created before a customer
  // pays. Commission must instead use the POS source of truth: only paid,
  // non-cancelled receipts assigned to this attendant, with recognised costs.
  const posSummary = await summarizePosReceiptsForPeriod({
    start: period.start,
    end: period.end,
    userId: auth.user.id,
    ownershipMode: "staffOnly",
    supportPricingScope: "any",
    profitRecognitionMode: "salesDate",
    paymentScope: "paidOnly",
  });
  const directCommission = attendantSummary.directSalesCommission;

  return NextResponse.json({
    period: {
      key: period.key,
      label: period.label,
      start: period.start.toISOString(),
      end: period.end.toISOString(),
    },
    aggregates: {
      ...aggregates,
      totalSales: Number(posSummary.totalSales ?? aggregates.totalSales),
      totalProfit: Number(posSummary.totalProfit ?? aggregates.totalProfit),
      totalReceipts: Number(posSummary.totalReceipts ?? aggregates.totalReceipts),
      totalItems: Number(posSummary.totalItems ?? aggregates.totalItems),
      batteryEarnings: (aggregates.newBatteries + aggregates.changedBatteries) * 70,
      commission: attendantSummary.totalCommission,
      recordedSales: attendantSummary.recordedSales,
      commissionEligibleSales: attendantSummary.commissionEligibleSales,
      receiptBreakdown: attendantSummary.receiptBreakdown,
      directCommission,
      nextTarget: null,
      commissionBreakdown: attendantSummary.breakdown,
    },
  });
}
