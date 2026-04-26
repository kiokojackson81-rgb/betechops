import { prisma } from "@/lib/prisma";
import type { TradingPeriod } from "@/lib/tradingPeriod";
import { getPeriodKeyVariantsFromDates } from "@/lib/payrollPeriodKey";
import { getEarningsSummaryForUser } from "@/lib/earningsSummary";
import { getOnlineEarningsSummary } from "@/lib/onlineOps";
import {
  resolveDirectCommissionMode,
  resolveOnlinePosOwnershipMode,
  computeBrendahDirectCommission,
} from "@/lib/onlineCommission";
import { summarizePosReceiptsForPeriod } from "@/lib/posReceiptSummary";
import { computeAdminReceiptSummary } from "@/lib/adminReceiptsSummary";
import {
  computeJenifferProratedCommission,
  computeSalesCommissionFromTiers,
  getOrCreateCommissionPeriod,
} from "@/lib/commission";
import { getUserCommissionConfigLike } from "@/lib/userCommissionConfig";
import type { AdjustmentBreakdown, AdjustmentEntry, AdjustmentKind, PayrollRow } from "@/app/admin/payroll/types";

type AttendantRecord = {
  id: string;
  name?: string | null;
  email?: string | null;
  attendantCategory?: string | null;
  isActive: boolean;
};

function baseAdjustmentSummary() {
  return {
    totalBonus: 0,
    totalDeduction: 0,
    breakdown: {
      chama: 0,
      lateness: 0,
      discipline: 0,
      other: 0,
      bonus: 0,
      commissionTopUp: 0,
      penalties: 0,
    } satisfies AdjustmentBreakdown,
    entries: [] as AdjustmentEntry[],
  };
}

function summarizeAdjustments(adjustments: Array<{
  id: string;
  label: string;
  amount: number | null;
  adjustmentType: string;
  adjustmentKind?: string | null;
}>) {
  const summary = baseAdjustmentSummary();

  for (const adjustment of adjustments) {
    const amount = Number(adjustment.amount ?? 0);
    const bonusType = adjustment.adjustmentType === "BONUS";
    const topUpType = adjustment.adjustmentType === "COMMISSION_TOPUP";
    const deductionType =
      adjustment.adjustmentType === "CHAMA" ||
      adjustment.adjustmentType === "LATENESS" ||
      adjustment.adjustmentType === "DISCIPLINE" ||
      adjustment.adjustmentType === "OTHER";
    const kind =
      (adjustment.adjustmentKind as AdjustmentKind | undefined) ??
      (bonusType || topUpType ? "ADDITION" : "DEDUCTION");

    summary.entries.push({
      id: adjustment.id,
      label: adjustment.label,
      amount,
      adjustmentType: adjustment.adjustmentType,
      kind,
    });

    if (kind === "ADDITION") {
      if (bonusType) {
        summary.totalBonus += amount;
        summary.breakdown.bonus += amount;
      } else if (topUpType) {
        summary.totalBonus += amount;
        summary.breakdown.commissionTopUp += amount;
      } else if (adjustment.adjustmentType === "CHAMA") {
        summary.totalDeduction -= amount;
        summary.breakdown.chama -= amount;
      } else if (adjustment.adjustmentType === "LATENESS") {
        summary.totalDeduction -= amount;
        summary.breakdown.lateness -= amount;
      } else if (adjustment.adjustmentType === "DISCIPLINE") {
        summary.totalDeduction -= amount;
        summary.breakdown.discipline -= amount;
      } else if (adjustment.adjustmentType === "OTHER") {
        summary.totalDeduction -= amount;
        summary.breakdown.other -= amount;
      } else {
        summary.totalBonus += amount;
        summary.breakdown.bonus += amount;
      }
      continue;
    }

    if (bonusType) {
      summary.totalBonus -= amount;
      summary.breakdown.bonus -= amount;
    } else if (topUpType) {
      summary.totalBonus -= amount;
      summary.breakdown.commissionTopUp -= amount;
    } else if (deductionType) {
      summary.totalDeduction += amount;
      if (adjustment.adjustmentType === "CHAMA") summary.breakdown.chama += amount;
      else if (adjustment.adjustmentType === "LATENESS") summary.breakdown.lateness += amount;
      else if (adjustment.adjustmentType === "DISCIPLINE") summary.breakdown.discipline += amount;
      else summary.breakdown.other += amount;
    } else {
      summary.totalDeduction += amount;
      summary.breakdown.other += amount;
    }
  }

  return summary;
}

