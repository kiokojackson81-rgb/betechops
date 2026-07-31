import { summarizePosReceiptsForPeriod } from "@/lib/posReceiptSummary";
import { computeBrendahDirectCommission } from "@/lib/onlineCommission";
import type { TradingPeriod } from "@/lib/tradingPeriod";

export async function getBrendahCommissionForPeriod(userId: string, period: TradingPeriod) {
  const totals = await summarizePosReceiptsForPeriod({
    start: period.start,
    end: period.end,
    userId,
    ownershipMode: "staffOnly",
    supportPricingScope: "any",
    profitRecognitionMode: "salesDate",
  });
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
