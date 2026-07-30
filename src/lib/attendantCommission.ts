import { prisma } from "@/lib/prisma";
import { summarizePosReceiptsForPeriod } from "@/lib/posReceiptSummary";
import { getReleasedPosProductCommissionForStaffPeriod } from "@/lib/posProductCommission";
import { summarizeMarketingReportsForPeriod } from "@/lib/marketingPeriodTotals";
import { getAssignedMarketplaceSalesForPeriod } from "@/lib/onlineOps";
import { getOrCreateCommissionPeriod, computeProductCommissions, computeSalesCommissionFromTiers, computeJenifferProratedCommission } from "@/lib/commission";
import { computeOnlinePeriodCommission, resolveDirectCommissionMode, computeBrendahDirectCommission } from "@/lib/onlineCommission";
import { getTradingPeriodFor, type TradingPeriod } from "@/lib/tradingPeriod";

export type AttendantCommissionSummary = {
  attendantId: string;
  period: TradingPeriod;
  receiptsCount: number;
  totalItems: number;
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
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

  // Marketing totals (new/edited/copied products}
  const marketing = await summarizeMarketingReportsForPeriod({ userId: attendantId, period });
  const marketingTotals = marketing.totals || { totalNewProducts: 0, totalCopiedProducts: 0, totalEditedProducts: 0 } as any;
  const { newProductCommission, copiedCommission, editedCommission } = computeProductCommissions({
    newProducts: marketingTotals.totalNewProducts ?? 0,
    copiedProducts: marketingTotals.totalCopiedProducts ?? 0,
    editedProducts: marketingTotals.totalEditedProducts ?? 0,
  });

  // Marketplace assignment sales and computed marketplace commission
  const marketplace = await getAssignedMarketplaceSalesForPeriod(attendantId, period);

  // Commission period and tiers
  const { tiers } = await getOrCreateCommissionPeriod(start);

  // Adjustments (commission top-ups etc.) — find attendantPayrollAdjustment for the period key variants
  const periodKeyDateOnly = period.key;
  const periodKeyIso = `${start.toISOString()}_${end.toISOString()}`;
  const adjustments = await prisma.attendantPayrollAdjustment.findMany({
    where: { attendantId, periodKey: { in: [periodKeyDateOnly, periodKeyIso] } },
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
  const user = await prisma.user.findUnique({ where: { id: attendantId }, select: { email: true } });
  const directMode = resolveDirectCommissionMode(user?.email ?? null);

  // For PROFIT_10 and combined marketplace handling we use computeOnlinePeriodCommission
  const periodInputs = {
    attendantId,
    periodStart: start,
    periodEnd: end,
    directSales: posSummary.totalSales ?? 0,
    directProfit: posSummary.totalProfit ?? 0,
    jumiaSales: marketplace.totals?.jumiaSales ?? 0,
    kilimallSales: marketplace.totals?.kilimallSales ?? 0,
  } as any;

  const onlinePeriod = computeOnlinePeriodCommission(periodInputs, { directCommissionMode: directMode });
  let directSalesCommission = onlinePeriod.lines.find((l) => l.channel === "DIRECT")?.commission ?? 0;
  const marketplaceCommission = (onlinePeriod.lines.find((l) => l.channel === "JUMIA")?.commission ?? 0) + (onlinePeriod.lines.find((l) => l.channel === "KILIMALL")?.commission ?? 0);

  // Special Brendah handling: ensure computed as per Brendah formula
  if (directMode === "BRENDAH") {
    directSalesCommission = computeBrendahDirectCommission(posSummary.totalSales ?? 0, posSummary.totalProfit ?? 0).amount;
  }

  // Fallback: compute sales commission from tiers when appropriate
  let salesCommissionFromTiers = computeSalesCommissionFromTiers(Number(posSummary.totalSales ?? 0), Number(posSummary.totalProfit ?? 0), tiers as any, 0.05);

  // For Jeniffer prorated mode, compute special progress
  if (directMode === "DEFAULT") {
    // Prefer tier-based value
    // choose the tiered value rounded
    directSalesCommission = Math.round(salesCommissionFromTiers);
  }

  const productUploadTotal = (newProductCommission ?? 0) + (copiedCommission ?? 0) + (editedCommission ?? 0);

  const totalCommission = Math.round(
    Number(directSalesCommission ?? 0) + Number(marketplaceCommission ?? 0) + Number(posProductCommission ?? 0) + Number(productUploadTotal ?? 0) + Number(commissionTopUpTotal ?? 0),
  );

  return {
    attendantId,
    period,
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
