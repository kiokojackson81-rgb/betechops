import { PaymentMethod, Prisma, WeeklySaleSource, WeeklySaleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mondayToSundayNairobiWindow } from "@/lib/weekWindow";

export async function upsertManualWeeklySale(opts: {
  shopId: string;
  weekStart: Date;
  weekEnd: Date;
  amount: number;
  userId: string | null;
  actorId: string | null;
}) {
  // `shopId` may be a MarketplaceAccount id. If it isn't a Shop, create a minimal Shop record.
  let shop = await prisma.shop.findUnique({ where: { id: opts.shopId }, select: { id: true, platform: true } });
  if (!shop) {
    const acct = await prisma.marketplaceAccount.findUnique({ where: { id: opts.shopId } });
    if (!acct) {
      throw new Error("Shop not found");
    }
    shop = await prisma.shop.create({
      data: {
        name: acct.displayName ?? acct.id,
        platform: acct.platform,
        isActive: true,
      },
      select: { id: true, platform: true },
    });
  }

  const canonicalWindow = mondayToSundayNairobiWindow(opts.weekStart);
  const resolvedShopId = shop.id;
  const resolvedPlatform = shop.platform;

  const weekKey = {
    shopId: resolvedShopId,
    platform: resolvedPlatform,
    weekStart: canonicalWindow.weekStart,
    weekEnd: canonicalWindow.weekEnd,
  } as Prisma.WeeklySaleShopIdPlatformWeekStartWeekEndCompoundUniqueInput;

  const amountDec = typeof opts.amount === "string" ? Number(opts.amount) : opts.amount;
  if (typeof amountDec !== "number" || Number.isNaN(amountDec)) {
    throw new Error("Invalid amount");
  }

  const record = await prisma.weeklySale.upsert({
    where: { shopId_platform_weekStart_weekEnd: weekKey },
    create: {
      shopId: resolvedShopId,
      platform: resolvedPlatform,
      weekStart: canonicalWindow.weekStart,
      weekEnd: canonicalWindow.weekEnd,
      amount: amountDec,
      userId: opts.userId ?? null,
      status: WeeklySaleStatus.PENDING,
      source: WeeklySaleSource.MANUAL,
      createdBy: opts.actorId,
    },
    update: {
      amount: amountDec,
      userId: opts.userId ?? null,
      status: WeeklySaleStatus.PENDING,
      source: WeeklySaleSource.MANUAL,
      approvedBy: null,
      createdBy: opts.actorId,
    },
  });

  // Mirror to marketing ledger for reporting consistency (best-effort).
  try {
    const receiptNumber = `manual-weekly-${record.id}`;
    const entryDate = canonicalWindow.weekStart;
    const dayStart = new Date(entryDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(entryDate);
    dayEnd.setHours(23, 59, 59, 999);
    const dayOfWeek = entryDate.toLocaleDateString("en-KE", { weekday: "long" });
    const dailyEntryWhere = { submittedById: opts.userId ?? null, date: { gte: dayStart, lte: dayEnd } };

    let marketingEntry = await prisma.marketingDailyEntry.findFirst({ where: dailyEntryWhere });
    if (!marketingEntry) {
      marketingEntry = await prisma.marketingDailyEntry.create({
        data: {
          date: entryDate,
          dayOfWeek,
          totalSales: 0,
          totalProfit: 0,
          submittedById: opts.userId ?? null,
        },
      });
    }

    const receiptItemsPayload = [{ productName: "Manual weekly sale", buyingPrice: 0 }];
    let marketingReceipt = await prisma.marketingReceipt.findFirst({
      where: { dailyEntryId: marketingEntry.id, receiptNumber },
    });
    if (marketingReceipt) {
      await prisma.marketingReceiptItem.deleteMany({ where: { receiptId: marketingReceipt.id } });
      await prisma.marketingReceipt.update({
        where: { id: marketingReceipt.id },
        data: {
          sellingTotal: amountDec,
          buyingTotal: 0,
          paymentMethod: PaymentMethod.MPESA,
          items: { create: receiptItemsPayload },
        },
      });
    } else {
      await prisma.marketingReceipt.create({
        data: {
          dailyEntryId: marketingEntry.id,
          receiptNumber,
          sellingTotal: amountDec,
          buyingTotal: 0,
          paymentMethod: PaymentMethod.MPESA,
          items: { create: receiptItemsPayload },
        },
      });
    }
    await prisma.marketingDailyEntry.update({
      where: { id: marketingEntry.id },
      data: { totalSales: amountDec, totalProfit: amountDec },
    });
  } catch (error) {
    console.error("[manualWeeklySaleUpsert] failed to mirror to marketing ledger", error);
  }

  return prisma.weeklySale.findUnique({
    where: { id: record.id },
    include: {
      shop: { select: { id: true, name: true, platform: true } },
      user: { select: { id: true, name: true, email: true } },
      approved: { select: { id: true, name: true, email: true } },
    },
  });
}

