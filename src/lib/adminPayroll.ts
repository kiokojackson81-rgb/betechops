import { prisma } from "@/lib/prisma";
import { getPreviousTradingPeriod, type TradingPeriod } from "@/lib/tradingPeriod";
import { getPeriodKeyVariantsFromDates } from "@/lib/payrollPeriodKey";
import { getEarningsSummaryForUser } from "@/lib/earningsSummary";
import { getOnlineEarningsSummary } from "@/lib/onlineOps";
import { getOnlineOpsWindowForTradingPeriod } from "@/lib/onlineOpsWeeks";
import {
  resolveDirectCommissionMode,
  resolveOnlinePosOwnershipMode,
  computeBrendahDirectCommission,
} from "@/lib/onlineCommission";
import { summarizePosReceiptsForPeriod } from "@/lib/posReceiptSummary";
import { computeAdminReceiptSummary } from "@/lib/adminReceiptsSummary";
import {
  computeSalesCommissionFromTiers,
  computeJenifferProratedCommission,
  getOrCreateCommissionPeriod,
} from "@/lib/commission";
import { getUserCommissionConfigLike } from "@/lib/userCommissionConfig";
import { ensurePayrollAdjustmentStorage } from "@/lib/payrollAdjustmentStorage";
import { getReleasedPosProductCommissionForStaffPeriod } from "@/lib/posProductCommission";
import {
  getTechnicalProjectCommissionSummary,
  TECHNICAL_POS_PROFIT_COMMISSION_RATE,
} from "@/lib/technicalCompensation";
import type { AdjustmentBreakdown, AdjustmentEntry, AdjustmentKind, PayrollRow } from "@/app/admin/payroll/types";

type AttendantRecord = {
  id: string;
  name?: string | null;
  email?: string | null;
  attendantCategory?: string | null;
  isActive: boolean;
};

type PayrollBuildOptions = {
  cache: Map<string, Promise<PayrollRow>>;
  carryDepth: number;
};

