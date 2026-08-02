import { NextResponse } from "next/server";
import { MarketplaceReturnStatus } from "@prisma/client";
import { computeMarketplaceCommission, resolveDirectCommissionMode } from "@/lib/onlineCommission";
import { resolveOperatingCapitalSummaryInputs } from "@/lib/operatingCapital";
import {
  calculateOperatingCapitalFigures,
  isOperatingCapitalReadyToFinalize,
} from "@/lib/operatingCapitalMath";
import { prisma } from "@/lib/prisma";
import { requireAttendant } from "@/lib/auth";
import { getAssignedMarketplaceSalesForPeriod } from "@/lib/onlineOps";
import { getPricingWeekSummary, type PricingWeekAccountStatus } from "@/lib/pricingWeekWhatsapp";
import { composeIdentityResponse, resolveTargetUserId } from "@/lib/resolveTargetUser";

export const dynamic = "force-dynamic";

const weekRangeForDate = (reference: Date) => {
  const now = new Date(reference);
  const day = now.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - diffToMonday);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return { start: weekStart, end: weekEnd };
};

const formatRangeLabel = (start: Date, end: Date) => {
  const format = (value: Date) =>
    value.toLocaleDateString("en-KE", { day: "2-digit", month: "short" });
  return `Week (${format(start)} - ${format(end)})`;
};

const parseDateParam = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeWeekKey = (value: string | null | undefined) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw.slice(0, 10);
  return parsed.toISOString().slice(0, 10);
};

const allocateCombinedMarketplaceCommission = <T extends { sales: number; chargedReturns?: number }>(
  rows: T[],
  totalCommission: number,
) => {
  const totalSales = rows.reduce((sum, row) => sum + Number(row.sales ?? 0), 0);
  if (totalCommission <= 0 || totalSales <= 0) {
    return rows.map((row) => Math.max(0, 0 - Number(row.chargedReturns ?? 0)));
  }

  let allocated = 0;
  return rows.map((row, index) => {
    const sales = Number(row.sales ?? 0);
    const rawShare =
      index === rows.length - 1 ? totalCommission - allocated : Math.round((sales / totalSales) * totalCommission);
    allocated += index === rows.length - 1 ? totalCommission - allocated : rawShare;
    return Math.max(0, rawShare - Number(row.chargedReturns ?? 0));
  });
};

function getAccountSubmissionStatus(account: PricingWeekAccountStatus) {
  if (account.markedZero) return "ZERO";
  if (account.complete) return "SUBMITTED";
  if (account.hasDraft || account.hasProfitEntries) return "LOADED";
  return "NOT_SUBMITTED";
}

