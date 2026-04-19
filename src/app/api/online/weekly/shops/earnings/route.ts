import { NextResponse } from "next/server";
import { MarketplaceReturnStatus } from "@prisma/client";
import { computeMarketplaceCommission, resolveDirectCommissionMode } from "@/lib/onlineCommission";
import { prisma } from "@/lib/prisma";
import { requireAttendant } from "@/lib/auth";
import { getAssignedMarketplaceSalesForPeriod } from "@/lib/onlineOps";
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
    const rawShare = index === rows.length - 1 ? totalCommission - allocated : Math.round((sales / totalSales) * totalCommission);
    allocated += index === rows.length - 1 ? totalCommission - allocated : rawShare;
    return Math.max(0, rawShare - Number(row.chargedReturns ?? 0));
  });
};

export async function GET(req: Request) {
  const auth = await requireAttendant(req, [
    "JUMIA_KILIMALL_OPS",
    "BETECH_OPS",
    "SUPERVISOR",
    "ADMIN",
  ]);
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
  const useCombinedMarketplaceLadder =
    resolveDirectCommissionMode(targetUser?.email) === "PROFIT_10";

  const url = new URL(req.url);
  const startParam = parseDateParam(url.searchParams.get("start"));
  const endParam = parseDateParam(url.searchParams.get("end"));
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

  if (!marketplaceSalesSummary.rows.length) {
    const emptyResponse = {
      rangeLabel,
      totals: { sales: 0, commission: 0, orders: 0, shops: 0 },
      rows: [],
    };
    return NextResponse.json(composeIdentityResponse(meta, emptyResponse));
  }

  const returns = await prisma.marketplaceReturn.findMany({
    where: {
      accountId: { in: marketplaceSalesSummary.rows.map((row) => row.accountId) },
      dueAt: { gte: start, lte: end },
      status: MarketplaceReturnStatus.CHARGED_TO_ATTENDANT,
    },
    select: {
      accountId: true,
      expectedAmount: true,
    },
  });

  const rows = marketplaceSalesSummary.rows
    .map((account) => {
      const accountReturns = returns.filter((entry) => entry.accountId === account.accountId);
      const chargedReturns = accountReturns.reduce(
        (sum, entry) => sum + Number(entry.expectedAmount ?? 0),
        0,
      );

      return {
        shopId: account.accountId,
        shopName: account.displayName,
        platform: account.platform,
        weekLabel,
        weekStart: start.toISOString(),
        weekEnd: end.toISOString(),
        sales: Number(account.sales ?? 0),
        commission: 0,
        chargedReturns,
        orders: Number(account.orders ?? 0),
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
  };

  return NextResponse.json(composeIdentityResponse(meta, data));
}
