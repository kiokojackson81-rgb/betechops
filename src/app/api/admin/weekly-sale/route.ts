import { NextRequest, NextResponse } from "next/server";
import { Prisma, Platform, WeeklySaleSource, WeeklySaleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRoleOrBenjamin } from "@/lib/api";
import { upsertManualWeeklySale } from "@/lib/manualWeeklySaleUpsert";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireRoleOrBenjamin(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const shopId = url.searchParams.get("shopId") || undefined;
  const userId = url.searchParams.get("userId") || undefined;
  const platformParam = url.searchParams.get("platform");
  const statusParam = url.searchParams.get("status");
  const sourceParam = url.searchParams.get("source");
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  const where: Prisma.WeeklySaleWhereInput = {};
  if (shopId) where.shopId = shopId;
  if (userId) where.userId = userId;
  if (platformParam && Object.values(Platform).includes(platformParam as Platform)) {
    where.platform = platformParam as Platform;
  }
  if (statusParam && Object.values(WeeklySaleStatus).includes(statusParam as WeeklySaleStatus)) {
    where.status = statusParam as WeeklySaleStatus;
  }
  if (sourceParam && Object.values(WeeklySaleSource).includes(sourceParam as WeeklySaleSource)) {
    where.source = sourceParam as WeeklySaleSource;
  }
  if (fromParam || toParam) {
    const fromDate = fromParam ? new Date(fromParam) : undefined;
    const toDate = toParam ? new Date(toParam) : undefined;
    where.weekStart = {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate ? { lte: toDate } : {}),
    };
  }

  const sales = await prisma.weeklySale.findMany({
    where,
    include: {
      shop: { select: { id: true, name: true, platform: true } },
      user: { select: { id: true, name: true, email: true } },
      approved: { select: { id: true, name: true, email: true } },
    },
    orderBy: { weekStart: "desc" },
  });

  return NextResponse.json(sales);
}

export async function POST(req: NextRequest) {
  const auth = await requireRoleOrBenjamin(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const body = (await req.json().catch(() => null)) as {
    shopId?: string;
    platform?: string;
    weekStart?: string;
    weekEnd?: string;
    amount?: number | string;
    userId?: string | null;
  } | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const { shopId, weekStart, weekEnd, userId } = body;
  if (!shopId || !weekStart || !weekEnd || body.amount === undefined || body.amount === null) {
    return NextResponse.json({ error: "shopId, weekStart, weekEnd and amount are required" }, { status: 400 });
  }

  const normalizedWeekStart = new Date(weekStart);
  const normalizedWeekEnd = new Date(weekEnd);
  if (Number.isNaN(normalizedWeekStart.valueOf()) || Number.isNaN(normalizedWeekEnd.valueOf())) {
    return NextResponse.json({ error: "Invalid weekStart/weekEnd" }, { status: 400 });
  }

  const amount = typeof body.amount === "string" ? Number(body.amount) : body.amount;
  if (typeof amount !== "number" || Number.isNaN(amount)) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? null;
  const actorRole = (auth.session?.user as { role?: string } | undefined)?.role ?? "";
  const effectiveUserId = actorRole === "ATTENDANT" ? actorId : userId ?? null;

  try {
    const enriched = await upsertManualWeeklySale({
      shopId,
      weekStart: normalizedWeekStart,
      weekEnd: normalizedWeekEnd,
      amount,
      userId: effectiveUserId,
      actorId,
    });
    return NextResponse.json(enriched, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to save weekly sale" }, { status: 400 });
  }
}
