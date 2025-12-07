"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.POST = POST;
const server_1 = require("next/server");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const prisma_1 = require("@/lib/prisma");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const auth_1 = require("@/lib/auth");
const supportEntries_1 = require("@/lib/supportEntries");
const supportCommission_1 = require("@/lib/supportCommission");
exports.dynamic = "force-dynamic";
const ReceiptItemSchema = zod_1.z.object({
    productName: zod_1.z.string().optional(),
    buyingPrice: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(),
});
const ReceiptSchema = zod_1.z.object({
    receiptNumber: zod_1.z.string().optional().nullable(),
    sellingTotal: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]),
    paymentMethod: zod_1.z.string().optional(),
    items: zod_1.z.array(ReceiptItemSchema).default([]),
});
const PerformanceSchema = zod_1.z.object({
    newBatteries: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(),
    changedBatteries: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(),
});
const PayloadSchema = zod_1.z.object({
    date: zod_1.z.string(),
    dayOfWeek: zod_1.z.string().optional(),
    newBatteries: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(),
    changedBatteries: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(),
    receipts: zod_1.z.array(ReceiptSchema),
    performance: PerformanceSchema.optional(),
});
const toNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
};
const normalizePaymentMethod = (value) => {
    const normalized = (value ?? "").toUpperCase();
    return normalized === "CASH" ? "CASH" : "MPESA";
};
async function POST(req) {
    const auth = await (0, auth_1.requireAttendant)(req, ["SUPPORT_OPS", "ADMIN"]);
    if (!auth.ok)
        return auth.res;
    let body;
    try {
        body = await req.json();
    }
    catch {
        return server_1.NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }
    const parsed = PayloadSchema.safeParse(body);
    if (!parsed.success) {
        return server_1.NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }
    const { date, dayOfWeek, receipts, performance, newBatteries: legacyNew = 0, changedBatteries: legacyChanged = 0, } = parsed.data;
    if (!date) {
        return server_1.NextResponse.json({ error: "date is required" }, { status: 400 });
    }
    const entryDate = new Date(date);
    if (Number.isNaN(entryDate.getTime())) {
        return server_1.NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    const resolvedDay = typeof dayOfWeek === "string" && dayOfWeek.length > 0
        ? dayOfWeek
        : entryDate.toLocaleDateString("en-KE", { weekday: "long" });
    const metrics = {
        newBatteries: Math.max(0, toNumber(performance?.newBatteries ?? legacyNew)),
        changedBatteries: Math.max(0, toNumber(performance?.changedBatteries ?? legacyChanged)),
    };
    const normalizedReceipts = receipts
        .map((receipt) => {
        const sellingTotal = Math.max(0, toNumber(receipt.sellingTotal));
        const paymentMethod = normalizePaymentMethod(receipt.paymentMethod);
        const receiptNumber = typeof receipt.receiptNumber === "string" ? receipt.receiptNumber.trim() : null;
        const normalizedItems = (receipt.items.length > 0 ? receipt.items : [{ productName: "Battery sale" }]).map((item) => ({
            productName: (item.productName ?? "").trim() || "Battery sale",
            buyingPrice: 0,
        }));
        return { receiptNumber, sellingTotal, paymentMethod, items: normalizedItems };
    })
        .filter((receipt) => receipt.sellingTotal > 0 || receipt.items.length > 0);
    if (normalizedReceipts.length === 0) {
        return server_1.NextResponse.json({ error: "At least one receipt is required" }, { status: 400 });
    }
    let totalSales = 0;
    normalizedReceipts.forEach((receipt) => {
        totalSales += receipt.sellingTotal;
    });
    // Initial submissions should not carry any profit until the pricing workflow
    // attaches real buying prices. Profit is recomputed after pricing via the
    // `/api/support/price-sale` route. Persist zero here to avoid paying
    // commission before pricing is complete.
    let totalProfit = 0;
    try {
        const entry = await prisma_1.prisma.$transaction(async (tx) => {
            const created = await tx.supportDailyEntry.create({
                data: {
                    date: entryDate,
                    dayOfWeek: resolvedDay,
                    totalSales,
                    totalProfit,
                    newBatteries: metrics.newBatteries,
                    changedBatteries: metrics.changedBatteries,
                    submittedById: auth.user.id,
                    receipts: {
                        create: normalizedReceipts.map((receipt) => ({
                            receiptNumber: receipt.receiptNumber,
                            sellingTotal: receipt.sellingTotal,
                            paymentMethod: receipt.paymentMethod,
                            items: {
                                create: receipt.items.map((item) => ({
                                    productName: item.productName || "Item",
                                    buyingPrice: 0,
                                })),
                            },
                        })),
                    },
                },
                select: { id: true },
            });
            const activityData = [];
            if (metrics.newBatteries > 0) {
                activityData.push({
                    userId: auth.user.id,
                    category: client_1.AttendantCategory.SUPPORT_OPS,
                    metric: "newBatteries",
                    intValue: metrics.newBatteries,
                    entryDate,
                });
            }
            if (metrics.changedBatteries > 0) {
                activityData.push({
                    userId: auth.user.id,
                    category: client_1.AttendantCategory.SUPPORT_OPS,
                    metric: "changedBatteries",
                    intValue: metrics.changedBatteries,
                    entryDate,
                });
            }
            if (activityData.length) {
                await tx.attendantActivity.createMany({ data: activityData });
            }
            return created;
        });
        const period = (0, tradingPeriod_1.getTradingPeriodFor)(entryDate);
        const summary = await (0, supportEntries_1.getSupportPeriodAggregates)({ userId: auth.user.id, period });
        const aggregates = summary.aggregates;
        // Update commission ledger so payroll and earnings views include the new profit.
        try {
            await (0, supportCommission_1.recomputeSupportCommissionLedger)({ userId: auth.user.id, period });
        }
        catch (ledgerErr) {
            console.error("[support/daily] failed to recompute commission ledger", ledgerErr);
        }
        return server_1.NextResponse.json({
            entryId: entry.id,
            period: {
                key: period.key,
                label: period.label,
                start: period.start.toISOString(),
                end: period.end.toISOString(),
            },
            aggregates: {
                ...aggregates,
                batteryEarnings: (aggregates.newBatteries + aggregates.changedBatteries) * 70,
            },
        }, { status: 201 });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save support entry";
        return server_1.NextResponse.json({ error: message }, { status: 500 });
    }
}
