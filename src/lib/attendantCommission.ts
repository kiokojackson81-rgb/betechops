import { getOnlineOpsWindowForTradingPeriod } from "@/lib/onlineOpsWeeks";
import { getUserCommissionConfigLike } from "@/lib/userCommissionConfig";
import { nairobiDateKey } from "@/lib/tradingPeriod";
import type { ReceiptSalesBreakdown } from "@/lib/posReceiptSummary";
import { prisma } from "@/lib/prisma";
import { summarizePosReceiptsForPeriod } from "@/lib/posReceiptSummary";
import { getReleasedPosProductCommissionForStaffPeriod } from "@/lib/posProductCommission";
import { summarizeMarketingReportsForPeriod } from "@/lib/marketingPeriodTotals";
import { getAssignedMarketplaceSalesForPeriod } from "@/lib/onlineOps";
import { getOrCreateCommissionPeriod, computeProductCommissions, computeSalesCommissionFromTiers, computeJenifferProratedCommission } from "@/lib/commission";
import { computeOnlinePeriodCommission, computeBrendahDirectCommission } from "@/lib/onlineCommission";
import { type TradingPeriod } from "@/lib/tradingPeriod";

export type AttendantCommissionSummary = {
  attendantId: string;
  period: TradingPeriod;
  receiptsCount: number;
  totalItems: number;
  recordedSales: number;
  commissionEligibleSales: number;
  receiptBreakdown: ReceiptSalesBreakdown[];
  totalSales: number;
  totalProfit: number;
  directSalesCommission: number;
  marketplaceCommission: number;
  posProductCommission: number;
  newProductCommission: number;
  copiedCommission: number;
  editedCommission: number;
  commissionTopUpTotal: number;
  totalCommission: number;
  breakdown?: {
    direct?: number;
    marketplace?: number;
    posProduct?: number;
    productUpload?: number;
    adjustments?: number;
  };
};

function toDateOnlyKey(d: Date) {
  return nairobiDateKey(d);
}

