import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAttendant } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireAttendant(req, ["ATTENDANT", "SUPERVISOR", "ADMIN"]);
  if (!guard.ok) return guard.res;

  const url = new URL(req.url);
  const weekStart = url.searchParams.get("weekStart") || undefined;
  const weekEnd = url.searchParams.get("weekEnd") || undefined;

  const baseWhere: Prisma.WeeklySaleWhereInput = {
    userId: guard.user.id,
  };

  const periodWhere: Prisma.WeeklySaleWhereInput = { ...baseWhere };
  if (weekStart || weekEnd) {
    const range: Prisma.WeeklySaleWhereInput["weekStart"] = {};
    if (weekStart) {
      const startDate = new Date(weekStart);
      if (!Number.isNaN(startDate.valueOf())) {
        range.gte = startDate;
      }
    }
    if (weekEnd) {
      const endDate = new Date(weekEnd);
      if (!Number.isNaN(endDate.valueOf())) {
        range.lte = endDate;
      }
    }
    if (Object.keys(range).length > 0) {
      periodWhere.weekStart = range;
    }
  }

  const [entries, periodAggregate, totalAggregate] = await Promise.all([
    prisma.weeklySale.findMany({
      where: periodWhere,
      include: {
        shop: { select: { id: true, name: true, platform: true } },
      },
      orderBy: { weekStart: "desc" },
    }),
    prisma.weeklySale.aggregate({
      where: periodWhere,
      _sum: { amount: true },
    }),
    prisma.weeklySale.aggregate({
      where: baseWhere,
      _sum: { amount: true },
    }),
  ]);

  const periodTotal = Number(periodAggregate._sum.amount ?? 0);
  const totalToDate = Number(totalAggregate._sum.amount ?? 0);

  return NextResponse.json({
    entries: entries.map((entry) => ({
      id: entry.id,
      shopId: entry.shopId,
      amount: Number(entry.amount ?? 0),
      weekStart: entry.weekStart.toISOString(),
      weekEnd: entry.weekEnd.toISOString(),
      platform: entry.platform,
      status: entry.status,
      shop: entry.shop,
    })),
    periodTotal,
    totalToDate,
    weekStart,
    weekEnd,
  });
}