function toDateOnly(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function datesBetween(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  const cursor = toDateOnly(start);
  const endDate = toDateOnly(end);
  while (cursor <= endDate) {
    out.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

async function ensureRecurringAdjustmentsForPeriod(attendantId: string, period: TradingPeriod) {
  const recurringItems = await prisma.attendantRecurringPayrollItem.findMany({
    where: { attendantId, isActive: true },
  });
  if (!recurringItems.length) return;

  const periodDates = datesBetween(period.start, period.end);
  for (const item of recurringItems) {
    const startGate = item.startDate ? toDateOnly(item.startDate) : null;
    const endGate = item.endDate ? toDateOnly(item.endDate) : null;
    const occurrences: Date[] = [];

    for (const day of periodDates) {
      if (startGate && day < startGate) continue;
      if (endGate && day > endGate) continue;
      if (item.cadence === "WEEKLY") {
        const targetDow = Number(item.dayOfWeek ?? 1);
        if (day.getUTCDay() === targetDow) {
          occurrences.push(day);
        }
      } else {
        const targetDom = Number(item.dayOfMonth ?? 1);
        if (day.getUTCDate() === targetDom) {
          occurrences.push(day);
          break; // monthly: single occurrence per trading period
        }
      }
    }

    if (!occurrences.length) {
      await prisma.attendantPayrollAdjustment.deleteMany({
        where: {
          attendantId,
          periodKey: period.key,
          recurringItemId: item.id,
        },
      });
      continue;
    }

    const occurrenceIsoSet = new Set(occurrences.map((d) => d.toISOString()));

    await prisma.attendantPayrollAdjustment.deleteMany({
      where: {
        attendantId,
        periodKey: period.key,
        recurringItemId: item.id,
        NOT: {
          occurrenceDate: {
            in: Array.from(occurrenceIsoSet).map((iso) => new Date(iso)),
          },
        },
      },
    });

    for (const occurrence of occurrences) {
      await prisma.attendantPayrollAdjustment.upsert({
        where: {
          recurringItemId_periodKey_occurrenceDate: {
            recurringItemId: item.id,
            periodKey: period.key,
            occurrenceDate: occurrence,
          },
        },
        update: {
          periodLabel: period.label,
          adjustmentType: item.adjustmentType,
          adjustmentKind: item.adjustmentKind,
          label: item.label,
          amount: item.amount,
        },
        create: {
          attendantId,
          periodKey: period.key,
          periodLabel: period.label,
          adjustmentType: item.adjustmentType,
          adjustmentKind: item.adjustmentKind,
          label: item.label,
          amount: item.amount,
          createdById: item.createdById,
          recurringItemId: item.id,
          occurrenceDate: occurrence,
        },
      });
    }
  }
}

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
  return category === "JUMIA_KILIMALL_OPS" || category === "BETECH_OPS" || category === "GENERAL_OPS";
}

function isDirectSalesCategory(category?: string | null) {
  return category === "DIRECT_SALES_OPS";
}

function isMarketingCategory(category?: string | null) {
  return category === "MARKETING_OPS";
}

function isTechnicalCategory(category?: string | null) {
  return category === "TECHNICAL_TEAM";
}

function withNegativeBalanceCarry(row: PayrollRow, amount: number, sourcePeriod: TradingPeriod): PayrollRow {
  if (amount <= 0) return row;

  return {
    ...row,
    deductionTotal: row.deductionTotal + amount,
    totalDeductions: row.totalDeductions + amount,
    netPay: row.netPay - amount,
    adjustmentBreakdown: {
      ...row.adjustmentBreakdown,
      other: Number(row.adjustmentBreakdown.other ?? 0) + amount,
    },
    adjustmentEntries: [
      ...row.adjustmentEntries,
      {
        id: `negative-balance:${row.attendantId}:${sourcePeriod.key}`,
        label: `Negative balance carried forward (${sourcePeriod.label})`,
        amount,
        adjustmentType: "NEGATIVE_BALANCE",
        kind: "DEDUCTION",
      },
    ],
  };
}

async function applyPreviousNegativeBalanceCarry(
  attendant: AttendantRecord,
  period: TradingPeriod,
  row: PayrollRow,
  options: PayrollBuildOptions,
) {
  if (options.carryDepth >= 24) return row;

  const previousPeriod = getPreviousTradingPeriod(period);
  const previousRow = await buildPayrollRowInternal(attendant, previousPeriod, {
    cache: options.cache,
    carryDepth: options.carryDepth + 1,
  });
  const carriedNegativeBalance = Math.max(0, -Number(previousRow.netPay ?? 0));
  return withNegativeBalanceCarry(row, carriedNegativeBalance, previousPeriod);
}

async function buildPayrollRowResolved(
  attendant: AttendantRecord,
  period: TradingPeriod,
  options: PayrollBuildOptions,
): Promise<PayrollRow> {
  const periodKeyVariants = getPeriodKeyVariantsFromDates(period.start, period.end);
  await ensurePayrollAdjustmentStorage();
  await ensureRecurringAdjustmentsForPeriod(attendant.id, period);
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
    const marketplaceWindow = getOnlineOpsWindowForTradingPeriod(period, new Date(), 4);
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
    let directCommission = Number(onlineSummary.commissionDirect ?? onlineSummary.directCommission ?? 0);
    let jumiaCommission = Number(onlineSummary.commissionMarketplaceJumia ?? 0);
    let kilimallCommission = Number(onlineSummary.commissionMarketplaceKilimall ?? 0);
    let commissionTotal = Number(onlineSummary.commissionTotal ?? onlineSummary.grossCommission ?? 0);

    // Only let the reviewed ledger override when it is not one of the POS-profit-share
    // users, because for PROFIT_10 users the live online summary carries the rescued
    // POS sales/profit fallback that stale ledgers can miss.
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

    const row = {
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
    return applyPreviousNegativeBalanceCarry(attendant, period, row, options);
  }

  if (isDirectSalesCategory(attendant.attendantCategory)) {
    const [earningsSummary, receiptSummary, commissionConfig, commissionPeriod, releasedPosCommission] = await Promise.all([
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
      getReleasedPosProductCommissionForStaffPeriod(attendant.id, period.start, period.end),
    ]);

    const totalSales = Math.max(Number(receiptSummary.totalSales ?? 0), Number(earningsSummary.totalSales ?? 0));
    const totalProfit =
      Math.max(Number(receiptSummary.totalProfit ?? 0), Number(earningsSummary.totalProfit ?? 0)) -
      Number(releasedPosCommission ?? 0);
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
          : commissionConfig.salesCommissionMode === "POS_PROFIT_10"
            ? Math.round(Math.max(0, totalProfit) * 0.1)
          : Number(computeSalesCommissionFromTiers(totalSales, totalProfit, tiers, totalProfit > 0 ? 0.05 : 0));
    const directCommissionTotal = salesCommission + Number(releasedPosCommission ?? 0);
    const productWorkCommission =
      Number(earningsSummary.newProductCommission ?? 0) +
      Number(earningsSummary.copiedCommission ?? 0) +
      Number(earningsSummary.editedCommission ?? 0);
    const commissionTotal = directCommissionTotal + productWorkCommission;
    const totalEarnings =
      Number(earningsSummary.baseSalary ?? 0) +
      Number(earningsSummary.transportAllowance ?? 0) +
      commissionTotal +
      adjustmentSummary.totalBonus;
    const totalDeductions = adjustmentSummary.totalDeduction + penalties;

    const row = {
      attendantId: attendant.id,
      name: attendant.name,
      email: attendant.email,
      attendantCategory: attendant.attendantCategory,
      isActive: attendant.isActive,
      baseSalary: Number(earningsSummary.baseSalary ?? 0),
      transportAllowance: Number(earningsSummary.transportAllowance ?? 0),
      commission: commissionTotal,
      commissionGross: commissionTotal,
      commissionDirect: directCommissionTotal,
      commissionMarketplaceJumia: 0,
      commissionMarketplaceKilimall: 0,
      commissionTotal,
      commissionBreakdown: {
        direct: salesCommission,
        posProduct: Number(releasedPosCommission ?? 0),
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
    return applyPreviousNegativeBalanceCarry(attendant, period, row, options);
  }

  if (isMarketingCategory(attendant.attendantCategory)) {
    const [earningsSummary, receiptSummary, commissionConfig, commissionPeriod, releasedPosCommission] = await Promise.all([
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
      getReleasedPosProductCommissionForStaffPeriod(attendant.id, period.start, period.end),
    ]);

    const totalSales = Math.max(Number(receiptSummary.totalSales ?? 0), Number(earningsSummary.totalSales ?? 0));
    const totalReceipts = Math.max(
      Number(receiptSummary.receiptsCount ?? 0),
      Number(earningsSummary.totalReceipts ?? 0),
    );
    const totalProfit =
      Number(earningsSummary.totalProfit ?? receiptSummary.totalProfit ?? 0) -
      Number(releasedPosCommission ?? 0);
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
          : commissionConfig.salesCommissionMode === "POS_PROFIT_10"
            ? Math.round(Math.max(0, totalProfit) * 0.1)
          : Number(computeSalesCommissionFromTiers(totalSales, totalProfit, tiers, totalProfit > 0 ? 0.05 : 0));
    const directCommissionTotal = salesCommission + Number(releasedPosCommission ?? 0);
    const productWorkCommission =
      Number(earningsSummary.newProductCommission ?? 0) +
      Number(earningsSummary.copiedCommission ?? 0) +
      Number(earningsSummary.editedCommission ?? 0);
    const commissionTotal = directCommissionTotal + productWorkCommission;
    const totalEarnings =
      Number(earningsSummary.baseSalary ?? 0) +
      Number(earningsSummary.transportAllowance ?? 0) +
      commissionTotal +
      adjustmentSummary.totalBonus;
    const totalDeductions = adjustmentSummary.totalDeduction + penalties;

    const row = {
      attendantId: attendant.id,
      name: attendant.name,
      email: attendant.email,
      attendantCategory: attendant.attendantCategory,
      isActive: attendant.isActive,
      baseSalary: Number(earningsSummary.baseSalary ?? 0),
      transportAllowance: Number(earningsSummary.transportAllowance ?? 0),
      commission: commissionTotal,
      commissionGross: commissionTotal,
      commissionDirect: directCommissionTotal,
      commissionMarketplaceJumia: 0,
      commissionMarketplaceKilimall: 0,
      commissionTotal,
      commissionBreakdown: {
        direct: salesCommission,
        posProduct: Number(releasedPosCommission ?? 0),
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
      totalItems: Number(earningsSummary.totalItems ?? 0),
      newProducts: Number(earningsSummary.totalNewProducts ?? 0),
      editedProducts: Number(earningsSummary.totalEditedProducts ?? 0),
      copiedProducts: Number(earningsSummary.totalCopiedProducts ?? 0),
      adjustmentBreakdown: adjustmentSummary.breakdown,
      adjustmentEntries: adjustmentSummary.entries,
    };
    return applyPreviousNegativeBalanceCarry(attendant, period, row, options);
  }

  if (isTechnicalCategory(attendant.attendantCategory)) {
    const [earningsSummary, posSummary, releasedPosCommission, projectCommission] = await Promise.all([
      getEarningsSummaryForUser({ userId: attendant.id, asOf: period.start }),
      summarizePosReceiptsForPeriod({
        start: period.start,
        end: period.end,
        userId: attendant.id,
        ownershipMode: "issuerOnly",
        profitRecognitionMode: "salesDate",
      }),
      getReleasedPosProductCommissionForStaffPeriod(attendant.id, period.start, period.end),
      getTechnicalProjectCommissionSummary(attendant.id, period),
    ]);

    const totalSales = Number(posSummary.totalSales ?? 0);
    const totalReceipts = Number(posSummary.totalReceipts ?? 0);
    const totalItems = Number(posSummary.totalItems ?? 0);
    const totalProfit =
      Number(posSummary.totalProfit ?? 0) -
      Number(releasedPosCommission ?? 0);
    const salesCommission = Math.round(Math.max(0, totalProfit) * TECHNICAL_POS_PROFIT_COMMISSION_RATE);
    const directCommissionTotal = salesCommission + Number(releasedPosCommission ?? 0);
    const projectWorkCommission = Number(projectCommission.completedAmount ?? 0);
    const commissionTotal = directCommissionTotal + projectWorkCommission;
    const totalEarnings =
      Number(earningsSummary.baseSalary ?? 0) +
      Number(earningsSummary.transportAllowance ?? 0) +
      commissionTotal +
      adjustmentSummary.totalBonus;
    const totalDeductions = adjustmentSummary.totalDeduction + penalties;

    const row = {
      attendantId: attendant.id,
      name: attendant.name,
      email: attendant.email,
      attendantCategory: attendant.attendantCategory,
      isActive: attendant.isActive,
      baseSalary: Number(earningsSummary.baseSalary ?? 0),
      transportAllowance: Number(earningsSummary.transportAllowance ?? 0),
      commission: commissionTotal,
      commissionGross: commissionTotal,
      commissionDirect: directCommissionTotal,
      commissionMarketplaceJumia: 0,
      commissionMarketplaceKilimall: 0,
      commissionTotal,
      commissionBreakdown: {
        posProfitShare: salesCommission,
        posProduct: Number(releasedPosCommission ?? 0),
        projectCompleted: projectWorkCommission,
        projectPending: Number(projectCommission.pendingAmount ?? 0),
        projectCompletedCount: Number(projectCommission.completedCount ?? 0),
        projectPendingCount: Number(projectCommission.pendingCount ?? 0),
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
      newProducts: 0,
      editedProducts: 0,
      copiedProducts: 0,
      adjustmentBreakdown: adjustmentSummary.breakdown,
      adjustmentEntries: adjustmentSummary.entries,
    };
    return applyPreviousNegativeBalanceCarry(attendant, period, row, options);
  }

  const [earningsSummary, commissionConfig] = await Promise.all([
    getEarningsSummaryForUser({ userId: attendant.id, asOf: period.start }),
    getUserCommissionConfigLike(attendant.id),
  ]);
  const detail = ledger?.detail as
    | {
        totalSales?: number;
        totalProfit?: number;
        support?: { commission?: number };
      }
    | undefined;
  const detailProfitValue = Number(detail?.totalProfit ?? Number.NaN);
  const resolvedProfit =
    !Number.isNaN(detailProfitValue) && detailProfitValue !== 0
      ? detailProfitValue
      : Number(earningsSummary?.totalProfit ?? 0);
  const usesConfiguredCommissionMode =
    commissionConfig.posTotalsMode !== "NONE" || commissionConfig.salesCommissionMode !== "DEFAULT_TIERS";
  let commissionTotal = usesConfiguredCommissionMode
    ? Number(earningsSummary?.commission ?? earningsSummary?.grossCommission ?? earningsSummary?.salesCommission ?? 0)
    : Number(ledger?.commissionTotal ?? 0);
  if (commissionTotal <= 0) {
    commissionTotal = Number(earningsSummary?.salesCommission ?? 0);
  }
  if (commissionTotal <= 0) {
    commissionTotal = Number(ledger?.netCommission ?? ledger?.grossCommission ?? 0);
  }
  const resolvedDirectCommission = usesConfiguredCommissionMode
    ? Number(earningsSummary?.salesCommission ?? commissionTotal)
    : Number(ledger?.commissionDirect ?? 0);
  const supportAdjustment =
    attendant.attendantCategory === "SUPPORT_OPS"
      ? Math.max(
          0,
          Number(detail?.support?.commission ?? 0) > 0
            ? commissionTotal - resolvedDirectCommission
            : 0,
        )
      : 0;

  const totalEarnings =
    Number(plan?.baseSalary ?? 0) +
    Number(plan?.defaultTransportAllowance ?? 0) +
    commissionTotal +
    adjustmentSummary.totalBonus;
  const totalDeductions = adjustmentSummary.totalDeduction + penalties;

  const row = {
    attendantId: attendant.id,
    name: attendant.name,
    email: attendant.email,
    attendantCategory: attendant.attendantCategory,
    isActive: attendant.isActive,
    baseSalary: Number(plan?.baseSalary ?? 0),
    transportAllowance: Number(plan?.defaultTransportAllowance ?? 0),
    commission: commissionTotal,
    commissionGross: commissionTotal,
    commissionDirect: resolvedDirectCommission,
    commissionMarketplaceJumia: Number(ledger?.commissionMarketplaceJumia ?? 0),
    commissionMarketplaceKilimall: Number(ledger?.commissionMarketplaceKilimall ?? 0),
    commissionTotal,
    commissionBreakdown:
      usesConfiguredCommissionMode
        ? {
            direct: resolvedDirectCommission,
            posProfitShare: attendant.attendantCategory === "SUPPORT_OPS" ? resolvedDirectCommission : undefined,
            supportAdjustment: attendant.attendantCategory === "SUPPORT_OPS" ? supportAdjustment : undefined,
            total: commissionTotal,
            source: commissionConfig.salesCommissionMode,
          }
        : ledger?.commissionBreakdown ?? null,
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
  return applyPreviousNegativeBalanceCarry(attendant, period, row, options);
}

function buildPayrollRowInternal(
  attendant: AttendantRecord,
  period: TradingPeriod,
  options: PayrollBuildOptions,
): Promise<PayrollRow> {
  const cacheKey = `${attendant.id}:${period.key}:carry-${options.carryDepth}`;
  const cached = options.cache.get(cacheKey);
  if (cached) return cached;

  const promise = buildPayrollRowResolved(attendant, period, options);
  options.cache.set(cacheKey, promise);
  return promise;
}

export async function buildPayrollRow(attendant: AttendantRecord, period: TradingPeriod): Promise<PayrollRow> {
  return buildPayrollRowInternal(attendant, period, {
    cache: new Map<string, Promise<PayrollRow>>(),
    carryDepth: 0,
  });
}
