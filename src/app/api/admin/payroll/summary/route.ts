import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const startParam = url.searchParams.get("start");
  const endParam = url.searchParams.get("end");
  const periodKeyParam = url.searchParams.get("periodKey");

  let period: { start: Date; end: Date; label?: string };
  if (periodKeyParam) {
    // Expecting format "<startIso>_<endIso>"
    const parts = String(periodKeyParam).split("_");
    if (parts.length === 2) {
      const s = new Date(parts[0]);
      const e = new Date(parts[1]);
      period = { start: s, end: e };
      period.label = `${s.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} - ${e.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
    } else {
      period = getTradingPeriodFor(new Date());
    }
  } else if (startParam && endParam) {
    const s = new Date(startParam);
    const e = new Date(endParam);
    period = { start: s, end: e };
    period.label = `${s.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} - ${e.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
  } else {
    period = getTradingPeriodFor(new Date());
  }

  const periodKey = `${period.start.toISOString()}_${period.end.toISOString()}`;

  const attendants = await prisma.user.findMany({
    where: { role: { in: ["ATTENDANT", "SUPERVISOR"] } },
    orderBy: [{ attendantCategory: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, attendantCategory: true, isActive: true },
  });

  const attendantIds = attendants.map((a) => a.id);

  const [plans, ledgers, adjustments] = await Promise.all([
    prisma.attendantCompPlan.findMany({ where: { attendantId: { in: attendantIds } } }),
    prisma.commissionLedger.findMany({
      where: { periodStart: period.start, periodEnd: period.end, userId: { in: attendantIds } },
    }),
    prisma.attendantPayrollAdjustment.findMany({ where: { periodKey, attendantId: { in: attendantIds } }, orderBy: { createdAt: "desc" } }),
  ]);

  const planMap = new Map(plans.map((p) => [p.attendantId, p]));
  const ledgerMap = new Map(ledgers.map((l) => [l.userId, l]));

  const baseSummary = () => ({
    totalBonus: 0,
    totalDeduction: 0,
    breakdown: { chama: 0, lateness: 0, discipline: 0, other: 0, bonus: 0, commissionTopUp: 0, penalties: 0 },
  });

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

    const commissionDirect = Number(ledger?.commissionDirect ?? 0);
    const commissionMarketplaceJumia = Number(ledger?.commissionMarketplaceJumia ?? 0);
    const commissionMarketplaceKilimall = Number(ledger?.commissionMarketplaceKilimall ?? 0);
    const ledgerCommissionTotal = Number(
      ledger?.commissionTotal ?? ledger?.netCommission ?? ledger?.grossCommission ?? 0,
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
      commission: ledgerCommissionTotal,
      commissionGross: grossCommission,
      commissionDirect,
      commissionMarketplaceJumia,
      commissionMarketplaceKilimall,
      commissionTotal: ledgerCommissionTotal,
      commissionBreakdown: ledger?.commissionBreakdown ?? null,
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

  return NextResponse.json({ periodLabel: (period as any).label ?? "", rows });
}