export async function GET(req: Request) {
  const auth = await requireAttendant(req, ["JUMIA_KILIMALL_OPS", "BETECH_OPS", "SUPERVISOR", "ADMIN"]);
  if (!auth.ok) return auth.res;

  const identity = await resolveTargetUserId(req);
  const meta = identity;
  const targetUserId = identity.resolvedUserId;
  if (!targetUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { email: true },
  });
  const useCombinedMarketplaceLadder = resolveDirectCommissionMode(targetUser?.email) === "PROFIT_10";

  const url = new URL(req.url);
  const startParam = parseDateParam(url.searchParams.get("start"));
  const endParam = parseDateParam(url.searchParams.get("end"));
  const selectedWeekKeys = new Set(
    url.searchParams
      .getAll("weekStart")
      .map((value) => normalizeWeekKey(value))
      .filter(Boolean),
  );
  const defaultRange = weekRangeForDate(new Date());
  const start = startParam ?? defaultRange.start;
  const end = endParam ?? defaultRange.end;

  const rangeLabel = formatRangeLabel(start, end);
  const weekLabel = `${start.toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
  })} - ${end.toLocaleDateString("en-KE", { day: "2-digit", month: "short" })}`;

  const marketplaceSalesSummary = await getAssignedMarketplaceSalesForPeriod(targetUserId, {
    key: "custom",
    label: rangeLabel,
    start,
    end,
  });

  const filteredWeeklyRows = selectedWeekKeys.size
    ? marketplaceSalesSummary.weeklyRows.filter((row) => selectedWeekKeys.has(normalizeWeekKey(row.weekStart)))
    : marketplaceSalesSummary.weeklyRows;
  const accountIds = Array.from(new Set(marketplaceSalesSummary.rows.map((row) => String(row.accountId ?? "").trim()).filter(Boolean)));
  const weeklyWindowStarts = Array.from(
    new Set(filteredWeeklyRows.map((row) => String(row.weekStart ?? "").trim()).filter(Boolean)),
  ).map((value) => new Date(value));
  const weekKeysForStatuses = selectedWeekKeys.size
    ? Array.from(selectedWeekKeys)
    : Array.from(new Set(filteredWeeklyRows.map((row) => normalizeWeekKey(row.weekStart)).filter(Boolean)));
  const accountStatuses = accountIds.length && weekKeysForStatuses.length
    ? (
        await Promise.all(
          weekKeysForStatuses.map((weekKey) => getPricingWeekSummary(weekKey, { accountIds })),
        )
      ).flatMap((summary) =>
        summary.accounts.map((account) => ({
          accountId: account.accountId,
          weekStart: summary.week_start,
          status: getAccountSubmissionStatus(account),
          markedZero: account.markedZero,
          hasDraft: account.hasDraft,
          hasProfitEntries: account.hasProfitEntries,
          complete: account.complete,
          missingPricing: account.missingPricing,
        })),
      )
    : [];

  if (!marketplaceSalesSummary.rows.length) {
    const emptyResponse = {
      rangeLabel,
      totals: { sales: 0, commission: 0, orders: 0, shops: 0 },
      rows: [],
      weeklyRows: [],
      accountStatuses: [],
      useCombinedMarketplaceLadder,
    };
    return NextResponse.json(composeIdentityResponse(meta, emptyResponse));
  }

  const weeklyProfitAgg = weeklyWindowStarts.length
    ? await (prisma as any).marketplaceProfitEntry.groupBy({
        by: ["weekStart"],
        where: {
          weekStart: { in: weeklyWindowStarts },
        },
        _sum: {
          netPayout: true,
          profit: true,
        },
      })
    : [];
  const globalWeeklySalesRows = weeklyWindowStarts.length
    ? await prisma.weeklySale.findMany({
        where: {
          weekStart: { in: weeklyWindowStarts },
          status: { not: "REJECTED" },
        },
        select: {
          weekStart: true,
          amount: true,
        },
      })
    : [];

  const returnWhere = selectedWeekKeys.size
    ? {
        OR: Array.from(selectedWeekKeys).map((weekKey) => {
          const weekStart = new Date(`${weekKey}T00:00:00.000Z`);
          const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
          return { dueAt: { gte: weekStart, lte: weekEnd } };
        }),
      }
    : {
        dueAt: { gte: start, lte: end },
      };

  const returns = await prisma.marketplaceReturn.findMany({
    where: {
      accountId: { in: marketplaceSalesSummary.rows.map((row) => row.accountId) },
      ...returnWhere,
      status: MarketplaceReturnStatus.CHARGED_TO_ATTENDANT,
    },
    select: {
      accountId: true,
      expectedAmount: true,
    },
  });

  const weeklyByAccountId = new Map<string, { sales: number; orders: number; weekStarts: Set<string>; weekEnds: Set<string> }>();
  for (const row of filteredWeeklyRows) {
    const accountKey = String(row.accountId ?? "").trim();
    if (!accountKey) continue;
    const current = weeklyByAccountId.get(accountKey) ?? {
      sales: 0,
      orders: 0,
      weekStarts: new Set<string>(),
      weekEnds: new Set<string>(),
    };
    current.sales += Number(row.sales ?? 0);
    current.orders += Number(row.orders ?? 0);
    if (row.weekStart) current.weekStarts.add(new Date(row.weekStart).toISOString());
    if (row.weekEnd) current.weekEnds.add(new Date(row.weekEnd).toISOString());
    weeklyByAccountId.set(accountKey, current);

  }

  const weeklySalesByWeekKey = new Map<string, number>();
  for (const row of globalWeeklySalesRows) {
    const weekKey = normalizeWeekKey(row.weekStart?.toISOString?.() ?? row.weekStart);
    weeklySalesByWeekKey.set(weekKey, (weeklySalesByWeekKey.get(weekKey) ?? 0) + Number(row.amount ?? 0));
  }

  const weeklyProfitByWeekKey = new Map(
    (weeklyProfitAgg as Array<{ weekStart: Date; _sum?: { netPayout?: unknown; profit?: unknown } }>).map((row) => [
      normalizeWeekKey(row.weekStart?.toISOString?.() ?? row.weekStart),
      {
        netPayout: Number(row._sum?.netPayout ?? 0),
        profit: Number(row._sum?.profit ?? 0),
      },
    ]),
  );

  const selectedRangeOperatingCapitalWeeks = await Promise.all(
    weekKeysForStatuses.map(async (weekKey) => {
      const completion = await getPricingWeekSummary(weekKey);
      const fallbackAgg = weeklyProfitByWeekKey.get(weekKey) ?? { netPayout: 0, profit: 0 };
      const fallbackCurrentNetPayout = weeklySalesByWeekKey.get(weekKey) ?? fallbackAgg.netPayout;
      const inputs = resolveOperatingCapitalSummaryInputs({
        completionSummary: completion,
        fallbackCurrentNetPayout,
        fallbackProfit: fallbackAgg.profit,
      });
      const figures = calculateOperatingCapitalFigures(inputs);
      return {
        weekStart: weekKey,
        isReady: isOperatingCapitalReadyToFinalize(completion),
        grossSalesBeforeDeduction: Number(figures.currentNetPayout.toFixed(0)),
        profit: Number(figures.profit.toFixed(0)),
        operatingCapital: Number(figures.operatingCapital.toFixed(0)),
        netPayoutAfterDeduction: Number(figures.adjustedNetPayout.toFixed(0)),
      };
    }),
  );
  const selectedRangeOperatingCapital = selectedRangeOperatingCapitalWeeks.reduce(
    (acc, week) => {
      acc.grossSalesBeforeDeduction += week.grossSalesBeforeDeduction;
      acc.profit += week.profit;
      acc.operatingCapital += week.operatingCapital;
      acc.netPayoutAfterDeduction += week.netPayoutAfterDeduction;
      acc.coveredWeeks += 1;
      acc.readyWeeks += week.isReady ? 1 : 0;
      return acc;
    },
    {
      grossSalesBeforeDeduction: 0,
      profit: 0,
      operatingCapital: 0,
      netPayoutAfterDeduction: 0,
      coveredWeeks: 0,
      readyWeeks: 0,
    },
  );

  const rows = marketplaceSalesSummary.rows
    .map((account) => {
      const accountReturns = returns.filter((entry) => entry.accountId === account.accountId);
      const chargedReturns = accountReturns.reduce((sum, entry) => sum + Number(entry.expectedAmount ?? 0), 0);
      const weeklyTotals = weeklyByAccountId.get(account.accountId);
      const sales = weeklyTotals ? Number(weeklyTotals.sales ?? 0) : Number(account.sales ?? 0);
      const orders = weeklyTotals ? Number(weeklyTotals.orders ?? 0) : Number(account.orders ?? 0);
      const defaultWeekStart = start.toISOString();
      const defaultWeekEnd = end.toISOString();

      return {
        shopId: account.accountId,
        accountId: account.accountId,
        shopIds: account.shopIds,
        shopName: account.displayName,
        platform: account.platform,
        weekLabel,
        weekStart: weeklyTotals?.weekStarts.size === 1 ? Array.from(weeklyTotals.weekStarts)[0] : defaultWeekStart,
        weekEnd: weeklyTotals?.weekEnds.size === 1 ? Array.from(weeklyTotals.weekEnds)[0] : defaultWeekEnd,
        sales,
        commission: 0,
        chargedReturns,
        orders,
      };
    })
    .sort((a, b) => b.sales - a.sales);
  const finalRowsBase = rows;
  const finalRows = useCombinedMarketplaceLadder
    ? (() => {
        const combinedCommission = Number(
          computeMarketplaceCommission(finalRowsBase.reduce((sum, row) => sum + Number(row.sales ?? 0), 0)).amount || 0,
        );
        const rowCommissions = allocateCombinedMarketplaceCommission(finalRowsBase, combinedCommission);
        return finalRowsBase.map((row, index) => ({
          ...row,
          commission: rowCommissions[index] ?? 0,
        }));
      })()
    : finalRowsBase.map((row) => ({
        ...row,
        commission: Math.max(0, Number(computeMarketplaceCommission(row.sales).amount || 0) - Number(row.chargedReturns ?? 0)),
      }));

  const totals = finalRows.reduce(
    (acc, row) => {
      acc.sales += row.sales;
      acc.commission += row.commission;
      acc.orders += row.orders ?? 0;
      return acc;
    },
    { sales: 0, commission: 0, orders: 0 },
  );

  const data = {
    rangeLabel,
    totals: { ...totals, shops: finalRows.length },
    rows: finalRows,
    weeklyRows: filteredWeeklyRows.map((row) => ({
      shopId: row.accountId,
      accountId: row.accountId,
      shopIds: row.shopIds,
      shopName: row.displayName,
      platform: row.platform,
      weekLabel,
      weekStart: row.weekStart,
      weekEnd: row.weekEnd,
      sales: Number(row.sales ?? 0),
      commission: 0,
      chargedReturns: 0,
      orders: Number(row.orders ?? 0),
    })),
    accountStatuses,
    selectedRangeOperatingCapital: {
      ...selectedRangeOperatingCapital,
      allWeeksReady:
        selectedRangeOperatingCapital.coveredWeeks > 0 &&
        selectedRangeOperatingCapital.readyWeeks === selectedRangeOperatingCapital.coveredWeeks,
      weeks: selectedRangeOperatingCapitalWeeks,
    },
    useCombinedMarketplaceLadder,
  };

  return NextResponse.json(composeIdentityResponse(meta, data));
}
