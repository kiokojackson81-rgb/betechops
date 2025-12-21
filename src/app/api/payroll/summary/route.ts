import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/nextAuth";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { getEarningsSummaryForUser } from "@/lib/earningsSummary";
import { summarizeMarketingReportsForPeriod } from "@/lib/marketingPeriodTotals";
import { getSupportPeriodAggregates } from "@/lib/supportEntries";

// Compatibility route for older clients that call /api/payroll/summary
// Behaviour:
// - If the requester is ADMIN and `attendantId` is provided, return admin-style rows
// - Otherwise, if the requester has a session, return the attendant earnings summary for that user
// - Accepts `start` and `end` or `periodKey` query params to scope the period

export const dynamic = "force-dynamic";

function parsePeriod(url: URL) {
  const startParam = url.searchParams.get("start");
  const endParam = url.searchParams.get("end");
  const periodKeyParam = url.searchParams.get("periodKey");

  if (periodKeyParam) {
    const parts = String(periodKeyParam).split("_");
    if (parts.length === 2) {
      const s = new Date(parts[0]);
      const e = new Date(parts[1]);
      return { start: s, end: e, label: `${s.toLocaleDateString("en-GB")} - ${e.toLocaleDateString("en-GB")}`, key: `${s.toISOString()}_${e.toISOString()}` };
    }
  }

  if (startParam && endParam) {
    const s = new Date(startParam);
    const e = new Date(endParam);
    return { start: s, end: e, label: `${s.toLocaleDateString("en-GB")} - ${e.toLocaleDateString("en-GB")}`, key: `${s.toISOString()}_${e.toISOString()}` };
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

  const period = parsePeriod(url);

  // If admin requested and provided attendantId, return admin-style single attendant row
  if (role === "ADMIN" || role === "SUPERVISOR") {
    // If attendantId specified, return the single attendant row similar to admin endpoint
    const targetId = attendantIdParam ?? null;

    // Load data similarly to admin route but limit to the target attendant if provided
    const attendants = targetId
      ? await prisma.user.findMany({ where: { id: targetId }, select: { id: true, name: true, email: true, attendantCategory: true, isActive: true } })
      : await prisma.user.findMany({ where: { role: { in: ["ATTENDANT", "SUPERVISOR"] } }, orderBy: [{ attendantCategory: "asc" }, { name: "asc" }], select: { id: true, name: true, email: true, attendantCategory: true, isActive: true } });

    const attendantIds = attendants.map((a) => a.id);

    const [plans, ledgers, adjustments] = await Promise.all([
      prisma.attendantCompPlan.findMany({ where: { attendantId: { in: attendantIds } } }),
      prisma.commissionLedger.findMany({ where: { periodStart: period.start, periodEnd: period.end, userId: { in: attendantIds } } }),
      prisma.attendantPayrollAdjustment.findMany({ where: { periodKey: `${period.start.toISOString()}_${period.end.toISOString()}`, attendantId: { in: attendantIds } }, orderBy: { createdAt: "desc" } }),
    ]);

    const planMap = new Map(plans.map((p) => [p.attendantId, p]));
    const ledgerMap = new Map(ledgers.map((l) => [l.userId, l]));

    const baseSummary = () => ({ totalBonus: 0, totalDeduction: 0, breakdown: { chama: 0, lateness: 0, discipline: 0, other: 0, bonus: 0, commissionTopUp: 0, penalties: 0 } });

    const adjustmentsByAttendant = new Map<string, ReturnType<typeof baseSummary>>();
    for (const adjustment of adjustments) {
      const existing = adjustmentsByAttendant.get(adjustment.attendantId) ?? baseSummary();
      const amount = adjustment.amount ?? 0;
      const bonusType = adjustment.adjustmentType === "BONUS";
      const topUpType = adjustment.adjustmentType === "COMMISSION_TOPUP";

      if (bonusType) {
        existing.totalBonus += amount;
        existing.breakdown.bonus += amount;
      } else if (topUpType) {
        existing.totalBonus += amount;
        existing.breakdown.commissionTopUp += amount;
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
        totalSales: Number(detail?.totalSales ?? 0),
        totalProfit: Number(detail?.totalProfit ?? 0),
        adjustmentBreakdown: summary.breakdown,
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

  const combinedSales = marketingSummary.totals.totalSales + supportTotals.totalSales;
  const combinedProfit = marketingSummary.totals.totalProfit + supportTotals.totalProfit;
  const combinedItems = marketingSummary.totals.totalItems + supportTotals.totalItems;
  const combinedReceipts = marketingSummary.totals.totalReceipts + supportTotals.totalReceipts;

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