function isOnlineCategory(category?: string | null) {
  return category === "JUMIA_KILIMALL_OPS" || category === "BETECH_OPS";
}

function isDirectSalesCategory(category?: string | null) {
  return category === "DIRECT_SALES_OPS";
}

function isMarketingCategory(category?: string | null) {
  return category === "MARKETING_OPS";
}

async function buildTieredSalesPayrollRow(args: {
  attendant: AttendantRecord;
  period: TradingPeriod;
  adjustmentSummary: ReturnType<typeof summarizeAdjustments>;
  penalties: number;
}): Promise<PayrollRow> {
  const { attendant, period, adjustmentSummary, penalties } = args;
  const [earningsSummary, receiptSummary, commissionConfig, commissionPeriod] = await Promise.all([
    getEarningsSummaryForUser({ userId: attendant.id, asOf: period.start }),
    computeAdminReceiptSummary({
      start: period.start,
      end: period.end,
      scope: "mine",
      currentUserId: attendant.id,
      attendantId: attendant.id,
      salesOnly: true,
    }),
    getUserCommissionConfigLike(attendant.id),
    getOrCreateCommissionPeriod(period.start),
  ]);

  const totalSales = Math.max(Number(receiptSummary.totalSales ?? 0), Number(earningsSummary.totalSales ?? 0));
  const totalProfit = Math.max(Number(receiptSummary.totalProfit ?? 0), Number(earningsSummary.totalProfit ?? 0));
  const totalReceipts = Math.max(Number(receiptSummary.receiptsCount ?? 0), Number(earningsSummary.totalReceipts ?? 0));
  const totalItems = Math.max(Number(receiptSummary.itemsCount ?? 0), Number(earningsSummary.totalItems ?? 0));
  const tiers = commissionPeriod.tiers.map((tier) => ({
    minSales: Number(tier.minSales),
    maxSales: tier.maxSales == null ? Number(tier.minSales) : Number(tier.maxSales),
    payoutFlat: Number(tier.payoutFlat),
  }));
  const salesCommission =
    commissionConfig.salesCommissionMode === "JENIFFER_PRORATED"
      ? Number(computeJenifferProratedCommission(totalSales, tiers).commission ?? 0)
      : commissionConfig.salesCommissionMode === "BRENDAH_DIRECT"
        ? Number(computeBrendahDirectCommission(totalSales, totalProfit).amount ?? 0)
        : Number(computeSalesCommissionFromTiers(totalSales, totalProfit, tiers, totalProfit > 0 ? 0.05 : 0));
  const productWorkCommission =
    Number(earningsSummary.newProductCommission ?? 0) +
    Number(earningsSummary.copiedCommission ?? 0) +
    Number(earningsSummary.editedCommission ?? 0);
  const commissionTotal = salesCommission + productWorkCommission;
  const totalEarnings =
    Number(earningsSummary.baseSalary ?? 0) +
    Number(earningsSummary.transportAllowance ?? 0) +
    commissionTotal +
    adjustmentSummary.totalBonus;
  const totalDeductions = adjustmentSummary.totalDeduction + penalties;

  return {
    attendantId: attendant.id,
    name: attendant.name,
    email: attendant.email,
    attendantCategory: attendant.attendantCategory,
    isActive: attendant.isActive,
    baseSalary: Number(earningsSummary.baseSalary ?? 0),
    transportAllowance: Number(earningsSummary.transportAllowance ?? 0),
    commission: commissionTotal,
    commissionGross: commissionTotal,
    commissionDirect: salesCommission,
    commissionMarketplaceJumia: 0,
    commissionMarketplaceKilimall: 0,
    commissionTotal,
    commissionBreakdown: {
      direct: salesCommission,
      productWork: productWorkCommission,
      total: commissionTotal,
    },
    bonusTotal: adjustmentSummary.totalBonus,
    deductionTotal: totalDeductions,
    totalEarnings,
    totalDeductions,
    netPay: totalEarnings - totalDeductions,
    totalSales,
    totalProfit,
    totalReceipts,
    totalItems,
    newProducts: Number(earningsSummary.totalNewProducts ?? 0),
    editedProducts: Number(earningsSummary.totalEditedProducts ?? 0),
    copiedProducts: Number(earningsSummary.totalCopiedProducts ?? 0),
    adjustmentBreakdown: adjustmentSummary.breakdown,
    adjustmentEntries: adjustmentSummary.entries,
  };
}

