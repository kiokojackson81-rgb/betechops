import { summarizeMarketingReportsForPeriod } from "@/lib/marketingPeriodTotals";
import { computeBrendahDirectCommission } from "@/lib/onlineCommission";
import type { TradingPeriod } from "@/lib/tradingPeriod";

export async function getBrendahCommissionForPeriod(userId: string, period: TradingPeriod) {
  const { totals } = await summarizeMarketingReportsForPeriod({ userId, period });
  const totalSales = Number(totals.totalSales ?? 0);
  const totalProfit = Number(totals.totalProfit ?? 0);
  const totalReceipts = Number(totals.totalReceipts ?? 0);
  const result = computeBrendahDirectCommission(totalSales, totalProfit);

  return {
    totalSales,
    totalProfit,
    totalReceipts,
    commission: result.amount,
    commissionMode: result.mode,
    commissionReason: result.reason,
    periodKey: period.key,
  };
}
