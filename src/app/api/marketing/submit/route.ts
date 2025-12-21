import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActorId, requireRole } from "@/lib/api";
import { marketingDayConfigs, marketingFieldTypes } from "@/lib/marketingDayConfigs";

export const dynamic = "force-dynamic";

const allowedDays = marketingDayConfigs.map((c) => c.day);
const yesNoKeys = Object.entries(marketingFieldTypes)
  .filter(([, t]) => t === "yesno")
  .map(([k]) => k);
const numericKeys = Object.entries(marketingFieldTypes)
  .filter(([, t]) => t === "numeric")
  .map(([k]) => k);
const textKeys = Object.entries(marketingFieldTypes)
  .filter(([, t]) => t === "text")
  .map(([k]) => k);

const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const toInt = (value: unknown): number | null => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n));
};
const toPositiveInt = (value: unknown, fallback = 1): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.round(n));
};

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;
  const actorId = await getActorId();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { date, dayOfWeek, sales = [], yesNo = {}, numeric = {}, text = {}, photoDataUrl, photoFilename } = body || {};
  if (!dayOfWeek || !allowedDays.includes(dayOfWeek)) {
    return NextResponse.json({ error: "dayOfWeek must be Monday-Saturday" }, { status: 400 });
  }

  const yesNoValues: Record<string, boolean> = {};
  yesNoKeys.forEach((k) => {
    yesNoValues[k] = Boolean((yesNo as Record<string, unknown>)[k]);
  });

  const numericValues: Record<string, number> = {};
  numericKeys.forEach((k) => {
    numericValues[k] = toNumber((numeric as Record<string, unknown>)[k]);
  });

  const textValues: Record<string, string> = {};
  textKeys.forEach((k) => {
    const raw = (text as Record<string, unknown>)[k];
    textValues[k] = typeof raw === "string" ? raw : "";
  });

  const saleRows =
    Array.isArray(sales) && sales.length
      ? sales
          .map((s: any) => ({
            product: typeof s.product === "string" ? s.product.trim() : "",
            buyingPrice: toNumber(s.buyingPrice),
            sellingPrice: toNumber(s.sellingPrice),
            receiptNumber: typeof s.receiptNumber === "string" ? s.receiptNumber.trim() : "",
            paymentMethod: s.paymentMethod === "CASH" ? "CASH" : "MPESA",
            itemsCount: toPositiveInt(s.itemsCount, 1),
          }))
          .filter(
            (s) =>
              s.product ||
              Number.isFinite(s.buyingPrice) ||
              Number.isFinite(s.sellingPrice) ||
              (s.receiptNumber ?? "") ||
              false
          )
      : [];

  const totalSales = saleRows.reduce((sum, s) => sum + toNumber(s.sellingPrice), 0);
  const totalProfit = saleRows.reduce((sum, s) => sum + (toNumber(s.sellingPrice) - toNumber(s.buyingPrice)), 0);

  try {
    const entry = await prisma.marketingDailyEntry.create({
      data: {
        date: date ? new Date(date) : new Date(),
        dayOfWeek,
        totalSales,
        totalProfit,
        photoUrl: typeof photoDataUrl === "string" ? photoDataUrl : null,
        payload: { yesNo: yesNoValues, numeric: numericValues, text: textValues, photoFilename: photoFilename || null },
        submittedById: actorId,
        submittedByName: (auth.session?.user as any)?.name ?? null,
        submittedByEmail: (auth.session?.user as any)?.email ?? null,
        // channel + checklist fields
        tiktokPosted2Videos: yesNoValues.tiktokPosted2Videos || null,
        tiktokRepliedAll: yesNoValues.tiktokRepliedAll || null,
        igFbYtPosted2VideosEach: yesNoValues.igFbYtPosted2VideosEach || null,
        igFbYtRepliedAll: yesNoValues.igFbYtRepliedAll || null,
        waPostedStatus: yesNoValues.waPostedStatus || yesNoValues.waPosted10Statuses || null,
        waSavedContacts: yesNoValues.waSavedContacts || yesNoValues.waSaved10Contacts || null,
        waRespondedAll: yesNoValues.waRespondedAll || null,
        waPosted10Statuses: yesNoValues.waPosted10Statuses || null,
        waSaved10Contacts: yesNoValues.waSaved10Contacts || null,
        stockEnoughFastMovers: yesNoValues.stockEnoughFastMovers || null,
        shot4ProductVideos: yesNoValues.shot4ProductVideos || null,
        tiktokPosted4ExplanatoryVideos: yesNoValues.tiktokPosted4ExplanatoryVideos || null,
        shopCleaned: yesNoValues.shopCleaned || null,
        shopWellArranged: yesNoValues.shopWellArranged || null,
        displayWellLabeled: yesNoValues.displayWellLabeled || null,
        weeklyComment: textValues.weeklyComment || null,
        // live session details
        liveSessionsCount: toInt(numericValues.liveSessionsCount),
        liveSessionsEstimatedViewers: toInt(
          numericValues.liveSessionsEstimatedViewers || (numeric as Record<string, unknown>)["liveViewers"]
        ),
        liveSessionDurationMinutes: toInt(numericValues.liveSessionDurationMinutes),
        liveSessionPlatform: textValues.liveSessionPlatform || null,
        liveViewers: toInt((numeric as Record<string, unknown>)["liveViewers"] ?? numericValues.liveSessionsEstimatedViewers),
        sales: {
          create: saleRows.map((s) => ({
            product: s.product,
            buyingPrice: toNumber(s.buyingPrice),
            sellingPrice: toNumber(s.sellingPrice),
            receiptNumber: s.receiptNumber || null,
            paymentMethod: s.paymentMethod === "CASH" ? "CASH" : "MPESA",
            itemsCount: toPositiveInt(s.itemsCount, 1),
          })),
        },
      },
      include: { sales: true },
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save marketing entry";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
