import { NextResponse } from "next/server";
import { MarketplaceReturnStatus, WeeklySaleSource, WeeklySaleStatus } from "@prisma/client";
import { computeMarketplaceCommission } from "@/lib/onlineCommission";
import { prisma } from "@/lib/prisma";
import { requireAttendant } from "@/lib/auth";
import { getMarketplaceAssignmentsForUser } from "@/lib/onlineOps";

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

export async function GET(req: Request) {
  const auth = await requireAttendant(req, [
    "JUMIA_KILIMALL_OPS",
    "BETECH_OPS",
    "SUPERVISOR",
    "ADMIN",
  ]);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const startParam = parseDateParam(url.searchParams.get("start"));
  const endParam = parseDateParam(url.searchParams.get("end"));
  const { start: defaultStart, end: defaultEnd } = weekRangeForDate(new Date());
  const start = startParam ?? defaultStart;
  const end = endParam ?? defaultEnd;

  const rangeLabel = formatRangeLabel(start, end);
  const weekLabel = `${start.toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
  })} - ${end.toLocaleDateString("en-KE", { day: "2-digit", month: "short" })}`;

  const isAdmin = auth.role === "ADMIN" || auth.role === "SUPERVISOR";
  let accountIds: string[] = [];

  if (isAdmin) {
    const accounts = await prisma.marketplaceAccount.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    accountIds = accounts.map((a) => a.id);
  } else {
    const assignments = await getMarketplaceAssignmentsForUser(auth.user.id);
    accountIds = assignments.accountIds;
  }

  if (!accountIds.length) {
    return NextResponse.json({
      rangeLabel,
      totals: { sales: 0, commission: 0, orders: 0, shops: 0 },
      rows: [],
    });
  }

  const accounts = await prisma.marketplaceAccount.findMany({
    where: { id: { in: accountIds }, isActive: true },
    select: {
      id: true,
      displayName: true,
      platform: true,
      jumiaShopSid: true,
      kilimallShopCode: true,
    },
    orderBy: [{ platform: "asc" }, { displayName: "asc" }],
  });

  if (!accounts.length) {
    return NextResponse.json({
      rangeLabel,
      totals: { sales: 0, commission: 0, orders: 0, shops: 0 },
      rows: [],
    });
  }

  const normalizeName = (value?: string | null) => value?.trim().toLowerCase() ?? "";
  const normalizeApiKey = (value?: string | null) => value?.trim().toLowerCase() ?? "";
  const accountById = new Map<string, string>();
  const accountByName = new Map<string, string>();
  const accountByJumiaSid = new Map<string, string>();
  const accountByKilimallCode = new Map<string, string>();
  accounts.forEach((account) => {
    accountById.set(account.id, account.id);
    const normalizedName = normalizeName(account.displayName);
    if (normalizedName) {
      accountByName.set(normalizedName, account.id);
    }
    const normalizedJumia = normalizeApiKey(account.jumiaShopSid);
    if (normalizedJumia) {
      accountByJumiaSid.set(normalizedJumia, account.id);
    }
    const normalizedKilimall = normalizeApiKey(account.kilimallShopCode);
    if (normalizedKilimall) {
      accountByKilimallCode.set(normalizedKilimall, account.id);
    }
  });

  const manualEntries = await prisma.weeklySale.findMany({
    where: {
      status: WeeklySaleStatus.APPROVED,
      source: WeeklySaleSource.MANUAL,
      AND: [{ weekEnd: { gte: start } }, { weekStart: { lte: end } }],
    },
    select: {
      id: true,
      shopId: true,
      amount: true,
      platform: true,
      shop: {
        select: {
          id: true,
          name: true,
          platform: true,
          apiConfig: { select: { apiKey: true } },
        },
      },
    },
  });

  const manualSalesByAccount = new Map<string, number>();
  const manualEntriesCountByAccount = new Map<string, number>();
  manualEntries.forEach((entry) => {
    let matchedAccountId = entry.shopId && accountById.has(entry.shopId) ? entry.shopId : undefined;
    const normalizedShopName = normalizeName(entry.shop?.name);
    const platformKey = (entry.platform ?? entry.shop?.platform ?? "").toUpperCase();
    const apiKey = normalizeApiKey(entry.shop?.apiConfig?.apiKey);
    if (!matchedAccountId && normalizedShopName && accountByName.has(normalizedShopName)) {
      matchedAccountId = accountByName.get(normalizedShopName);
    }
    if (
      !matchedAccountId &&
      apiKey &&
      platformKey === "JUMIA" &&
      accountByJumiaSid.has(apiKey)
    ) {
      matchedAccountId = accountByJumiaSid.get(apiKey);
    }
    if (
      !matchedAccountId &&
      apiKey &&
      platformKey === "KILIMALL" &&
      accountByKilimallCode.has(apiKey)
    ) {
      matchedAccountId = accountByKilimallCode.get(apiKey);
    }

    if (!matchedAccountId) {
      return;
    }

    const amount = Number(entry.amount ?? 0);
    if (!amount) {
      return;
    }

    manualSalesByAccount.set(
      matchedAccountId,
      (manualSalesByAccount.get(matchedAccountId) ?? 0) + amount,
    );
    manualEntriesCountByAccount.set(
      matchedAccountId,
      (manualEntriesCountByAccount.get(matchedAccountId) ?? 0) + 1,
    );
  });

  const orders = await prisma.marketplaceOrder.findMany({
    where: {
      accountId: { in: accounts.map((a) => a.id) },
      orderedAt: { gte: start, lte: end },
    },
    select: {
      accountId: true,
      sellingPrice: true,
      profit: true,
    },
  });

  const returns = await prisma.marketplaceReturn.findMany({
    where: {
      accountId: { in: accounts.map((a) => a.id) },
      dueAt: { gte: start, lte: end },
      status: MarketplaceReturnStatus.CHARGED_TO_ATTENDANT,
    },
    select: {
      accountId: true,
      expectedAmount: true,
    },
  });

  const rows = accounts
    .map((account) => {
      const accountOrders = orders.filter((order) => order.accountId === account.id);
      const sales = accountOrders.reduce(
        (sum, order) => sum + Number(order.sellingPrice ?? 0),
        0,
      );
      const profit = accountOrders.reduce(
        (sum, order) => sum + Number(order.profit ?? 0),
        0,
      );

      const accountReturns = returns.filter((entry) => entry.accountId === account.id);
      const chargedReturns = accountReturns.reduce(
        (sum, entry) => sum + Number(entry.expectedAmount ?? 0),
        0,
      );
      const manualSalesAmount = manualSalesByAccount.get(account.id) ?? 0;
      const manualEntryCount = manualEntriesCountByAccount.get(account.id) ?? 0;
      const totalSales = sales + manualSalesAmount;
      // Use the canonical marketplace commission calculation so manual entries
      // contribute to sales (and therefore ladder computation) rather than
      // being treated as a direct commission amount. Subtract charged returns
      // afterwards to reflect attendant-charged returns.
      const commissionResult = computeMarketplaceCommission(totalSales);
      const totalCommission = Math.max(0, Number(commissionResult.amount || 0) - chargedReturns);

      return {
        shopId: account.id,
        shopName: account.displayName,
        platform: account.platform,
        weekLabel,
        weekStart: start.toISOString(),
        weekEnd: end.toISOString(),
        sales: totalSales,
        commission: totalCommission,
        orders: accountOrders.length + manualEntryCount,
      };
    })
    .sort((a, b) => b.sales - a.sales);

  const totals = rows.reduce(
    (acc, row) => {
      acc.sales += row.sales;
      acc.commission += row.commission;
      acc.orders += row.orders ?? 0;
      return acc;
    },
    { sales: 0, commission: 0, orders: 0 },
  );

  return NextResponse.json({
    rangeLabel,
    totals: { ...totals, shops: rows.length },
    rows,
  });
}
