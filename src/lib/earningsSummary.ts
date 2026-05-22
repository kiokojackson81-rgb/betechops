import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { getOrCreateCommissionPeriod, computeSalesCommissionFromTiers, computeProductCommissions } from "./commission";
import { calculateCumulativeCommission } from "./commissionCommon";
import { computeDirectCommission, computeBrendahDirectCommission } from "./onlineCommission";
import { summarizeMarketingReportsForPeriod } from "@/lib/marketingPeriodTotals";
import { getSupportPeriodAggregates } from "@/lib/supportEntries";
import { summarizePosReceiptsForPeriod } from "@/lib/posReceiptSummary";
import { getUserCommissionConfigLike } from "@/lib/userCommissionConfig";
import { ensurePayrollAdjustmentStorage } from "@/lib/payrollAdjustmentStorage";

export type EarningsSummary = {
  periodKey: string;
  periodLabel: string;
  attendantEmail?: string | null;

  totalSales: number;
  totalProfit: number;
  totalNewProducts: number;
  totalEditedProducts: number;
  totalCopiedProducts: number;
  totalItems?: number;
  totalReceipts?: number;
  walkInsServed?: number;
  walkInsPurchased?: number;

  baseSalary: number;
  transportAllowance: number;

  salesCommission: number;
  newProductCommission: number;
  copiedCommission: number;
  editedCommission: number;
  grossCommission: number;
  commission?: number;
  batteryEarnings: number;

  bonusTotal: number;
  commissionTopUpTotal: number;

  chamaTotal: number;
  latenessTotal: number;
  disciplineTotal: number;
  otherDeductionsTotal: number;

  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  ledger?: {
    grossCommission: number;
    netCommission: number;
    penalties: number;
    detail: unknown;
  } | null;
  adjustmentEntries?: { id: string; label: string; amount: number; adjustmentType: string; adjustmentKind: string }[];
  jenifferProgress?: { commission: number; baseCommission: number; prorated: number; nextTarget: number | null; progressPercent: number } | null;
};

