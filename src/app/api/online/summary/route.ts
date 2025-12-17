import { NextResponse } from "next/server";
import { requireAttendant } from "@/lib/auth";
import { getMarketplaceAssignmentsForUser } from "@/lib/onlineOps";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";

export const dynamic = "force-dynamic";

const parseDateParam = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export async function GET(req: Request) {
  const auth = await requireAttendant(req, ["JUMIA_KILIMALL_OPS", "BETECH_OPS", "SUPERVISOR", "ADMIN"]);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const startParam = parseDateParam(url.searchParams.get("start"));
  const endParam = parseDateParam(url.searchParams.get("end"));
  const period = getTradingPeriodFor(new Date());
  const start = startParam ?? period.start;
  const end = endParam ?? period.end;
  const periodLabel = `${start.toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
  })} - ${end.toLocaleDateString("en-KE", { day: "2-digit", month: "short" })}`;

  const { assignments, accountIds } = await getMarketplaceAssignmentsForUser(auth.user.id);
  if (!accountIds.length) {
    return NextResponse.json({
      period: { key: period.key, label: periodLabel, start: start.toISOString(), end: end.toISOString() },
      totals: { orders: 0, sales: 0, commission: 0, marketplaceSales: 0, remainingToNextTier: 2000000 },
      platforms: [],
      assignedAccounts: assignments.map((a) => ({ id: a.accountId, name: a.account?.displayName ?? null, platform: a.account?.platform })),
    });
  }

  const accounts = await prisma.marketplaceAccount.findMany({
    where: { id: { in: accountIds } },
    select: { id: true, displayName: true, platform: true },
  });
  const accountMap = new Map(accounts.map((account) => [account.id, account]));

  const orders = await prisma.marketplaceOrder.findMany({
    where: {
      accountId: { in: accountIds },
      orderedAt: { gte: start, lte: end },
    },
    select: {
      accountId: true,
      sellingPrice: true,
      profit: true,
    },
  });

  const platformBuckets = new Map<
    string,
    { key: string; name: string; sales: number; commission: number; orders: number }
  >();
  let totalSales = 0;
  let totalCommission = 0;

  for (const order of orders) {
    const account = accountMap.get(order.accountId);
    const platformKey = (account?.platform ?? "UNKNOWN").toUpperCase();
    const bucket = platformBuckets.get(platformKey) ?? {
      key: platformKey,
      name: account?.displayName ?? platformKey,
      sales: 0,
      commission: 0,
      orders: 0,
    };
    const sales = Number(order.sellingPrice ?? 0);
    const commission = Number(order.profit ?? 0);
    bucket.sales += sales;
    bucket.commission += commission;
    bucket.orders += 1;
    platformBuckets.set(platformKey, bucket);
    totalSales += sales;
    totalCommission += commission;
  }

  const platforms = Array.from(platformBuckets.values());

  // include marketplace payout weeks and weekly manual sales in marketplace totals
  let payoutSales = 0;
  if (accountIds.length) {
    const payoutWeeks = await prisma.marketplacePayoutWeek.findMany({
      where: { accountId: { in: accountIds }, weekEnd: { gte: start, lte: end } },
      select: { grossSales: true },
    });
    payoutSales = payoutWeeks.reduce((s, w) => s + Number(w.grossSales ?? 0), 0);
  }

  const manualSummary = await prisma.weeklySale.aggregate({
    _sum: { amount: true },
    where: { userId: auth.user.id, status: "APPROVED", AND: [{ weekEnd: { gte: start } }, { weekStart: { lte: end } }] },
  });
  const weeklyManualSales = Number(manualSummary._sum?.amount ?? 0);

  const marketplaceSales = payoutSales + weeklyManualSales + platforms.reduce((s, p) => s + Number(p.sales || 0), 0);
  const totalSalesWithMarketplace = totalSales + weeklyManualSales + payoutSales;
  const PROGRESS_TARGET = 2_000_000;
  const remainingToNextTier = Math.max(0, PROGRESS_TARGET - totalSalesWithMarketplace);

  return NextResponse.json({
    period: { key: period.key, label: periodLabel, start: start.toISOString(), end: end.toISOString() },
    totals: { orders: orders.length, sales: totalSales, commission: totalCommission },
    platforms,
    assignedAccounts: assignments.map((a) => ({ id: a.accountId, name: a.account?.displayName ?? null, platform: a.account?.platform })),
  });
}