export async function buildPayrollRow(attendant: AttendantRecord, period: TradingPeriod): Promise<PayrollRow> {
  const periodKeyVariants = getPeriodKeyVariantsFromDates(period.start, period.end);
  const [plan, ledger, adjustments] = await Promise.all([
    prisma.attendantCompPlan.findUnique({ where: { attendantId: attendant.id } }),
    prisma.commissionLedger.findUnique({
      where: {
        userId_periodStart_periodEnd: {
          userId: attendant.id,
          periodStart: period.start,
          periodEnd: period.end,
        },
      },
    }),
    prisma.attendantPayrollAdjustment.findMany({
      where: { attendantId: attendant.id, periodKey: { in: periodKeyVariants } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const adjustmentSummary = summarizeAdjustments(adjustments as any[]);
  const penalties = Number(ledger?.penalties ?? 0);
  adjustmentSummary.breakdown.penalties = penalties;

  if (isOnlineCategory(attendant.attendantCategory)) {
    const [onlineSummary, posSummary] = await Promise.all([
      getOnlineEarningsSummary(attendant.id, { period }),
      summarizePosReceiptsForPeriod({
        start: period.start,
        end: period.end,
        userId: attendant.id,
        ownershipMode: resolveOnlinePosOwnershipMode(attendant.email),
        supportPricingScope: "any",
        profitRecognitionMode: "salesDate",
      }),
    ]);

    const directMode = resolveDirectCommissionMode(attendant.email);
    let directCommission = Number((onlineSummary as any).commissionDirect ?? onlineSummary.directCommission ?? 0);
    let jumiaCommission = Number((onlineSummary as any).commissionMarketplaceJumia ?? 0);
    let kilimallCommission = Number((onlineSummary as any).commissionMarketplaceKilimall ?? 0);
    let commissionTotal = Number(onlineSummary.commissionTotal ?? onlineSummary.grossCommission ?? 0);

    if (directMode !== "PROFIT_10" && ledger && Number(ledger.commissionTotal ?? 0) > 0) {
      commissionTotal = Number(ledger.commissionTotal ?? commissionTotal);
      if (Number(ledger.commissionDirect ?? 0) > 0) {
        directCommission = Number(ledger.commissionDirect ?? directCommission);
      }
      if (Number(ledger.commissionMarketplaceJumia ?? 0) > 0) {
        jumiaCommission = Number(ledger.commissionMarketplaceJumia ?? jumiaCommission);
      }
      if (Number(ledger.commissionMarketplaceKilimall ?? 0) > 0) {
        kilimallCommission = Number(ledger.commissionMarketplaceKilimall ?? kilimallCommission);
      }
    }

    const bonusTotal = adjustmentSummary.totalBonus;
    const totalDeductions = adjustmentSummary.totalDeduction + penalties;
    const totalEarnings =
      Number(onlineSummary.baseSalary ?? 0) +
      Number(onlineSummary.transportAllowance ?? 0) +
      commissionTotal +
      bonusTotal;

    return {
      attendantId: attendant.id,
      name: attendant.name,
      email: attendant.email,
      attendantCategory: attendant.attendantCategory,
      isActive: attendant.isActive,
      baseSalary: Number(onlineSummary.baseSalary ?? 0),
      transportAllowance: Number(onlineSummary.transportAllowance ?? 0),
      commission: commissionTotal,
      commissionGross: commissionTotal,
      commissionDirect: directCommission,
      commissionMarketplaceJumia: jumiaCommission,
      commissionMarketplaceKilimall: kilimallCommission,
      commissionTotal,
      commissionBreakdown:
        ledger?.commissionBreakdown ?? {
          direct: directCommission,
          jumia: jumiaCommission,
          kilimall: kilimallCommission,
          total: commissionTotal,
        },
      bonusTotal,
      deductionTotal: totalDeductions,
      totalEarnings,
      totalDeductions,
      netPay: totalEarnings - totalDeductions,
      totalSales: Number(onlineSummary.directSales ?? 0) + Number(onlineSummary.marketplaceSales ?? 0),
      totalProfit: Number(posSummary.totalProfit ?? 0),
      totalReceipts: Number(posSummary.totalReceipts ?? 0),
      totalItems: Number(posSummary.totalItems ?? 0),
      newProducts: 0,
      editedProducts: 0,
      copiedProducts: 0,
      adjustmentBreakdown: adjustmentSummary.breakdown,
      adjustmentEntries: adjustmentSummary.entries,
    };
  }

  if (isDirectSalesCategory(attendant.attendantCategory)) {
    return buildTieredSalesPayrollRow({ attendant, period, adjustmentSummary, penalties });
  }

  if (isMarketingCategory(attendant.attendantCategory)) {
    return buildTieredSalesPayrollRow({ attendant, period, adjustmentSummary, penalties });
  }

  const earningsSummary = await getEarningsSummaryForUser({ userId: attendant.id, asOf: period.start });
  const detail = ledger?.detail as { totalSales?: number; totalProfit?: number } | undefined;
  const detailProfitValue = Number(detail?.totalProfit ?? Number.NaN);
  const resolvedProfit =
    !Number.isNaN(detailProfitValue) && detailProfitValue !== 0
      ? detailProfitValue
      : Number(earningsSummary?.totalProfit ?? 0);
  let commissionTotal = Number(ledger?.commissionTotal ?? 0);
  if (commissionTotal <= 0) {
    commissionTotal = Number(earningsSummary?.salesCommission ?? 0);
  }
  if (commissionTotal <= 0) {
    commissionTotal = Number(ledger?.netCommission ?? ledger?.grossCommission ?? 0);
  }

  const totalEarnings =
    Number(plan?.baseSalary ?? 0) +
    Number(plan?.defaultTransportAllowance ?? 0) +
    commissionTotal +
    adjustmentSummary.totalBonus;
  const totalDeductions = adjustmentSummary.totalDeduction + penalties;

  return {
    attendantId: attendant.id,
    name: attendant.name,
    email: attendant.email,
    attendantCategory: attendant.attendantCategory,
    isActive: attendant.isActive,
    baseSalary: Number(plan?.baseSalary ?? 0),
    transportAllowance: Number(plan?.defaultTransportAllowance ?? 0),
    commission: commissionTotal,
    commissionGross: commissionTotal,
    commissionDirect: Number(ledger?.commissionDirect ?? 0),
    commissionMarketplaceJumia: Number(ledger?.commissionMarketplaceJumia ?? 0),
    commissionMarketplaceKilimall: Number(ledger?.commissionMarketplaceKilimall ?? 0),
    commissionTotal,
    commissionBreakdown: ledger?.commissionBreakdown ?? null,
    bonusTotal: adjustmentSummary.totalBonus,
    deductionTotal: totalDeductions,
    totalEarnings,
    totalDeductions,
    netPay: totalEarnings - totalDeductions,
    totalSales: Math.max(Number(detail?.totalSales ?? 0), Number(earningsSummary?.totalSales ?? 0)),
    totalProfit: resolvedProfit,
    totalReceipts: Number(earningsSummary?.totalReceipts ?? 0),
    totalItems: Number(earningsSummary?.totalItems ?? 0),
    newProducts: Number(earningsSummary?.totalNewProducts ?? 0),
    editedProducts: Number(earningsSummary?.totalEditedProducts ?? 0),
    copiedProducts: Number(earningsSummary?.totalCopiedProducts ?? 0),
    adjustmentBreakdown: adjustmentSummary.breakdown,
    adjustmentEntries: adjustmentSummary.entries,
  };
}
