"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.POST = POST;
const server_1 = require("next/server");
const next_1 = require("next-auth/next");
const nextAuth_1 = require("@/lib/nextAuth");
const prisma_1 = require("@/lib/prisma");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const supportCommission_1 = require("@/lib/supportCommission");
exports.dynamic = "force-dynamic";
const SPECIAL_EMAIL = "jeniffer@betech.co.ke";
async function POST(req) {
    const session = (await (0, next_1.getServerSession)(nextAuth_1.authOptions));
    if (!session?.user) {
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const role = session.user.role;
    const email = session.user.email?.toLowerCase();
    const allowPricing = role === "ADMIN" ||
        email === SPECIAL_EMAIL ||
        email === process.env.SUPPORT_PRICING_EMAIL?.toLowerCase();
    if (!allowPricing) {
        return server_1.NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    let payload = null;
    try {
        payload = (await req.json());
    }
    catch {
        return server_1.NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    if (!payload?.receiptItemId || typeof payload.receiptItemId !== "string") {
        return server_1.NextResponse.json({ error: "receiptItemId is required" }, { status: 400 });
    }
    const parsedBuyingPrice = Number(payload.buyingPrice);
    if (!Number.isFinite(parsedBuyingPrice) || parsedBuyingPrice <= 0) {
        return server_1.NextResponse.json({ error: "buyingPrice must be a positive number" }, { status: 400 });
    }
    const roundedPrice = Math.round(parsedBuyingPrice);
    const receiptItem = await prisma_1.prisma.supportReceiptItem.findUnique({
        where: { id: payload.receiptItemId },
        include: {
            receipt: {
                include: {
                    dailyEntry: true,
                    items: true,
                },
            },
        },
    });
    if (!receiptItem || !receiptItem.receipt?.dailyEntry) {
        return server_1.NextResponse.json({ error: "Support receipt item not found" }, { status: 404 });
    }
    const entryId = receiptItem.receipt.dailyEntry.id;
    const previous = Number(receiptItem.buyingPrice ?? 0);
    const profitDelta = previous - roundedPrice; // negative when buying price increases (reduces profit)
    // derive a per-item selling value so callers (UI) can update quick-stats
    const receipt = receiptItem.receipt;
    const itemsCount = Math.max(1, (receipt.items || []).length);
    const sellingTotal = Number(receipt.sellingTotal ?? 0);
    const sellingPrice = Math.round(sellingTotal / itemsCount);
    await prisma_1.prisma.$transaction(async (tx) => {
        // update the receipt item
        await tx.supportReceiptItem.update({
            where: { id: receiptItem.id },
            data: { buyingPrice: roundedPrice },
        });
        // Recompute totalProfit for the whole daily entry in a safe, idempotent way
        const receipts = await tx.supportReceipt.findMany({
            where: { dailyEntryId: entryId },
            include: { items: true },
        });
        let recomputedTotalProfit = 0;
        for (const r of receipts) {
            const sell = Number(r.sellingTotal ?? 0);
            const cost = (r.items || []).reduce((s, it) => s + Number(it.buyingPrice ?? 0), 0);
            recomputedTotalProfit += sell - cost;
        }
        await tx.supportDailyEntry.update({
            where: { id: entryId },
            data: { totalProfit: recomputedTotalProfit },
        });
    });
    const submitterId = receiptItem.receipt.dailyEntry.submittedById;
    if (submitterId) {
        try {
            const period = (0, tradingPeriod_1.getTradingPeriodFor)(new Date(receiptItem.receipt.dailyEntry.date));
            await (0, supportCommission_1.recomputeSupportCommissionLedger)({ userId: submitterId, period });
        }
        catch (ledgerErr) {
            console.error("[support/price-sale] failed to recompute commission ledger", ledgerErr);
        }
    }
    return server_1.NextResponse.json({
        ok: true,
        entryId,
        profitDelta,
        saleValue: sellingPrice,
        receiptTotal: sellingTotal,
        paymentMethod: receipt.paymentMethod ?? null,
    });
}
