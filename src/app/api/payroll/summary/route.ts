import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/nextAuth";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { getEarningsSummaryForUser } from "@/lib/earningsSummary";
import { summarizeMarketingReportsForPeriod } from "@/lib/marketingPeriodTotals";
import { getSupportPeriodAggregates } from "@/lib/supportEntries";
import { getPeriodKeyVariantsFromDates } from "@/lib/payrollPeriodKey";
import type { AdjustmentEntry, AdjustmentKind } from "@/app/admin/payroll/types";

// Compatibility route for older clients that call /api/payroll/summary
// Behaviour:
// - If the requester is ADMIN and `attendantId` is provided, return admin-style rows
// - Otherwise, if the requester has a session, return the attendant earnings summary for that user
// - Accepts `start` and `end` or `periodKey` query params to scope the period

export const dynamic = "force-dynamic";

function parsePeriod(url: URL) {
  // Enforce server-resolved trading period for payroll/dashboard totals.
  // Do NOT accept arbitrary `start`, `end` or `periodKey` from clients.
  if (url.searchParams.has("start") || url.searchParams.has("end") || url.searchParams.has("periodKey")) {
    throw new Error("This endpoint requires a server-resolved trading period; do not supply start/end/periodKey.");
  }
  return getTradingPeriodFor(new Date());
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const session: any = await getServerSession(authOptions as any);
  const actorId = session?.user?.id ?? null;
  const role = session?.user?.role ?? null;

  // allow query param `attendantId` for compatibility (admins may request others)
  const attendantIdParam = url.searchParams.get("attendantId");

  let period;
  try {
    period = parsePeriod(url);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 400 });
  }

  // If admin requested and provided attendantId, return admin-style single attendant row
  if (role === "ADMIN" || role === "SUPERVISOR") {
    // If attendantId specified, return the single attendant row similar to admin endpoint
    const targetId = attendantIdParam ?? null;

    // Load data similarly to admin route but limit to the target attendant if provided
    const attendants = targetId
      ? await prisma.user.findMany({ where: { id: targetId }, select: { id: true, name: true, email: true, attendantCategory: true, isActive: true } })
      : await prisma.user.findMany({ where: { role: { in: ["ATTENDANT", "SUPERVISOR"] } }, orderBy: [{ attendantCategory: "asc" }, { name: "asc" }], select: { id: true, name: true, email: true, attendantCategory: true, isActive: true } });

    const attendantIds = attendants.map((a) => a.id);

    const periodKeyIso = `${period.start.toISOString()}_${period.end.toISOString()}`;
    const periodKeyVariants = getPeriodKeyVariantsFromDates(period.start, period.end);
    const periodFilterKeys = periodKeyVariants.length ? periodKeyVariants : [periodKeyIso];

    const windowMs = 24 * 60 * 60 * 1000;
    const [plans, ledgers, adjustments] = await Promise.all([
      prisma.attendantCompPlan.findMany({ where: { attendantId: { in: attendantIds } } }),
      // Tolerant ledger fetch: match exact period or nearby periodStart/periodEnd
      prisma.commissionLedger.findMany({
        where: {
          userId: { in: attendantIds },
          OR: [
            { AND: [{ periodStart: { gte: new Date(period.start.getTime() - windowMs) } }, { periodStart: { lte: new Date(period.start.getTime() + windowMs) } }] },
            { AND: [{ periodEnd: { gte: new Date(period.end.getTime() - windowMs) } }, { periodEnd: { lte: new Date(period.end.getTime() + windowMs) } }] },
          ],
        },
      }),
      prisma.attendantPayrollAdjustment.findMany({
        where: { periodKey: { in: periodFilterKeys }, attendantId: { in: attendantIds } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const planMap = new Map(plans.map((p) => [p.attendantId, p]));
    const ledgerMap = new Map(ledgers.map((l) => [l.userId, l]));
    const earningsSummaries = await Promise.all(
      attendantIds.map(async (attendantId) => {
        try {
          return await getEarningsSummaryForUser({ userId: attendantId, asOf: period.start });
        } catch (err) {
          console.warn("[api/payroll/summary] failed to compute earnings summary for", attendantId, err);
          return null;
        }
      }),
    );
    const earningsSummaryMap = new Map(attendantIds.map((id, index) => [id, earningsSummaries[index]]));

    const baseSummary = () => ({
      totalBonus: 0,
      totalDeduction: 0,
      breakdown: { chama: 0, lateness: 0, discipline: 0, other: 0, bonus: 0, commissionTopUp: 0, penalties: 0 },
      entries: [] as AdjustmentEntry[],
    });

    const adjustmentsByAttendant = new Map<string, ReturnType<typeof baseSummary>>();
    for (const adjustment of adjustments) {
      const existing = adjustmentsByAttendant.get(adjustment.attendantId) ?? baseSummary();
      const amount = adjustment.amount ?? 0;
      const bonusType = adjustment.adjustmentType === "BONUS";
      const topUpType = adjustment.adjustmentType === "COMMISSION_TOPUP";
      const kind: AdjustmentKind =
        (adjustment.adjustmentKind as AdjustmentKind | undefined) ??
        (bonusType || topUpType ? "ADDITION" : "DEDUCTION");

      const entry: AdjustmentEntry = {
        id: adjustment.id,
        label: adjustment.label,
        amount,
        adjustmentType: adjustment.adjustmentType,
        kind,
      };
      existing.entries.push(entry);

      if (kind === "ADDITION") {
        existing.totalBonus += amount;
        if (bonusType) existing.breakdown.bonus += amount;
        if (topUpType) existing.breakdown.commissionTopUp += amount;
      } else {
        existing.totalDeduction += amount;
        if (adjustment.adjustmentType === "CHAMA") existing.breakdown.chama += amount;
        if (adjustment.adjustmentType === "LATENESS") existing.breakdown.lateness += amount;
        if (adjustment.adjustmentType === "DISCIPLINE") existing.breakdown.discipline += amount;
        if (adjustment.adjustmentType === "OTHER") existing.breakdown.other += amount;
      }

      adjustmentsByAttendant.set(adjustment.attendantId, existing);
    }

    const rows = attendants.map((attendant) => {
      const plan = planMap.get(attendant.id);
      const ledger = ledgerMap.get(attendant.id);
      const summary = adjustmentsByAttendant.get(attendant.id) ?? baseSummary();

      // Prefer persisted commissionTotal when available (authoritative ledger),
      // fall back to net/gross commission if commissionTotal is not present.
      const commissions = Number(
        ledger?.commissionTotal ?? (ledger as any)?.commission_total ?? ledger?.netCommission ?? ledger?.grossCommission ?? 0,
      );
      const grossCommission = Number(ledger?.grossCommission ?? 0);
      const penalties = Number(ledger?.penalties ?? 0);
      const earningsSummary = earningsSummaryMap.get(attendant.id) ?? null;
      const summarySales = Number(earningsSummary?.totalSales ?? 0);
      const summaryProfit = Number(earningsSummary?.totalProfit ?? 0);
      const detailProfitValue = Number(detail?.totalProfit ?? NaN);
      const resolvedProfit =
        !Number.isNaN(detailProfitValue) && detailProfitValue !== 0 ? detailProfitValue : summaryProfit;
      const detail = ledger?.detail as { totalSales?: number; totalProfit?: number } | undefined;

      const baseSalary = plan?.baseSalary ?? 0;
      const transportAllowance = plan?.defaultTransportAllowance ?? 0;

      const totalEarnings = baseSalary + transportAllowance + commissions + summary.totalBonus;
      const totalDeductions = summary.totalDeduction + penalties;
      const netPay = totalEarnings - totalDeductions;

      summary.breakdown.penalties = penalties;

      return {
        attendantId: attendant.id,
        name: attendant.name,
        email: attendant.email,
        attendantCategory: attendant.attendantCategory,
        isActive: attendant.isActive,
        baseSalary,
        transportAllowance,
        commission: commissions,
        commissionGross: grossCommission,
        bonusTotal: summary.totalBonus,
        deductionTotal: totalDeductions,
        totalEarnings,
        totalDeductions,
        netPay,
        totalSales: Number(detail?.totalSales ?? summarySales),
        totalProfit: resolvedProfit,
        totalReceipts: Number(earningsSummary?.totalReceipts ?? 0),
        totalItems: Number(earningsSummary?.totalItems ?? 0),
        newProducts: Number(earningsSummary?.totalNewProducts ?? 0),
        editedProducts: Number(earningsSummary?.totalEditedProducts ?? 0),
        copiedProducts: Number(earningsSummary?.totalCopiedProducts ?? 0),
        adjustmentBreakdown: summary.breakdown,
        adjustmentEntries: summary.entries,
        commissionDirect: Number(ledger?.commissionDirect ?? 0),
        commissionMarketplaceJumia: Number(ledger?.commissionMarketplaceJumia ?? 0),
        commissionMarketplaceKilimall: Number(ledger?.commissionMarketplaceKilimall ?? 0),
        commissionTotal: commissions,
        commissionBreakdown: ledger?.commissionBreakdown ?? null,
      };
    });

    return NextResponse.json({ periodLabel: period.label ?? "", rows });
  }

  // Non-admin attendants: if attendantId param is provided and matches session or admin impersonation,
  // fall back to the attendant earnings summary behaviour.
  const targetAttendant = url.searchParams.get("attendantId") ?? actorId;
  if (!targetAttendant) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Reuse the attendant earnings summary logic used by the official endpoint
  // Use the parsed `period` (from start/end/periodKey) so non-admin requests
  // can request explicit ranges. If none provided, `parsePeriod` already
  // falls back to the current trading period.
  const [summary, marketingSummary, supportSummary, ledger] = await Promise.all([
    // Pass `asOf` so `getEarningsSummaryForUser` computes using a period
    // that aligns with the requested `start` date when provided.
    getEarningsSummaryForUser({ userId: targetAttendant, asOf: period.start }),
    summarizeMarketingReportsForPeriod({ userId: targetAttendant, period }),
    getSupportPeriodAggregates({ userId: targetAttendant, period }),
    prisma.commissionLedger.findUnique({
      where: {
        userId_periodStart_periodEnd: {
          userId: targetAttendant,
          periodStart: period.start,
          periodEnd: period.end,
        },
      },
    }),
  ]);

  const supportTotals = supportSummary?.aggregates ?? {
    totalSales: 0,
    totalProfit: 0,
    totalReceipts: 0,
    totalItems: 0,
  };

  // Merge per-receipt maps from marketing and support to avoid double-counting
  const marketingPer = (marketingSummary as any)?.perReceipts ?? {};
  const supportPer = (supportSummary as any)?.perReceipts ?? {};
  const merged = new Map<string, { sales: number; profit: number; items: number; mpesa: number; cash: number }>();

  for (const [k, v] of Object.entries(marketingPer) as [string, any][]) {
    merged.set(k, { sales: v.sales ?? 0, profit: v.profit ?? 0, items: v.items ?? 0, mpesa: v.mpesa ?? 0, cash: v.cash ?? 0 });
  }
  for (const [k, v] of Object.entries(supportPer) as [string, any][]) {
    if (merged.has(k)) continue; // marketing wins
    merged.set(k, { sales: v.sales ?? 0, profit: v.profit ?? 0, items: v.items ?? 0, mpesa: v.mpesa ?? 0, cash: v.cash ?? 0 });
  }

  let combinedSales = 0;
  let combinedProfit = 0;
  let combinedItems = 0;
  let combinedReceipts = 0;
  for (const [, v] of merged) {
    combinedSales += v.sales;
    combinedProfit += v.profit;
    combinedItems += v.items;
  }
  combinedReceipts = merged.size;

  const detail = ledger?.detail as Record<string, any> | undefined;
  const marketingCommission = detail && typeof detail === "object" ? Number(detail.marketing?.commission ?? 0) : 0;
  const supportCommission = detail && typeof detail === "object" ? Number(detail.support?.commission ?? 0) : 0;
  const ledgerCommissionDirect = ledger ? Number(ledger.commissionDirect ?? 0) : 0;
  const ledgerCommissionMarketplaceJumia = ledger ? Number(ledger.commissionMarketplaceJumia ?? 0) : 0;
  const ledgerCommissionMarketplaceKilimall = ledger ? Number(ledger.commissionMarketplaceKilimall ?? 0) : 0;
  const ledgerCommissionTotal = ledger
    ? Number(ledger.commissionTotal ?? ledger.netCommission ?? ledger.grossCommission ?? 0)
    : 0;

  let salesCommission = ledgerCommissionTotal || marketingCommission + supportCommission;
  if (salesCommission === 0) {
    salesCommission = summary.salesCommission;
  }

  const grossCommission =
    salesCommission +
    summary.newProductCommission +
    summary.copiedCommission +
    summary.editedCommission +
    summary.commissionTopUpTotal;

  const totalEarnings = summary.baseSalary + summary.transportAllowance + grossCommission + summary.bonusTotal;
  const totalDeductions =
    summary.chamaTotal + summary.latenessTotal + summary.disciplineTotal + summary.otherDeductionsTotal;
  const netPay = totalEarnings - totalDeductions;

  return NextResponse.json({
    ...summary,
    totalSales: combinedSales,
    totalProfit: combinedProfit,
    totalNewProducts: marketingSummary.totals.totalNewProducts,
    totalEditedProducts: marketingSummary.totals.totalEditedProducts,
    totalCopiedProducts: marketingSummary.totals.totalCopiedProducts,
    salesCommission,
    grossCommission,
    totalEarnings,
    totalDeductions,
    netPay,
    totalItems: combinedItems,
    totalReceipts: combinedReceipts,
    commissionDirect: ledgerCommissionDirect,
    commissionMarketplaceJumia: ledgerCommissionMarketplaceJumia,
    commissionMarketplaceKilimall: ledgerCommissionMarketplaceKilimall,
    commissionTotal: ledgerCommissionTotal,
    commissionBreakdown: ledger?.commissionBreakdown ?? null,
    walkInsServed: marketingSummary.totals.walkInsServed,
    walkInsPurchased: marketingSummary.totals.walkInsPurchased,
    ledger: ledger
      ? {
          grossCommission: Number(ledger.grossCommission),
          netCommission: Number(ledger.netCommission),
          penalties: Number(ledger.penalties),
          detail: ledger.detail,
        }
      : null,
  });
}
