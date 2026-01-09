"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const receiptSseBroker_1 = require("@/lib/receiptSseBroker");
const marketingReport_1 = require("@/lib/marketingReport");
const api_2 = require("@/lib/api");
const auth_1 = require("@/lib/auth");
const zod_1 = require("zod");
const ReceiptItemSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    productName: zod_1.z.string().min(1, "productName must be a non-empty string"),
    buyingPrice: zod_1.z.number().min(0, "buyingPrice must be non-negative"),
});
const ReceiptSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    receiptNumber: zod_1.z.string().nullable().optional(),
    sellingTotal: zod_1.z.number().min(0, "sellingTotal must be non-negative"),
    paymentMethod: zod_1.z.enum(["MPESA", "CASH"]),
    items: zod_1.z.array(ReceiptItemSchema).min(1, "Each receipt must contain at least one item"),
});
const UpdateEntrySchema = zod_1.z.object({
    entryId: zod_1.z.string(),
    receipts: zod_1.z.array(ReceiptSchema),
});
const WipeSchema = zod_1.z.object({
    entryId: zod_1.z.string(),
    action: zod_1.z.literal("wipe"),
});
async function POST(req) {
    const authz = await (0, api_1.requireRole)("ADMIN");
    if (!authz.ok)
        return authz.res;
    let body;
    try {
        body = await req.json();
    }
    catch (err) {
        return server_1.NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    // Support wipe action
    if (body?.action === "wipe") {
        try {
            const w = WipeSchema.parse(body);
            const entryId = w.entryId;
            // Capture 'before' snapshot for audit
            const before = await prisma_1.prisma.marketingDailyEntry.findUnique({ where: { id: entryId }, include: { receipts: { include: { items: true } } } });
            if (!before)
                return server_1.NextResponse.json({ error: "Entry not found" }, { status: 404 });
            // Delete items then receipts for the entry
            await prisma_1.prisma.marketingReceiptItem.deleteMany({ where: { receipt: { dailyEntryId: entryId } } });
            await prisma_1.prisma.marketingReceipt.deleteMany({ where: { dailyEntryId: entryId } });
            // Reset totals on the daily entry
            await prisma_1.prisma.marketingDailyEntry.update({ where: { id: entryId }, data: { totalSales: 0, totalProfit: 0 } });
            // Audit log the wipe (best-effort) with extra context
            try {
                const actorId = await (0, api_2.getActorId)();
                const session = await (0, auth_1.auth)();
                const actorEmail = session?.user?.email || "";
                const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
                await prisma_1.prisma.actionLog.create({
                    data: {
                        actorId: actorId || "",
                        entity: "MarketingDailyEntry",
                        entityId: entryId,
                        action: "WIPE_RECEIPTS",
                        before: before,
                        after: { actorEmail, requestPayload: body, ip },
                    },
                });
            }
            catch (e) {
                console.warn("failed to write actionLog for marketing wipe", e);
            }
            // Return updated entry and period report
            const entryAfter = await prisma_1.prisma.marketingDailyEntry.findUnique({ where: { id: entryId }, include: { receipts: { include: { items: true } } } });
            const period = (0, tradingPeriod_1.getTradingPeriodFor)(entryAfter.date);
            const report = await (0, marketingReport_1.getMarketingReport)({ tradingPeriodKey: period.key });
            return server_1.NextResponse.json({ wiped: true, entry: entryAfter, report }, { status: 200 });
        }
        catch (err) {
            if (err instanceof zod_1.z.ZodError)
                return server_1.NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 });
            console.error("wipe failed", err);
            return server_1.NextResponse.json({ error: err instanceof Error ? err.message : "wipe failed" }, { status: 500 });
        }
    }
    let parsed;
    try {
        parsed = UpdateEntrySchema.parse(body);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return server_1.NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 });
        }
        return server_1.NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const { entryId, receipts } = parsed;
    try {
        // receipts validated by Zod already
        // Upsert-style behavior: update existing receipts/items, create new ones, delete removed
        const existingReceipts = await prisma_1.prisma.marketingReceipt.findMany({ where: { dailyEntryId: entryId }, include: { items: true } });
        const existingReceiptIds = existingReceipts.map((r) => r.id);
        const providedReceiptIds = receipts.filter((r) => r?.id).map((r) => r.id);
        // Delete receipts that existed but were removed in the payload
        const receiptsToDelete = existingReceiptIds.filter((id) => !providedReceiptIds.includes(id));
        if (receiptsToDelete.length) {
            await prisma_1.prisma.marketingReceipt.deleteMany({ where: { id: { in: receiptsToDelete } } });
        }
        for (const r of receipts) {
            const items = Array.isArray(r.items) ? r.items : [];
            const normalized = {
                receiptNumber: r.receiptNumber || null,
                sellingTotal: Number(r.sellingTotal) || 0,
                paymentMethod: ((String(r.paymentMethod || "")).toUpperCase() === "CASH" ? "CASH" : "MPESA"),
            };
            if (r.id && existingReceiptIds.includes(r.id)) {
                // Update receipt fields
                await prisma_1.prisma.marketingReceipt.update({ where: { id: r.id }, data: { receiptNumber: normalized.receiptNumber, sellingTotal: normalized.sellingTotal, paymentMethod: normalized.paymentMethod } });
                // Sync items for this receipt
                const exist = existingReceipts.find((er) => er.id === r.id);
                const existingItemIds = (exist.items || []).map((it) => it.id);
                const providedItemIds = items.filter((it) => it?.id).map((it) => it.id);
                const itemsToDelete = existingItemIds.filter((id) => !providedItemIds.includes(id));
                if (itemsToDelete.length) {
                    await prisma_1.prisma.marketingReceiptItem.deleteMany({ where: { id: { in: itemsToDelete } } });
                }
                for (const it of items) {
                    const normalizedItem = { productName: String(it.productName || "").trim(), buyingPrice: Number(it.buyingPrice) || 0 };
                    if (it.id && existingItemIds.includes(it.id)) {
                        await prisma_1.prisma.marketingReceiptItem.update({ where: { id: it.id }, data: { productName: normalizedItem.productName, buyingPrice: normalizedItem.buyingPrice } });
                    }
                    else {
                        await prisma_1.prisma.marketingReceiptItem.create({ data: { receiptId: r.id, productName: normalizedItem.productName, buyingPrice: normalizedItem.buyingPrice } });
                    }
                }
            }
            else {
                // Create new receipt with items
                await prisma_1.prisma.marketingReceipt.create({ data: { dailyEntryId: entryId, receiptNumber: normalized.receiptNumber, sellingTotal: normalized.sellingTotal, paymentMethod: normalized.paymentMethod, items: { create: items.map((it) => ({ productName: String(it.productName || "").trim(), buyingPrice: Number(it.buyingPrice) || 0 })) } } });
            }
        }
        // Recompute totals for the day and update the entry
        const entryWithReceipts = await prisma_1.prisma.marketingDailyEntry.findUnique({
            where: { id: entryId },
            include: { receipts: { include: { items: true } } },
        });
        if (!entryWithReceipts)
            return server_1.NextResponse.json({ error: "Entry not found" }, { status: 404 });
        const totalSales = entryWithReceipts.receipts.reduce((s, r) => s + (r.sellingTotal || 0), 0);
        const totalProfit = entryWithReceipts.receipts.reduce((s, r) => s + ((r.sellingTotal || 0) - (r.items?.reduce((is, it) => is + (it.buyingPrice || 0), 0) || 0)), 0);
        await prisma_1.prisma.marketingDailyEntry.update({ where: { id: entryId }, data: { totalSales, totalProfit } });
        // Return updated entry and aggregates for the trading period
        const entryAfter = await prisma_1.prisma.marketingDailyEntry.findUnique({ where: { id: entryId }, include: { receipts: { include: { items: true } } } });
        if (!entryAfter)
            return server_1.NextResponse.json({ error: "Entry not found" }, { status: 404 });
        const period = (0, tradingPeriod_1.getTradingPeriodFor)(entryAfter.date);
        const report = await (0, marketingReport_1.getMarketingReport)({ tradingPeriodKey: period.key });
        // Notify admin summary subscribers that marketing receipts changed
        try {
            (0, receiptSseBroker_1.publishSummaryUpdate)({ attendantId: entryAfter.submittedById ?? null, timestamp: new Date().toISOString() });
        }
        catch (e) {
            console.warn("[admin/marketing-report/update-entry] failed to publish summary update", e);
        }
        return server_1.NextResponse.json({ updated: true, entry: entryAfter, report }, { status: 200 });
    }
    catch (err) {
        console.error("admin update marketing entry failed", err);
        return server_1.NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
    }
}
