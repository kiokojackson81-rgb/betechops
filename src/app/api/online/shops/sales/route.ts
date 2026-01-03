import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAttendant } from "@/lib/auth";
import { composeIdentityResponse, resolveTargetUserId } from "@/lib/resolveTargetUser";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";

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

  const identity = await resolveTargetUserId(req);
  const meta = identity;
  const targetUserId = identity.resolvedUserId;
  if (!targetUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  if (url.searchParams.has("start") || url.searchParams.has("end")) {
    return NextResponse.json({ error: "This endpoint requires a server-resolved trading period; do not supply start/end." }, { status: 400 });
  }
  const { start: periodStart, end: periodEnd } = getTradingPeriodFor(new Date());
  let startDate: Date | undefined = periodStart;
  let endDate: Date | undefined = periodEnd;

  const baseWhere: Prisma.WeeklySaleWhereInput = {
    userId: targetUserId,
  };
  const rangeWhere: Prisma.WeeklySaleWhereInput = { ...baseWhere };

  // Apply server-resolved week range to the query filters
  const current = rangeWhere.weekStart as Prisma.DateTimeFilter | undefined;
  rangeWhere.weekStart = { ...(current ?? {}), gte: startDate, lte: endDate };

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

  const data = {
    rows,
    periodLabel: formatPeriodLabel(startDate, endDate),
    periodTotal,
    totalToDate,
  };

  return NextResponse.json(composeIdentityResponse(meta, data));
}
