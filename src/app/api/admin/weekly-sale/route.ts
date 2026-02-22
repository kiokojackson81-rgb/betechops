import { NextRequest, NextResponse } from "next/server";
import { Prisma, Platform, WeeklySaleSource, WeeklySaleStatus, PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";
import { mondayToSundayNairobiWindow } from "@/lib/weekWindow";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
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
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
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

  let shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { id: true, platform: true } });
  if (!shop) {
    // If a Shop with the provided id doesn't exist, allow passing a
    // MarketplaceAccount id here by creating a lightweight Shop record.
    // This lets admins select marketplace accounts that weren't mapped to
    // Shop rows yet and still save manual weekly sales.
    const acct = await prisma.marketplaceAccount.findUnique({ where: { id: shopId } });
    if (!acct) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    // Create a minimal Shop record for this marketplace account. Keep it
    // active so it appears in future selections. Name uses the account
    // displayName when available.
    shop = await prisma.shop.create({
      data: {
        name: acct.displayName ?? acct.id,
        platform: acct.platform,
        isActive: true,
      },
      select: { id: true, platform: true },
    });
  }

  const normalizedWeekStart = new Date(weekStart);
  const normalizedWeekEnd = new Date(weekEnd);
  if (Number.isNaN(normalizedWeekStart.valueOf()) || Number.isNaN(normalizedWeekEnd.valueOf())) {
    return NextResponse.json({ error: "Invalid weekStart/weekEnd" }, { status: 400 });
  }

  // Canonicalize to trading weeks (Mon-Sun Nairobi), storing weekEnd as exclusive (next Monday 00:00 UTC).
  // This keeps manual entries aligned with automatic sync and commission recompute.
  const canonicalWindow = mondayToSundayNairobiWindow(normalizedWeekStart);

  const amount = typeof body.amount === "string" ? Number(body.amount) : body.amount;
  if (typeof amount !== "number" || Number.isNaN(amount)) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const resolvedShopId = shop.id;
  const resolvedPlatform = shop.platform;
  const weekKey = {
    shopId: resolvedShopId,
    platform: resolvedPlatform,
    weekStart: canonicalWindow.weekStart,
    weekEnd: canonicalWindow.weekEnd,
  } as Prisma.WeeklySaleShopIdPlatformWeekStartWeekEndCompoundUniqueInput;

  const existing = await prisma.weeklySale.findUnique({
    where: { shopId_platform_weekStart_weekEnd: weekKey },
  });
  const overridingAutomatic = existing?.source === WeeklySaleSource.AUTOMATIC;
  if (overridingAutomatic) {
    console.info(
      `Manual override replacing automatic weekly sale ${existing.id} for shop ${resolvedShopId} (${canonicalWindow.weekStart.toISOString()} - ${canonicalWindow.weekEnd.toISOString()})`,
    );
  }

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? null;

  const record = await prisma.weeklySale.upsert({
    where: { shopId_platform_weekStart_weekEnd: weekKey },
    create: {
      shopId: resolvedShopId,
      platform: resolvedPlatform,
      weekStart: canonicalWindow.weekStart,
      weekEnd: canonicalWindow.weekEnd,
      amount,
      userId: userId ?? null,
      status: WeeklySaleStatus.PENDING,
      source: WeeklySaleSource.MANUAL,
      createdBy: actorId,
    },
    update: {
      amount,
      userId: userId ?? null,
      status: WeeklySaleStatus.PENDING,
      source: WeeklySaleSource.MANUAL,
      // clear any existing approver when creating/updating manual entries
      approvedBy: null,
      createdBy: actorId,
    },
  });

  try {
    const receiptNumber = `manual-weekly-${record.id}`;
    const entryDate = canonicalWindow.weekStart;
    const dayStart = new Date(entryDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(entryDate);
    dayEnd.setHours(23, 59, 59, 999);
    const dayOfWeek = entryDate.toLocaleDateString("en-KE", { weekday: "long" });
    const dailyEntryWhere = { submittedById: userId ?? null, date: { gte: dayStart, lte: dayEnd } };
    let marketingEntry = await prisma.marketingDailyEntry.findFirst({ where: dailyEntryWhere });
    if (!marketingEntry) {
      marketingEntry = await prisma.marketingDailyEntry.create({
        data: {
          date: entryDate,
          dayOfWeek,
          totalSales: 0,
          totalProfit: 0,
          submittedById: userId ?? null,
        },
      });
    }
    const receiptItemsPayload = [
      {
        productName: "Manual weekly sale",
        buyingPrice: 0,
      },
    ];
    let marketingReceipt = await prisma.marketingReceipt.findFirst({
      where: { dailyEntryId: marketingEntry.id, receiptNumber },
    });
    if (marketingReceipt) {
      await prisma.marketingReceiptItem.deleteMany({ where: { receiptId: marketingReceipt.id } });
      marketingReceipt = await prisma.marketingReceipt.update({
        where: { id: marketingReceipt.id },
        data: {
          sellingTotal: amount,
          buyingTotal: 0,
          paymentMethod: PaymentMethod.MPESA,
          items: { create: receiptItemsPayload },
        },
      });
    } else {
      marketingReceipt = await prisma.marketingReceipt.create({
        data: {
          dailyEntryId: marketingEntry.id,
          receiptNumber,
          sellingTotal: amount,
          buyingTotal: 0,
          paymentMethod: PaymentMethod.MPESA,
          items: { create: receiptItemsPayload },
        },
      });
    }
    await prisma.marketingDailyEntry.update({
      where: { id: marketingEntry.id },
      data: {
        totalSales: amount,
        totalProfit: amount,
      },
    });
  } catch (error) {
    console.error("[weekly-sale] failed to mirror manual entry to marketing ledger", error);
  }

  const enriched = await prisma.weeklySale.findUnique({
    where: { id: record.id },
    include: {
      shop: { select: { id: true, name: true, platform: true } },
      user: { select: { id: true, name: true, email: true } },
      approved: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(enriched, { status: existing ? 200 : 201 });
}
