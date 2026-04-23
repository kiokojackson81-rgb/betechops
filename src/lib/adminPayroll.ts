import { prisma } from "@/lib/prisma";
import type { TradingPeriod } from "@/lib/tradingPeriod";
import { getPeriodKeyVariantsFromDates } from "@/lib/payrollPeriodKey";
import { getEarningsSummaryForUser } from "@/lib/earningsSummary";
import { getOnlineEarningsSummary, getAssignedMarketplaceSalesForPeriod } from "@/lib/onlineOps";
import { getOnlineOpsWindowForTradingPeriod } from "@/lib/onlineOpsWeeks";
import {
  computeOnlinePeriodCommission,
  resolveDirectCommissionMode,
  resolveOnlinePosOwnershipMode,
} from "@/lib/onlineCommission";
import { summarizePosReceiptsForPeriod } from "@/lib/posReceiptSummary";
import { computeAdminReceiptSummary } from "@/lib/adminReceiptsSummary";
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
      summary.totalBonus += amount;
      if (bonusType) summary.breakdown.bonus += amount;
      if (topUpType) summary.breakdown.commissionTopUp += amount;
      if (!bonusType && !topUpType) summary.breakdown.bonus += amount;
      continue;
    }

    summary.totalDeduction += amount;
    if (adjustment.adjustmentType === "CHAMA") summary.breakdown.chama += amount;
    else if (adjustment.adjustmentType === "LATENESS") summary.breakdown.lateness += amount;
    else if (adjustment.adjustmentType === "DISCIPLINE") summary.breakdown.discipline += amount;
    else summary.breakdown.other += amount;
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
    const marketplaceWindow = getOnlineOpsWindowForTradingPeriod(period, period.end, 4);
    const [onlineSummary, marketplaceSalesSummary, posSummary] = await Promise.all([
      getOnlineEarningsSummary(attendant.id, { period }),
      getAssignedMarketplaceSalesForPeriod(attendant.id, {
        key: marketplaceWindow.key,
        label: marketplaceWindow.label,
        start: marketplaceWindow.start,
        end: marketplaceWindow.end,
      }),
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
    const commissionResult = computeOnlinePeriodCommission(
      {
        attendantId: attendant.id,
        periodStart: period.start,
        periodEnd: period.end,
        directSales: Number(posSummary.totalSales ?? 0),
        directProfit: Number(posSummary.totalProfit ?? 0),
        jumiaSales: Number(marketplaceSalesSummary.totals.jumiaSales ?? 0),
        kilimallSales: Number(marketplaceSalesSummary.totals.kilimallSales ?? 0),
      },
      { directCommissionMode: directMode },
    );

    const directCommission = Number(
      commissionResult.lines.find((line) => line.channel === "DIRECT")?.commission ?? onlineSummary.directCommission ?? 0,
    );
    const jumiaCommission = Number(
      commissionResult.lines.find((line) => line.channel === "JUMIA")?.commission ?? 0,
    );
    const kilimallCommission = Number(
      commissionResult.lines.find((line) => line.channel === "KILIMALL")?.commission ?? 0,
    );
    const commissionTotal = Number(onlineSummary.commissionTotal ?? onlineSummary.grossCommission ?? 0);
    const bonusTotal = Number(onlineSummary.bonusTotal ?? 0) + Number(onlineSummary.commissionTopUpTotal ?? 0);
    const totalDeductions = Number(onlineSummary.totalDeductions ?? 0) + penalties;
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
      commissionBreakdown: {
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
    const [earningsSummary, receiptSummary] = await Promise.all([
      getEarningsSummaryForUser({ userId: attendant.id, asOf: period.start }),
      computeAdminReceiptSummary({
        start: period.start,
        end: period.end,
        scope: "mine",
        currentUserId: attendant.id,
        attendantId: attendant.id,
        salesOnly: true,
      }),
    ]);

    const totalSales = Math.max(Number(receiptSummary.totalSales ?? 0), Number(earningsSummary.totalSales ?? 0));
    const totalProfit = Math.max(Number(receiptSummary.totalProfit ?? 0), Number(earningsSummary.totalProfit ?? 0));
    const totalReceipts = Math.max(Number(receiptSummary.receiptsCount ?? 0), Number(earningsSummary.totalReceipts ?? 0));
    const totalItems = Math.max(Number(receiptSummary.itemsCount ?? 0), Number(earningsSummary.totalItems ?? 0));
    const commissionTotal = Number(earningsSummary.grossCommission ?? earningsSummary.salesCommission ?? 0);
    const totalEarnings =
      Number(earningsSummary.baseSalary ?? 0) +
      Number(earningsSummary.transportAllowance ?? 0) +
      commissionTotal +
      Number(earningsSummary.bonusTotal ?? 0);
    const totalDeductions =
      Number(earningsSummary.chamaTotal ?? 0) +
      Number(earningsSummary.latenessTotal ?? 0) +
      Number(earningsSummary.disciplineTotal ?? 0) +
      Number(earningsSummary.otherDeductionsTotal ?? 0) +
      penalties;

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
      commissionDirect: Number(earningsSummary.salesCommission ?? commissionTotal),
      commissionMarketplaceJumia: 0,
      commissionMarketplaceKilimall: 0,
      commissionTotal,
      commissionBreakdown: {
        direct: Number(earningsSummary.salesCommission ?? commissionTotal),
        productWork:
          Number(earningsSummary.newProductCommission ?? 0) +
          Number(earningsSummary.copiedCommission ?? 0) +
          Number(earningsSummary.editedCommission ?? 0),
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

  if (isMarketingCategory(attendant.attendantCategory)) {
    const [earningsSummary, receiptSummary] = await Promise.all([
      getEarningsSummaryForUser({ userId: attendant.id, asOf: period.start }),
      computeAdminReceiptSummary({
        start: period.start,
        end: period.end,
        scope: "mine",
        currentUserId: attendant.id,
        attendantId: attendant.id,
        salesOnly: true,
      }),
    ]);

    const totalSales = Math.max(Number(receiptSummary.totalSales ?? 0), Number(earningsSummary.totalSales ?? 0));
    const totalReceipts = Math.max(
      Number(receiptSummary.receiptsCount ?? 0),
      Number(earningsSummary.totalReceipts ?? 0),
    );
    const commissionTotal = Number(earningsSummary.grossCommission ?? earningsSummary.salesCommission ?? 0);
    const totalEarnings =
      Number(earningsSummary.baseSalary ?? 0) +
      Number(earningsSummary.transportAllowance ?? 0) +
      commissionTotal +
      Number(earningsSummary.bonusTotal ?? 0);
    const totalDeductions =
      Number(earningsSummary.chamaTotal ?? 0) +
      Number(earningsSummary.latenessTotal ?? 0) +
      Number(earningsSummary.disciplineTotal ?? 0) +
      Number(earningsSummary.otherDeductionsTotal ?? 0) +
      penalties;

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
      commissionDirect: Number(earningsSummary.salesCommission ?? commissionTotal),
      commissionMarketplaceJumia: 0,
      commissionMarketplaceKilimall: 0,
      commissionTotal,
      commissionBreakdown: {
        direct: Number(earningsSummary.salesCommission ?? commissionTotal),
        productWork:
          Number(earningsSummary.newProductCommission ?? 0) +
          Number(earningsSummary.copiedCommission ?? 0) +
          Number(earningsSummary.editedCommission ?? 0),
        total: commissionTotal,
      },
      bonusTotal: adjustmentSummary.totalBonus,
      deductionTotal: totalDeductions,
      totalEarnings,
      totalDeductions,
      netPay: totalEarnings - totalDeductions,
      totalSales,
      totalProfit: Number(earningsSummary.totalProfit ?? receiptSummary.totalProfit ?? 0),
      totalReceipts,
      totalItems: Number(earningsSummary.totalItems ?? 0),
      newProducts: Number(earningsSummary.totalNewProducts ?? 0),
      editedProducts: Number(earningsSummary.totalEditedProducts ?? 0),
      copiedProducts: Number(earningsSummary.totalCopiedProducts ?? 0),
      adjustmentBreakdown: adjustmentSummary.breakdown,
      adjustmentEntries: adjustmentSummary.entries,
    };
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
