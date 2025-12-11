import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAttendant } from "@/lib/auth";

export const dynamic = "force-dynamic";

const currencyFormatter = new Intl.DateTimeFormat("en-KE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatPeriodLabel(start?: Date, end?: Date) {
  if (!start || !end) return "All time";
  return `${currencyFormatter.format(start)} – ${currencyFormatter.format(end)}`;
}

export async function GET(req: Request) {
  const guard = await requireAttendant(req, ["ATTENDANT", "SUPERVISOR", "ADMIN"]);
  if (!guard.ok) return guard.res;

  const url = new URL(req.url);
  const startParam = url.searchParams.get("start");
  const endParam = url.searchParams.get("end");

  const baseWhere: Prisma.WeeklySaleWhereInput = {
    userId: guard.user.id,
  };
  const rangeWhere: Prisma.WeeklySaleWhereInput = { ...baseWhere };

  let startDate: Date | undefined;
  let endDate: Date | undefined;

  if (startParam) {
    const parsed = new Date(startParam);
    if (!Number.isNaN(parsed.valueOf())) {
      startDate = parsed;
      rangeWhere.weekStart = { ...(rangeWhere.weekStart ?? {}), gte: startDate };
    }
  }
  if (endParam) {
    const parsed = new Date(endParam);
    if (!Number.isNaN(parsed.valueOf())) {
      endDate = parsed;
      rangeWhere.weekStart = { ...(rangeWhere.weekStart ?? {}), lte: endDate };
    }
  }

  const [entries, periodAggregate, totalAggregate] = await Promise.all([
    prisma.weeklySale.findMany({
      where: rangeWhere,
      include: {
        shop: { select: { id: true, name: true, platform: true, isActive: true } },
        user: { select: { id: true, name: true, email: true, attendantCategory: true, role: true } },
      },
      orderBy: { weekStart: "desc" },
    }),
    prisma.weeklySale.aggregate({
      where: rangeWhere,
      _sum: { amount: true },
    }),
    prisma.weeklySale.aggregate({
      where: baseWhere,
      _sum: { amount: true },
    }),
  ]);

  const periodTotal = Number(periodAggregate._sum.amount ?? 0);
  const totalToDate = Number(totalAggregate._sum.amount ?? 0);

  const shopIds = entries
    .map((entry) => entry.shopId)
    .filter((id): id is string => Boolean(id));
  const accounts = await prisma.marketplaceAccount.findMany({
    where: { id: { in: shopIds } },
    select: {
      id: true,
      platform: true,
      displayName: true,
      jumiaShopSid: true,
      kilimallShopCode: true,
    },
  });
  const accountMap = new Map(accounts.map((account) => [account.id, account]));

  type Aggregated = {
    shopId: string;
    shopName: string | null;
    platform: string | null;
    total: number;
    lastEntry?: typeof entries[0];
  };

  const aggregated = new Map<string, Aggregated>();
  entries.forEach((entry) => {
    if (!entry.shopId) return;
    const existing = aggregated.get(entry.shopId);
    const amount = Number(entry.amount ?? 0);
    if (existing) {
      existing.total += amount;
      existing.lastEntry = existing.lastEntry ?? entry;
    } else {
      aggregated.set(entry.shopId, {
        shopId: entry.shopId,
        shopName: entry.shop?.name ?? null,
        platform: entry.shop?.platform ?? entry.platform ?? null,
        total: amount,
        lastEntry: entry,
      });
    }
  });

  const rows = Array.from(aggregated.values())
    .sort((a, b) => b.total - a.total)
    .map((entry) => {
    const account = accountMap.get(entry.shopId);
    const shopPlatform = account?.platform ?? entry.platform?.toUpperCase() ?? "UNKNOWN";
    const codeLabel =
      shopPlatform === "JUMIA"
        ? `Shop SID: ${account?.jumiaShopSid ?? entry.shopId}`
        : shopPlatform === "KILIMALL"
        ? `Kilimall code: ${account?.kilimallShopCode ?? entry.shopId}`
        : `Shop ID: ${entry.shopId}`;
    const handlerName =
      entry.lastEntry?.user?.name ||
      entry.lastEntry?.user?.email ||
      "Unassigned";
    const handlerRole =
      entry.lastEntry?.user?.attendantCategory ||
      entry.lastEntry?.user?.role ||
      "ATTENDANT";
    return {
      id: entry.shopId,
      name: entry.shopName ?? `Shop ${entry.shopId}`,
      platform: shopPlatform,
      country: "KE",
      currency: "KES",
      status: entry.lastEntry?.shop?.isActive ? "Active" : "Inactive",
      codeLabel,
      handlerName,
      handlerRole,
      periodLabel: formatPeriodLabel(startDate, endDate),
      totalSales: entry.total,
    };
  });

  return NextResponse.json({
    rows,
    periodLabel: formatPeriodLabel(startDate, endDate),
    periodTotal,
    totalToDate,
  });
}
