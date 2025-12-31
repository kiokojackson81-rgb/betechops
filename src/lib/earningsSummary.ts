import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { getOrCreateCommissionPeriod, computeSalesCommissionFromTiers, computeProductCommissions } from "./commission";
import { summarizeMarketingReportsForPeriod } from "@/lib/marketingPeriodTotals";
import { getSupportPeriodAggregates } from "@/lib/supportEntries";

export type EarningsSummary = {
  periodKey: string;
  periodLabel: string;

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

  const marketingSummary = await summarizeMarketingReportsForPeriod({
    userId: opts.userId,
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
    if (merged.has(k)) continue;
    merged.set(k, { sales: v.sales ?? 0, profit: v.profit ?? 0, items: v.items ?? 0, mpesa: v.mpesa ?? 0, cash: v.cash ?? 0 });
  }
  let mergedSales = 0;
  let mergedProfit = 0;
  let mergedItems = 0;
  for (const [, v] of merged) {
    mergedSales += v.sales;
    mergedProfit += v.profit;
    mergedItems += v.items ?? 0;
  }

  // Prefer the larger of snapshot-derived totals and marketing+support merged totals
  if (mergedSales > totalSales) {
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

  // Attempt to load any existing CommissionLedger for this attendant/period.
  // Some ledgers were created with period boundaries normalized to local
  // midnight (YYYY-MM-DD 00:00:00) while others use TZ-normalized bounds
  // (e.g., 21:00:00Z). Try both exact periodStart/periodEnd and also look
  // for a matching `detail.marketing.periodKey` to find overlapping ledgers.
  let ledger: { grossCommission: number; netCommission: number; penalties: number; detail: unknown } | null = null;
  try {
    const exact = await prisma.commissionLedger.findUnique({
      where: {
        userId_periodStart_periodEnd: {
          userId: opts.userId,
          periodStart: tradingPeriod.start,
          periodEnd: tradingPeriod.end,
        },
      },
    });
    let found: any = exact ?? null;
    if (!found) {
      const periodKeyDateOnlyLocal = `${tradingPeriod.start.toISOString().split("T")[0]}_${tradingPeriod.end.toISOString().split("T")[0]}`;
      const res: any = await prisma.$queryRaw`
        SELECT id, "grossCommission", "netCommission", "penalties", detail
        FROM "CommissionLedger"
        WHERE "userId" = ${opts.userId}
          AND (
            (detail->'marketing'->>'periodKey') = ${tradingPeriod.key}
            OR (detail->'marketing'->>'periodKey') = ${periodKeyDateOnlyLocal}
          )
        LIMIT 1
      `;
      if (Array.isArray(res) && res.length > 0) found = res[0];
    }
    if (found) {
      ledger = {
        grossCommission: Number(found.grossCommission ?? 0),
        netCommission: Number(found.netCommission ?? 0),
        penalties: Number(found.penalties ?? 0),
        detail: found.detail ?? null,
      };
    }
    // If still not found, try a tolerant lookup: find any ledger for the user
    // whose periodStart is within +/- 24 hours of the expected period start.
    if (!ledger) {
      try {
        const windowMs = 24 * 60 * 60 * 1000;
        const near = await prisma.commissionLedger.findFirst({
          where: {
            userId: opts.userId,
            periodStart: { gte: new Date(tradingPeriod.start.getTime() - windowMs), lte: new Date(tradingPeriod.start.getTime() + windowMs) },
          },
          orderBy: { createdAt: "desc" },
        });
        if (near) {
          ledger = {
            grossCommission: Number(near.grossCommission ?? 0),
            netCommission: Number(near.netCommission ?? 0),
            penalties: Number(near.penalties ?? 0),
            detail: near.detail ?? null,
          };
        }
      } catch (e) {
        // ignore tolerant lookup failures
      }
    }
  } catch (err) {
    // best-effort: if ledger lookup fails, proceed with computed values
    ledger = null;
  }

  // For the attendant-facing earnings summary we use the default behaviour
  // (which applies the configured profit-fallback percent) so this endpoint
  // mirrors previous commission calculations.
  const fallbackPercent = totalProfit > 0 ? 0.05 : 0;
  const salesCommission = computeSalesCommissionFromTiers(totalSales, totalProfit, tiers, fallbackPercent);
  const { newProductCommission, copiedCommission, editedCommission } = computeProductCommissions({
    newProducts,
    copiedProducts,
    editedProducts,
  });

  const computedGrossCommission =
    salesCommission + newProductCommission + copiedCommission + editedCommission + commissionTopUpTotal;

  // If a persisted ledger exists, prefer its grossCommission as the authoritative
  // commission total and use it to compute earnings/net pay so the payroll UI
  // mirrors the ledger-backed numbers shown in the front-end dashboard.
  const finalGrossCommission = ledger ? ledger.grossCommission : computedGrossCommission;

  const totalEarnings = baseSalary + transportAllowance + finalGrossCommission + bonusTotal;
  const totalDeductions = chamaTotal + latenessTotal + disciplineTotal + otherDeductionsTotal;
  const netPay = totalEarnings - totalDeductions;

  return {
    periodKey,
    periodLabel,
    totalSales,
    totalProfit,
    totalNewProducts: newProducts,
    totalEditedProducts: editedProducts,
    totalCopiedProducts: copiedProducts,
    totalItems: mergedItems || 0,
    totalReceipts: merged.size || 0,
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
    adjustmentEntries,
  };
}
