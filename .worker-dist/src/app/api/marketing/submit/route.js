"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
const marketingDayConfigs_1 = require("@/lib/marketingDayConfigs");
exports.dynamic = "force-dynamic";
const allowedDays = marketingDayConfigs_1.marketingDayConfigs.map((c) => c.day);
const yesNoKeys = Object.entries(marketingDayConfigs_1.marketingFieldTypes)
    .filter(([, t]) => t === "yesno")
    .map(([k]) => k);
const numericKeys = Object.entries(marketingDayConfigs_1.marketingFieldTypes)
    .filter(([, t]) => t === "numeric")
    .map(([k]) => k);
const textKeys = Object.entries(marketingDayConfigs_1.marketingFieldTypes)
    .filter(([, t]) => t === "text")
    .map(([k]) => k);
const toNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};
const toInt = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n))
        return null;
    return Math.max(0, Math.round(n));
};
const toPositiveInt = (value, fallback = 1) => {
    const n = Number(value);
    if (!Number.isFinite(n))
        return fallback;
    return Math.max(1, Math.round(n));
};
async function POST(req) {
    const auth = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
    if (!auth.ok)
        return auth.res;
    const actorId = await (0, api_1.getActorId)();
    let body;
    try {
        body = await req.json();
    }
    catch {
        return server_1.NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const { date, dayOfWeek, sales = [], yesNo = {}, numeric = {}, text = {}, photoDataUrl, photoFilename } = body || {};
    if (!dayOfWeek || !allowedDays.includes(dayOfWeek)) {
        return server_1.NextResponse.json({ error: "dayOfWeek must be Monday-Saturday" }, { status: 400 });
    }
    const yesNoValues = {};
    yesNoKeys.forEach((k) => {
        yesNoValues[k] = Boolean(yesNo[k]);
    });
    const numericValues = {};
    numericKeys.forEach((k) => {
        numericValues[k] = toNumber(numeric[k]);
    });
    const textValues = {};
    textKeys.forEach((k) => {
        const raw = text[k];
        textValues[k] = typeof raw === "string" ? raw : "";
    });
    const saleRows = Array.isArray(sales) && sales.length
        ? sales
            .map((s) => ({
            product: typeof s.product === "string" ? s.product.trim() : "",
            buyingPrice: toNumber(s.buyingPrice),
            sellingPrice: toNumber(s.sellingPrice),
            receiptNumber: typeof s.receiptNumber === "string" ? s.receiptNumber.trim() : "",
            paymentMethod: s.paymentMethod === "CASH" ? "CASH" : "MPESA",
            itemsCount: toPositiveInt(s.itemsCount, 1),
        }))
            .filter((s) => s.product ||
            Number.isFinite(s.buyingPrice) ||
            Number.isFinite(s.sellingPrice) ||
            (s.receiptNumber ?? "") ||
            false)
        : [];
    const totalSales = saleRows.reduce((sum, s) => sum + toNumber(s.sellingPrice), 0);
    const totalProfit = saleRows.reduce((sum, s) => sum + (toNumber(s.sellingPrice) - toNumber(s.buyingPrice)), 0);
    try {
        const entry = await prisma_1.prisma.marketingDailyEntry.create({
            data: {
                date: date ? new Date(date) : new Date(),
                dayOfWeek,
                totalSales,
                totalProfit,
                photoUrl: typeof photoDataUrl === "string" ? photoDataUrl : null,
                payload: { yesNo: yesNoValues, numeric: numericValues, text: textValues, photoFilename: photoFilename || null },
                submittedById: actorId,
                submittedByName: auth.session?.user?.name ?? null,
                submittedByEmail: auth.session?.user?.email ?? null,
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
                liveSessionsEstimatedViewers: toInt(numericValues.liveSessionsEstimatedViewers || numeric["liveViewers"]),
                liveSessionDurationMinutes: toInt(numericValues.liveSessionDurationMinutes),
                liveSessionPlatform: textValues.liveSessionPlatform || null,
                liveViewers: toInt(numeric["liveViewers"] ?? numericValues.liveSessionsEstimatedViewers),
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
        return server_1.NextResponse.json({ entry }, { status: 201 });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to save marketing entry";
        return server_1.NextResponse.json({ error: msg }, { status: 500 });
    }
}
