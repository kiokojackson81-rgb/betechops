"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
const marketingDayConfigs_1 = require("@/lib/marketingDayConfigs");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const marketingCommission_1 = require("@/lib/marketingCommission");
const zod_1 = require("zod");
const ReceiptItemSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    productName: zod_1.z.string().min(1),
    buyingPrice: zod_1.z.number().min(0),
});
const ReceiptSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    receiptNumber: zod_1.z.string().optional().nullable(),
    sellingTotal: zod_1.z.number().min(0),
    paymentMethod: zod_1.z.enum(["MPESA", "CASH"]),
    items: zod_1.z.array(ReceiptItemSchema).min(1),
});
const DailyPayloadSchema = zod_1.z.object({
    date: zod_1.z.string().min(1),
    dayOfWeek: zod_1.z.string().optional(),
    receipts: zod_1.z.array(ReceiptSchema).optional(),
    yesNo: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    numeric: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    text: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    // Optional top-level weekly fields (convenience)
    weeklyMeetingAttended: zod_1.z.boolean().optional(),
    weeklyVideoShootParticipated: zod_1.z.boolean().optional(),
    weeklyVideoCount: zod_1.z.number().optional(),
});
exports.dynamic = "force-dynamic";
const toNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};
const normalizePaymentMethod = (value) => {
    const v = typeof value === "string" ? value.trim().toUpperCase() : "";
    return v === "CASH" ? "CASH" : "MPESA";
};
const normalizeReceipts = (raw) => {
    if (!Array.isArray(raw))
        return [];
    return raw
        .map((r) => ({
        receiptNumber: typeof r?.receiptNumber === "string" ? r.receiptNumber.trim() : null,
        sellingTotal: Math.max(0, toNumber(r?.sellingTotal)),
        paymentMethod: normalizePaymentMethod(r?.paymentMethod),
        items: Array.isArray(r?.items)
            ? r.items
                .map((it) => ({
                productName: typeof it?.productName === "string" ? it.productName.trim() : "",
                buyingPrice: Math.max(0, toNumber(it?.buyingPrice)),
            }))
                .filter((it) => it.productName || Number.isFinite(it.buyingPrice))
            : [],
    }))
        .filter((r) => r.sellingTotal > 0 || r.items.length > 0 || (r.receiptNumber ?? "") !== "");
};
async function POST(req) {
    const auth = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
    if (!auth.ok)
        return auth.res;
    // allow admin to submit on behalf of another attendant via impersonateId query param
    let actorId = await (0, api_1.getActorId)();
    try {
        const url = new URL(req.url);
        const impersonateId = url.searchParams.get("impersonateId");
        if (impersonateId && auth.role === "ADMIN") {
            actorId = impersonateId;
        }
    }
    catch (e) {
        // ignore
    }
    // Server-side defense in depth: ensure the actor (either the current
    // session user or the impersonated user) is allowed to submit marketing
    // daily entries. Only ADMIN or attendants in DIRECT_SALES_OPS may submit.
    try {
        if (!actorId) {
            return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const actorUser = await prisma_1.prisma.user.findUnique({
            where: { id: actorId },
            select: { id: true, role: true, attendantCategory: true },
        });
        if (!actorUser)
            return server_1.NextResponse.json({ error: "Actor not found" }, { status: 404 });
        const isAllowed = actorUser.role === "ADMIN" || actorUser.attendantCategory === "DIRECT_SALES_OPS";
        if (!isAllowed)
            return server_1.NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    catch (e) {
        return server_1.NextResponse.json({ error: "Failed to verify actor" }, { status: 500 });
    }
    let body;
    try {
        body = await req.json();
    }
    catch {
        return server_1.NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    // Validate payload shape using Zod
    try {
        DailyPayloadSchema.parse(body);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return server_1.NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 });
        }
        return server_1.NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const { date, dayOfWeek, receipts = [], yesNo = {}, numeric = {}, text = {} } = body || {};
    if (!date)
        return server_1.NextResponse.json({ error: "date is required" }, { status: 400 });
    const entryDate = new Date(date);
    const day = typeof dayOfWeek === "string" ? dayOfWeek : entryDate.toLocaleDateString("en-KE", { weekday: "long" });
    const allowedDay = marketingDayConfigs_1.marketingDayConfigs.find((c) => c.day === day)?.day;
    const resolvedDay = allowedDay ?? marketingDayConfigs_1.marketingDayConfigs[0].day;
    const yesNoValues = {};
    const numericValues = {};
    const textValues = {};
    Object.entries(marketingDayConfigs_1.marketingFieldTypes).forEach(([key, type]) => {
        const raw = (type === "yesno" ? yesNo : type === "numeric" ? numeric : text);
        if (type === "yesno")
            yesNoValues[key] = Boolean(raw?.[key]);
        if (type === "numeric")
            numericValues[key] = toNumber(raw?.[key]);
        if (type === "text")
            textValues[key] = typeof raw?.[key] === "string" ? raw[key] : "";
    });
    // Accept convenience top-level weekly fields and normalize them.
    const weeklyMeetingAttendedRaw = (yesNo?.weeklyMeetingAttended ?? body.weeklyMeetingAttended);
    const weeklyVideoShootParticipatedRaw = (yesNo?.weeklyVideoShootParticipated ?? body.weeklyVideoShootParticipated);
    const weeklyVideoCountRaw = (numeric?.weeklyVideoCount ?? body.weeklyVideoCount);
    const receiptsClean = normalizeReceipts(receipts);
    const totalSales = receiptsClean.reduce((sum, r) => sum + r.sellingTotal, 0);
    const totalProfit = receiptsClean.reduce((sum, r) => sum + (r.sellingTotal - r.items.reduce((s, it) => s + it.buyingPrice, 0)), 0);
    const totalItems = receiptsClean.reduce((sum, r) => sum + r.items.length, 0);
    const mpesaTotal = receiptsClean.filter((r) => r.paymentMethod === "MPESA").reduce((s, r) => s + r.sellingTotal, 0);
    const cashTotal = receiptsClean.filter((r) => r.paymentMethod === "CASH").reduce((s, r) => s + r.sellingTotal, 0);
    try {
        // Ensure Thursday-only weekly fields are only persisted for Thursday.
        const isThursday = resolvedDay === "Thursday";
        // Compose final yesNo/numeric values with Thursday-only guards.
        const finalYesNo = { ...yesNoValues };
        const finalNumeric = { ...numericValues };
        if (isThursday) {
            if (typeof weeklyMeetingAttendedRaw === "boolean")
                finalYesNo["weeklyMeetingAttended"] = weeklyMeetingAttendedRaw;
            if (typeof weeklyVideoShootParticipatedRaw === "boolean")
                finalYesNo["weeklyVideoShootParticipated"] = weeklyVideoShootParticipatedRaw;
            if (typeof weeklyVideoCountRaw !== "undefined")
                finalNumeric["weeklyVideoCount"] = toNumber(weeklyVideoCountRaw);
        }
        else {
            // Ensure these keys are present with sensible defaults on non-Thursday days
            finalYesNo["weeklyMeetingAttended"] = false;
            finalYesNo["weeklyVideoShootParticipated"] = false;
            finalNumeric["weeklyVideoCount"] = 0;
        }
        const entry = await prisma_1.prisma.marketingDailyEntry.create({
            data: {
                date: entryDate,
                dayOfWeek: resolvedDay,
                totalSales,
                totalProfit,
                payload: { yesNo: finalYesNo, numeric: finalNumeric, text: textValues },
                submittedById: actorId,
                submittedByName: auth.session?.user?.name ?? null,
                submittedByEmail: auth.session?.user?.email ?? null,
                receipts: {
                    create: receiptsClean.map((r) => ({
                        receiptNumber: r.receiptNumber || null,
                        sellingTotal: r.sellingTotal,
                        paymentMethod: r.paymentMethod,
                        items: {
                            create: r.items.map((it) => ({
                                productName: it.productName,
                                buyingPrice: it.buyingPrice,
                            })),
                        },
                    })),
                },
            },
            include: { receipts: { include: { items: true } } },
        });
        const isAdmin = auth.role === "ADMIN";
        const todaySummary = {
            totalReceipts: entry.receipts.length,
            totalSales,
            totalItems,
            mpesaTotal,
            cashTotal,
        };
        // Never expose profit to non-admins
        if (isAdmin)
            todaySummary.totalProfit = totalProfit;
        const period = (0, tradingPeriod_1.getTradingPeriodFor)(entryDate);
        const periodEntries = await prisma_1.prisma.marketingDailyEntry.findMany({
            where: { date: { gte: period.start, lte: period.end } },
            include: { receipts: { include: { items: true } } },
        });
        const periodSales = periodEntries.reduce((sum, e) => sum + e.receipts.reduce((rs, r) => rs + r.sellingTotal, 0), 0);
        const periodProfit = periodEntries.reduce((sum, e) => sum +
            e.receipts.reduce((rs, r) => rs + (r.sellingTotal - r.items.reduce((s, it) => s + it.buyingPrice, 0)), 0), 0);
        const periodItems = periodEntries.reduce((sum, e) => sum + e.receipts.reduce((rs, r) => rs + r.items.length, 0), 0);
        const periodMpesa = periodEntries.reduce((sum, e) => sum + e.receipts.filter((r) => r.paymentMethod === "MPESA").reduce((s, r) => s + r.sellingTotal, 0), 0);
        const periodCash = periodEntries.reduce((sum, e) => sum + e.receipts.filter((r) => r.paymentMethod === "CASH").reduce((s, r) => s + r.sellingTotal, 0), 0);
        const periodMpesaCount = periodEntries.reduce((sum, e) => sum + e.receipts.filter((r) => r.paymentMethod === "MPESA").length, 0);
        const periodCashCount = periodEntries.reduce((sum, e) => sum + e.receipts.filter((r) => r.paymentMethod === "CASH").length, 0);
        const periodTotalReceipts = periodEntries.reduce((sum, e) => sum + e.receipts.length, 0);
        const commission = (0, marketingCommission_1.getCommissionSummaryForSales)(periodSales);
        const periodSummary = {
            periodLabel: period.label,
            periodSales,
            mpesaTotal: periodMpesa,
            cashTotal: periodCash,
            countMpesaReceipts: periodMpesaCount,
            countCashReceipts: periodCashCount,
            totalReceipts: periodTotalReceipts,
            totalItems: periodItems,
            commission: commission.commission,
            nextTarget: commission.nextTarget,
            nextTierAmount: commission.nextTierReward,
        };
        // Only admins see period profit
        if (isAdmin)
            periodSummary.periodProfit = periodProfit;
        // Persist unified receipts/orders so marketing tracker sales become canonical receipts
        const createdReceiptLinks = [];
        try {
            for (const r of entry.receipts) {
                try {
                    const items = (r.items || []);
                    const perItemValue = items.length > 0 ? Number(r.sellingTotal || 0) / items.length : Number(r.sellingTotal || 0);
                    const payload = {
                        docType: 'RECEIPT',
                        customerName: entry.submittedByName || null,
                        customerPhone: null,
                        items: items.map((it) => ({
                            title: it.productName || 'Item',
                            unitPrice: perItemValue || Number(it.buyingPrice || 0) || 0,
                            quantity: 1,
                        })),
                        taxRate: 0,
                        showTax: false,
                        showDiscount: false,
                        paymentDetailsShown: false,
                        notes: `Imported from marketing entry ${entry.id}`,
                        marketingEntryId: entry.id,
                        marketingReceiptId: r.id,
                        attendantId: actorId,
                        serial: r.receiptNumber || `M-${entry.id}-${r.id}`,
                    };
                    const site = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || `https://${(new URL(req.url)).host}`;
                    const apiUrl = `${site.replace(/\/$/, '')}/api/receipts`;
                    // Forward the caller's cookies so the receipts endpoint can authenticate this server-to-server call.
                    const res = await fetch(apiUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            cookie: req.headers.get('cookie') || '',
                        },
                        body: JSON.stringify(payload),
                    });
                    if (res.ok) {
                        const json = await res.json();
                        const receiptId = json?.receiptId || json?.receipt?.id;
                        if (receiptId)
                            createdReceiptLinks.push(`${site.replace(/\/$/, '')}/receipts/${receiptId}`);
                    }
                    else {
                        const txt = await res.text();
                        console.error('Failed to sync marketing receipt to unified receipts', res.status, txt);
                    }
                }
                catch (innerErr) {
                    // Do not fail the main marketing submission if the receipt sync fails; log and continue
                    console.error('Failed to sync marketing receipt to unified receipts', innerErr);
                }
            }
        }
        catch (e) {
            console.error('Failed to persist unified receipts for marketing entry', e);
        }
        return server_1.NextResponse.json({ todaySummary, periodSummary, createdReceiptLinks }, { status: 201 });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to save marketing entry";
        console.error("marketing daily submit failed", err);
        return server_1.NextResponse.json({ error: msg }, { status: 500 });
    }
}
