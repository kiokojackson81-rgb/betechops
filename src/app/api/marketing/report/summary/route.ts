import { NextResponse } from "next/server";
import { requireRole, getActorId } from "@/lib/api";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { getCurrentTradingPeriodFor } from "@/lib/marketingPeriod";
import { summarizeMarketingReportsForPeriod } from "@/lib/marketingPeriodTotals";
import { getSupportPeriodAggregates } from "@/lib/supportEntries";
import { getCommissionSummaryForSales } from "@/lib/marketingCommission";
import { getUnpricedDailySalesForCurrentPeriod } from "@/lib/marketingUnpricedSales";
import { getOrCreateCommissionPeriod } from "@/lib/commission";
import { prisma } from "@/lib/prisma";
import { nowInNairobi } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const impersonateId = url.searchParams.get("impersonateId");
  const actorId = await getActorId();
  const targetUserId = impersonateId && auth.role === "ADMIN" ? impersonateId : actorId;
  if (!targetUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = nowInNairobi();
  await getOrCreateCommissionPeriod(today);
  const current = await getCurrentTradingPeriodFor(today);

  const argPeriod: any = {
    start: current.startDate,
    end: current.endDate,
    key: current.key,
    label: current.label,
  };

  if (!(today >= argPeriod.start && today <= argPeriod.end)) {
    const fallback = getTradingPeriodFor(today);
    argPeriod.start = fallback.start;
    argPeriod.end = fallback.end;
    argPeriod.key = fallback.key;
    argPeriod.label = fallback.label;
  }

  // Period data for the response (current-only).
  const startDate: Date = argPeriod.start;
  const endDate: Date = argPeriod.end;

  const [{ totals: marketingTotals }, supportSummary] = await Promise.all([
    summarizeMarketingReportsForPeriod({ userId: targetUserId, period: argPeriod }),
    getSupportPeriodAggregates({ userId: targetUserId, period: argPeriod }),
  ]);

  const supportTotals = supportSummary?.aggregates ?? {
    totalSales: 0,
    totalProfit: 0,
    totalReceipts: 0,
    totalItems: 0,
  };

  const totalSales = marketingTotals.totalSales + supportTotals.totalSales;
  const totalProfit = marketingTotals.totalProfit + supportTotals.totalProfit;
  const totalItems = marketingTotals.totalItems + supportTotals.totalItems;
  const totalReceipts = marketingTotals.totalReceipts + supportTotals.totalReceipts;

  let commission = 0;
  if (totalProfit > 0) {
    const commissionInfo = getCommissionSummaryForSales(totalSales);
    commission = commissionInfo.commission ?? 0;
    if (commission === 0 && totalSales > 0 && totalSales < 500_000) {
      commission = Math.round(Math.max(totalProfit, 0) * 0.05);
    }
  }

  // If there are any unpriced sales for this attendant in the current
  // period, zero out commission until pricing is completed. This prevents
  // attendants from receiving commission computed from unpriced receipts.
  try {
    const user = await prisma.user.findUnique({ where: { id: targetUserId }, select: { email: true } });
    const userEmail = user?.email?.toLowerCase() ?? null;
    if (userEmail) {
      const unpriced = await getUnpricedDailySalesForCurrentPeriod();
      const hasUnpricedForUser = unpriced.some((s) => (s.attendantEmail ?? "").toLowerCase() === userEmail);
      if (hasUnpricedForUser) {
        commission = 0;
      }
    }
  } catch (e) {
    // If pricing check fails, do not block returning computed commission —
    // silently ignore and return the computed value.
  }

  const normalizedPeriod = {
    key: String(argPeriod.key ?? ""),
    label: String(argPeriod.label ?? ""),
    start: startDate.toISOString(),
    end: endDate.toISOString(),
  };

  // Prefer an existing CommissionLedger row as the authoritative source
  // for displayed commission. If a ledger exists for the target user+period
  // use its detail (marketing/support) commission values or the stored
  // netCommission/grossCommission. This ensures the UI shows explicit zero
  // when the ledger has been zeroed (e.g., pending pricing).
  try {
    const ledger = await prisma.commissionLedger.findUnique({
      where: {
        userId_periodStart_periodEnd: {
          userId: targetUserId,
          periodStart: startDate,
          periodEnd: endDate,
        },
      },
    });

    if (ledger) {
      const detail: any = ledger.detail ?? {};
      const marketingCommission = Number(detail.marketing?.commission ?? 0);
      const supportCommission = Number(detail.support?.commission ?? 0);
      const combinedDetailCommission = marketingCommission + supportCommission;

      // If the ledger stores explicit detail commissions, use those. Otherwise
      // fall back to the ledger's netCommission (or grossCommission). This
      // guarantees that a zeroed ledger results in a displayed zero.
      if (combinedDetailCommission > 0) {
        commission = combinedDetailCommission;
      } else {
        // Prefer netCommission; if absent, use grossCommission; otherwise keep
        // the previously computed value.
        const ledgerNet = Number(ledger.netCommission ?? ledger.grossCommission ?? commission);
        commission = Number.isFinite(ledgerNet) ? ledgerNet : commission;
      }
    }
  } catch (e) {
    // If ledger lookup fails, continue with the computed commission above.
  }

  const response = NextResponse.json({
    period: normalizedPeriod,
    aggregates: {
      totalSales,
      totalProfit,
      totalItems,
      totalReceipts,
      paymentStats: marketingTotals.paymentStats,
      commission: { commission },
    },
  });
  response.headers.set("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate");
  return response;
}