export async function getAttendantCommissionSummary(opts: { attendantId: string; start: Date; end: Date; }) : Promise<AttendantCommissionSummary> {
  const { attendantId, start, end } = opts;
  const period: TradingPeriod = {
    start,
    end,
    label: `${start.toISOString()} – ${end.toISOString()}`,
    key: `${toDateOnlyKey(start)}_${toDateOnlyKey(end)}`,
  };

  // POS totals scoped strictly to staffOnly ownership (order.attendantId or data.attendantId)
  const posSummary = await summarizePosReceiptsForPeriod({
    start,
    end,
    userId: attendantId,
    ownershipMode: "staffOnly",
    supportPricingScope: "any",
    profitRecognitionMode: "salesDate",
  });

  // Released per-item POS product commissions for this staff period
  const posProductCommission = await getReleasedPosProductCommissionForStaffPeriod(attendantId, start, end);

  const user = await prisma.user.findUnique({ where: { id: attendantId }, select: { email: true } });
  const marketing = await summarizeMarketingReportsForPeriod({ userId: attendantId, userEmail: user?.email, period });
  const marketingTotals = marketing.totals || { totalNewProducts: 0, totalCopiedProducts: 0, totalEditedProducts: 0 } as any;
  const { newProductCommission, copiedCommission, editedCommission } = computeProductCommissions({
    newProducts: marketingTotals.totalNewProducts ?? 0,
    copiedProducts: marketingTotals.totalCopiedProducts ?? 0,
    editedProducts: marketingTotals.totalEditedProducts ?? 0,
  });

  // Marketplace assignment sales and computed marketplace commission
  const marketplaceWindow = getOnlineOpsWindowForTradingPeriod(period, new Date(), 4);
  const marketplace = await getAssignedMarketplaceSalesForPeriod(attendantId, marketplaceWindow);

  // Commission period and tiers
  const { tiers } = await getOrCreateCommissionPeriod(start);

  // Adjustments (commission top-ups etc.) — find attendantPayrollAdjustment for the period key variants
  const periodKeyDateOnly = period.key;
  const periodKeyIso = `${start.toISOString()}_${end.toISOString()}`;
  const legacyPeriodKeyIso = `${period.key.split("_")[0]}T00:00:00.000Z_${period.key.split("_")[1]}T23:59:59.999Z`;
  const adjustments = await prisma.attendantPayrollAdjustment.findMany({
    where: { attendantId, periodKey: { in: [periodKeyDateOnly, periodKeyIso, legacyPeriodKeyIso] } },
  });
  let commissionTopUpTotal = 0;
  for (const a of adjustments) {
    const amt = Number(a.amount ?? 0);
    const kind = String(a.adjustmentKind ?? "DEDUCTION").toUpperCase();
    const isAddition = kind === "ADDITION";
    if (a.adjustmentType === "COMMISSION_TOPUP") {
      commissionTopUpTotal += isAddition ? amt : -amt;
    }
  }

  // Compute direct + marketplace commission using onlineCommission rules, but using STAFF totals
  const config = await getUserCommissionConfigLike(attendantId);
  const calculateDirect = (sales: number, profit: number) => {
    switch (config.salesCommissionMode) {
      case "BRENDAH_DIRECT": return computeBrendahDirectCommission(sales, profit).amount;
      case "POS_PROFIT_10": return Math.round(Math.max(0, profit) * 0.1);
      case "JENIFFER_PRORATED": return Math.round(computeJenifferProratedCommission(sales, tiers).commission);
      default: return Math.round(computeSalesCommissionFromTiers(sales, profit, tiers as any, 0.05));
    }
  };
  const directSalesCommission = calculateDirect(posSummary.totalSales, posSummary.totalProfit);
  const onlinePeriod = computeOnlinePeriodCommission({ attendantId, periodStart: start, periodEnd: end,
    directSales: 0, directProfit: 0, jumiaSales: marketplace.totals?.jumiaSales ?? 0,
    kilimallSales: marketplace.totals?.kilimallSales ?? 0 }, { directCommissionMode: config.salesCommissionMode === "POS_PROFIT_10" ? "PROFIT_10" : "DEFAULT" });
  const marketplaceCommission = onlinePeriod.lines.filter(l => l.channel !== "DIRECT").reduce((sum, l) => sum + l.commission, 0);
  // Tier commissions are period-based. Show each receipt's incremental contribution
  // in recognition-date order; these contributions reconcile exactly to the total.
  let cumulativeSales = 0, cumulativeProfit = 0, previousCommission = calculateDirect(0, 0);
  const receiptBreakdown = [...posSummary.receiptBreakdown].sort((a, b) =>
    ((a.salesDate ?? a.createdAt)?.getTime() ?? 0) - ((b.salesDate ?? b.createdAt)?.getTime() ?? 0) || a.receiptId.localeCompare(b.receiptId)
  ).map(row => {
    if (!row.eligible) return { ...row, commission: 0 };
    cumulativeSales += row.eligibleSales;
    cumulativeProfit += row.profit;
    const next = calculateDirect(cumulativeSales, cumulativeProfit);
    const commission = next - previousCommission;
    previousCommission = next;
    return { ...row, commission };
  });

  const productUploadTotal = (newProductCommission ?? 0) + (copiedCommission ?? 0) + (editedCommission ?? 0);

  const totalCommission = Math.round(
    Number(directSalesCommission ?? 0) + Number(marketplaceCommission ?? 0) + Number(posProductCommission ?? 0) + Number(productUploadTotal ?? 0) + Number(commissionTopUpTotal ?? 0),
  );

  return {
    attendantId,
    period,
    recordedSales: posSummary.recordedSales,
    commissionEligibleSales: posSummary.totalSales,
    receiptBreakdown,
    receiptsCount: Number(posSummary.totalReceipts ?? 0),
    totalItems: Number(posSummary.totalItems ?? 0),
    totalSales: Number(posSummary.totalSales ?? 0),
    totalProfit: Number(posSummary.totalProfit ?? 0),
    directSalesCommission: Number(directSalesCommission ?? 0),
    marketplaceCommission: Number(marketplaceCommission ?? 0),
    posProductCommission: Number(posProductCommission ?? 0),
    newProductCommission: Number(newProductCommission ?? 0),
    copiedCommission: Number(copiedCommission ?? 0),
    editedCommission: Number(editedCommission ?? 0),
    commissionTopUpTotal: Number(commissionTopUpTotal ?? 0),
    totalCommission,
    breakdown: {
      direct: Number(directSalesCommission ?? 0),
      marketplace: Number(marketplaceCommission ?? 0),
      posProduct: Number(posProductCommission ?? 0),
      productUpload: Number(productUploadTotal ?? 0),
      adjustments: Number(commissionTopUpTotal ?? 0),
    },
  };
}

export default getAttendantCommissionSummary;