export async function getEarningsSummaryForUser(opts: { userId: string; asOf?: Date }) {
  const now = opts.asOf ?? new Date();
  const tradingPeriod = getTradingPeriodFor(now);
  const periodKey = `${tradingPeriod.start.toISOString().split("T")[0]}_${tradingPeriod.end.toISOString().split("T")[0]}`;
  const periodLabel = tradingPeriod.label;

  const { period, tiers, tradingPeriod: periodInfo } = await getOrCreateCommissionPeriod(now);
  const start = (periodInfo as any).startDate ?? (periodInfo as any).start;
  const end = (periodInfo as any).endDate ?? (periodInfo as any).end;

  const snapshots = await prisma.profitSnapshot.findMany({
    where: {
      orderItem: {
        order: {
          attendantId: opts.userId,
          createdAt: { gte: start, lte: end },
        },
      },
    },
    select: {
      revenue: true,
      profit: true,
    },
  });

  let totalSales = 0;
  let totalProfit = 0;
  for (const row of snapshots) {
    totalSales += Number(row.revenue ?? 0);
    totalProfit += Number(row.profit ?? 0);
  }

  const reports = await prisma.dailyReport.findMany({
    where: { userId: opts.userId, date: { gte: start, lte: end } },
    select: {
      newProducts: true,
      productsEdited: true,
      copiesUploaded: true,
    },
  });

  let newProducts = 0;
  let editedProducts = 0;
  let copiedProducts = 0;
  for (const report of reports) {
    newProducts += report.newProducts ?? 0;
    editedProducts += report.productsEdited ?? 0;
    copiedProducts += report.copiesUploaded ?? 0;
  }

  const user = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: { email: true, attendantCategory: true },
  });
  const normalizedEmail = (user?.email ?? "").toLowerCase();
  const commissionConfig = await getUserCommissionConfigLike(opts.userId);
  const marketingSummary = await summarizeMarketingReportsForPeriod({
    userId: opts.userId,
    userEmail: user?.email ?? null,
    period: tradingPeriod,
  });
  const marketingTotals = marketingSummary.totals;

  // Also include support aggregates and dedupe per-receipt to avoid double-counting
  const supportSummary = await getSupportPeriodAggregates({ userId: opts.userId, period: tradingPeriod });
  const marketingPer = (marketingSummary as any)?.perReceipts ?? {};
  const supportPer = (supportSummary as any)?.perReceipts ?? {};
  const merged = new Map<string, { sales: number; profit: number; items: number; mpesa: number; cash: number }>();
  for (const [k, v] of Object.entries(marketingPer) as [string, any][]) {
    merged.set(k, { sales: v.sales ?? 0, profit: v.profit ?? 0, items: v.items ?? 0, mpesa: v.mpesa ?? 0, cash: v.cash ?? 0 });
  }
  for (const [k, v] of Object.entries(supportPer) as [string, any][]) {
    const supportObj = { sales: v.sales ?? 0, profit: v.profit ?? 0, items: v.items ?? 0, mpesa: v.mpesa ?? 0, cash: v.cash ?? 0 };
    if (merged.has(k)) {
      // If marketing provided an entry but it lacks profit information while
      // the support entry has profit, prefer the support entry so we don't
      // lose buying-price-derived profit (handles unpriced marketing rows).
      const existing = merged.get(k)!;
      if ((existing.profit ?? 0) <= 0 && (supportObj.profit ?? 0) > 0) {
        merged.set(k, supportObj);
      }
      continue;
    }
    merged.set(k, supportObj);
  }
  let mergedSales = 0;
  let mergedProfit = 0;
  let mergedItems = 0;
  for (const [, v] of merged) {
    mergedSales += v.sales;
    mergedProfit += v.profit;
    mergedItems += v.items ?? 0;
  }

  const usePosTotals = commissionConfig.posTotalsMode !== "NONE";
  const isJeniffer = commissionConfig.salesCommissionMode === "JENIFFER_PRORATED";
  const isBrendah = commissionConfig.salesCommissionMode === "BRENDAH_DIRECT";
  const isPosProfit10 = commissionConfig.salesCommissionMode === "POS_PROFIT_10";
  let posSummary: Awaited<ReturnType<typeof summarizePosReceiptsForPeriod>> | null = null;
  if (usePosTotals) {
    const userIdForPos = commissionConfig.posTotalsMode === "GLOBAL" ? null : opts.userId;
    posSummary = await summarizePosReceiptsForPeriod({
      start,
      end,
      userId: userIdForPos,
      ownershipMode: userIdForPos ? "staffOnly" : undefined,
      paymentScope: commissionConfig.salesCommissionMode === "POS_PROFIT_10" ? "all" : "paidOnly",
    });
  }
  if (usePosTotals && posSummary) {
    totalSales = posSummary.totalSales;
    totalProfit = posSummary.totalProfit;
  } else if (mergedSales > totalSales) {
    totalSales = mergedSales;
    totalProfit = mergedProfit;
  }

  const plan = await prisma.attendantCompPlan.findUnique({ where: { attendantId: opts.userId } });
  const baseSalary = plan?.baseSalary ?? 0;
  const transportAllowance = plan?.defaultTransportAllowance ?? 0;

  // Build two common periodKey formats used in various parts of the app so we
  // can find adjustments regardless of which format was used when creating them.
  // 1) YYYY-MM-DD_YYYY-MM-DD (used by some endpoints)
  // 2) <ISO_WITH_TZ>_<ISO_WITH_TZ> (used by admin/check scripts)
  const startDateOnly = tradingPeriod.start.toISOString().split("T")[0];
  const endDateOnly = tradingPeriod.end.toISOString().split("T")[0];
  const periodKeyDateOnly = `${startDateOnly}_${endDateOnly}`;
  const periodKeyIso = `${tradingPeriod.start.toISOString()}_${tradingPeriod.end.toISOString()}`;

  await ensurePayrollAdjustmentStorage();
  const adjustments = await prisma.attendantPayrollAdjustment.findMany({
    where: {
      attendantId: opts.userId,
      OR: [{ periodKey: periodKeyDateOnly }, { periodKey: periodKeyIso }],
    },
    orderBy: { createdAt: "desc" },
  });

  // Respect the adjustmentKind (ADDITION | DEDUCTION) when computing totals.
  // Some adjustment types (e.g., BONUS, COMMISSION_TOPUP) are meaningful as additions,
  // while CHAMA/LATENESS/DISCIPLINE/OTHER are deductions — but we still honour the
  // explicit adjustmentKind to allow admin-created additions or deductions.
  let bonusTotal = 0;
  let commissionTopUpTotal = 0;
  let chamaTotal = 0;
  let latenessTotal = 0;
  let disciplineTotal = 0;
  let otherDeductionsTotal = 0;

  const adjustmentEntries = adjustments.map((a) => ({
    id: a.id,
    label: a.label,
    amount: a.amount ?? 0,
    adjustmentType: a.adjustmentType,
    adjustmentKind: String(a.adjustmentKind ?? "DEDUCTION").toUpperCase(),
  }));

  for (const a of adjustments) {
    const kind = String(a.adjustmentKind ?? "DEDUCTION").toUpperCase();
    const amt = Number(a.amount ?? 0);
    const isAddition = kind === "ADDITION";
    const t = a.adjustmentType;

    if (t === "BONUS") {
      if (isAddition) bonusTotal += amt; else bonusTotal -= amt;
    } else if (t === "COMMISSION_TOPUP") {
      if (isAddition) commissionTopUpTotal += amt; else commissionTopUpTotal -= amt;
    } else if (t === "CHAMA") {
      if (!isAddition) chamaTotal += amt; else chamaTotal -= amt;
    } else if (t === "LATENESS") {
      if (!isAddition) latenessTotal += amt; else latenessTotal -= amt;
    } else if (t === "DISCIPLINE") {
      if (!isAddition) disciplineTotal += amt; else disciplineTotal -= amt;
    } else if (t === "OTHER") {
      if (!isAddition) otherDeductionsTotal += amt; else otherDeductionsTotal -= amt;
    } else {
      // unknown types: treat as deduction by default
      if (!isAddition) otherDeductionsTotal += amt; else bonusTotal += amt;
    }
  }

  // Load any existing CommissionLedger for this attendant/period. Prefer
  // the most-recent ledger (by `createdAt`) and favour ledgers that have a
  // persisted `commissionTotal` > 0 so recomputes/upserts are shown in the UI.
  let ledger: { grossCommission: number; netCommission: number; penalties: number; detail: unknown; commissionTotal?: number } | null = null;
  try {
    // First try exact unique lookup
    const exact = await prisma.commissionLedger.findUnique({
      where: {
        userId_periodStart_periodEnd: {
          userId: opts.userId,
          periodStart: tradingPeriod.start,
          periodEnd: tradingPeriod.end,
        },
      },
    });
    if (exact) {
      ledger = {
        grossCommission: Number(exact.grossCommission ?? 0),
        netCommission: Number(exact.netCommission ?? 0),
        penalties: Number(exact.penalties ?? 0),
        commissionTotal: Number((exact as any).commissionTotal ?? 0),
        detail: exact.detail ?? null,
      } as any;
    } else {
      // If no exact row, collect candidate ledgers that either embed the
      // periodKey in `detail.marketing.periodKey` or have a near periodStart.
      const periodKeyDateOnlyLocal = `${tradingPeriod.start.toISOString().split("T")[0]}_${tradingPeriod.end.toISOString().split("T")[0]}`;
      const windowMs = 24 * 60 * 60 * 1000;
      const candidates: any[] = await prisma.$queryRaw`
        SELECT id, "grossCommission", "netCommission", "penalties", "commissionTotal", detail, "createdAt"
        FROM "CommissionLedger"
        WHERE "userId" = ${opts.userId}
          AND (
            (detail->'marketing'->>'periodKey') = ${tradingPeriod.key}
            OR (detail->'marketing'->>'periodKey') = ${periodKeyDateOnlyLocal}
            OR ("periodStart" >= ${new Date(tradingPeriod.start.getTime() - windowMs)} AND "periodStart" <= ${new Date(tradingPeriod.start.getTime() + windowMs)})
          )
        ORDER BY "createdAt" DESC
        LIMIT 10
      `;

      // ledger candidates fetched (debug removed in final)

      if (Array.isArray(candidates) && candidates.length > 0) {
        // Prefer first candidate that has a positive commissionTotal
        let chosen = candidates.find((c) => Number(c.commissionTotal ?? 0) > 0) || candidates[0];
        ledger = {
          grossCommission: Number(chosen.grossCommission ?? 0),
          netCommission: Number(chosen.netCommission ?? 0),
          penalties: Number(chosen.penalties ?? 0),
          commissionTotal: Number(chosen.commissionTotal ?? 0),
          detail: chosen.detail ?? null,
        } as any;
      }
    }
  } catch (err) {
    // best-effort: if ledger lookup fails, proceed with computed values
    ledger = null;
  }

  // Compute commission. For Brendah we use the direct-sales formula from
  // `computeDirectCommission`. For Jeniffer apply special prorated-tier
  // rule (base payouts + prorated share of next tier). Others use the
  // tiered calculation with a fallback percent based on profit.
  let salesCommission: number;
  let jenifferProgress: any = null;

  if (isJeniffer) {
    const res = calculateCumulativeCommission(totalSales);
    salesCommission = Number(res.commission ?? 0);
    jenifferProgress = {
      commission: salesCommission,
      baseCommission: salesCommission,
      prorated: 0,
      nextTarget: res.nextTarget ?? null,
      progressPercent: res.nextTarget ? Math.max(0, Math.min(1, totalSales / res.nextTarget)) : 1,
    };
  } else if (isPosProfit10) {
    salesCommission = Math.round(Math.max(0, totalProfit) * 0.1);
  } else {
    const fallbackPercent = totalProfit > 0 ? 0.05 : 0;
    salesCommission = computeSalesCommissionFromTiers(totalSales, totalProfit, tiers, fallbackPercent);
  }

  const { newProductCommission, copiedCommission, editedCommission } = computeProductCommissions({
    newProducts,
    copiedProducts,
    editedProducts,
  });

  let computedGrossCommission = salesCommission + newProductCommission + copiedCommission + editedCommission + commissionTopUpTotal;

  if (isBrendah) {
    const direct = computeBrendahDirectCommission(totalSales, totalProfit);
    salesCommission = direct.amount;
    computedGrossCommission = direct.amount + newProductCommission + copiedCommission + editedCommission + commissionTopUpTotal;
  }

  // Prefer a persisted `commissionTotal` when present (authoritative),
  // otherwise fall back to computed values. This ensures the UI quick-stats
  // reflect the ledger-upserted commission when admins have run a recompute.
  // For Brendah we always use the computed formula (ignore persisted ledger
  // overrides). For others prefer a persisted `commissionTotal` when present.
  let finalGrossCommission: number;
  const ledgerPersistedCommission = ledger && (ledger as any).commissionTotal ? Number((ledger as any).commissionTotal) : 0;
  if (isBrendah || isJeniffer || isPosProfit10) {
    finalGrossCommission = computedGrossCommission;
  } else if (ledgerPersistedCommission > 0) {
    finalGrossCommission = ledgerPersistedCommission;
  } else {
    finalGrossCommission = ledger && !isJeniffer ? ledger.grossCommission : computedGrossCommission;
  }

  const totalEarnings = baseSalary + transportAllowance + finalGrossCommission + bonusTotal;
  const totalDeductions = chamaTotal + latenessTotal + disciplineTotal + otherDeductionsTotal;
  const netPay = totalEarnings - totalDeductions;

  return {
    periodKey,
    periodLabel,
    attendantEmail: normalizedEmail || null,
    totalSales,
    totalProfit,
    totalNewProducts: newProducts,
    totalEditedProducts: editedProducts,
    totalCopiedProducts: copiedProducts,
    totalItems: usePosTotals ? posSummary?.totalItems ?? 0 : mergedItems || 0,
    totalReceipts: usePosTotals ? posSummary?.totalReceipts ?? 0 : merged.size || 0,
    walkInsServed: 0,
    walkInsPurchased: 0,
    baseSalary,
    transportAllowance,
    salesCommission,
    newProductCommission,
    copiedCommission,
    editedCommission,
    grossCommission: finalGrossCommission,
    commission: finalGrossCommission,
    batteryEarnings: 0,
    bonusTotal,
    commissionTopUpTotal,
    chamaTotal,
    latenessTotal,
    disciplineTotal,
    otherDeductionsTotal,
    totalEarnings,
    totalDeductions,
    netPay,
    ledger: ledger ? ledger : null,
    jenifferProgress: jenifferProgress ?? null,
    adjustmentEntries,
  };
}
