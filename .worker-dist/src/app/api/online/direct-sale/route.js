"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.POST = POST;
const server_1 = require("next/server");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const prisma_1 = require("@/lib/prisma");
const auth_1 = require("@/lib/auth");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const supportEntries_1 = require("@/lib/supportEntries");
exports.dynamic = "force-dynamic";
const ItemSchema = zod_1.z.object({
    productName: zod_1.z.string().optional(),
});
const ReceiptSchema = zod_1.z.object({
    receiptNumber: zod_1.z.string().optional().nullable(),
    sellingTotal: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]),
    paymentMethod: zod_1.z.string().optional(),
    items: zod_1.z.array(ItemSchema).optional(),
});
const PayloadSchema = zod_1.z.object({
    date: zod_1.z.string(),
    dayOfWeek: zod_1.z.string().optional(),
    receipts: zod_1.z.array(ReceiptSchema),
});
const normalizePaymentMethod = (value) => (String(value).toUpperCase() === "CASH" ? "CASH" : "MPESA");
const toNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
};
async function POST(req) {
    const auth = await (0, auth_1.requireAttendant)(req, ["JUMIA_KILIMALL_OPS", "BETECH_OPS", "SUPERVISOR", "ADMIN"]);
    if (!auth.ok)
        return auth.res;
    let payload;
    try {
        payload = await req.json();
    }
    catch {
        return server_1.NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }
    const parsed = PayloadSchema.safeParse(payload);
    if (!parsed.success) {
        return server_1.NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }
    const { date, dayOfWeek, receipts } = parsed.data;
    const entryDate = new Date(date);
    if (Number.isNaN(entryDate.getTime())) {
        return server_1.NextResponse.json({ error: "Invalid date supplied" }, { status: 400 });
    }
    const resolvedDay = typeof dayOfWeek === "string" && dayOfWeek.length > 0 ? dayOfWeek : entryDate.toLocaleDateString("en-KE", { weekday: "long" });
    const normalizedReceipts = receipts
        .map((receipt) => {
        const sellingTotal = Math.max(0, toNumber(receipt.sellingTotal));
        const items = Array.isArray(receipt.items) && receipt.items.length > 0 ? receipt.items : [{ productName: "Direct sale item" }];
        return {
            receiptNumber: typeof receipt.receiptNumber === "string" ? receipt.receiptNumber.trim() : null,
            sellingTotal,
            paymentMethod: normalizePaymentMethod(receipt.paymentMethod),
            items: items.map((item, index) => ({
                productName: (item.productName ?? "").trim() || `Item ${index + 1}`,
            })),
        };
    })
        .filter((receipt) => receipt.sellingTotal > 0);
    if (!normalizedReceipts.length) {
        return server_1.NextResponse.json({ error: "At least one receipt with a selling total is required" }, { status: 400 });
    }
    let entryId = null;
    await prisma_1.prisma.$transaction(async (tx) => {
        const created = await tx.supportDailyEntry.create({
            data: {
                date: entryDate,
                dayOfWeek: resolvedDay,
                totalSales: normalizedReceipts.reduce((sum, receipt) => sum + receipt.sellingTotal, 0),
                totalProfit: 0,
                newBatteries: 0,
                changedBatteries: 0,
                submittedById: auth.user.id,
                receipts: {
                    create: normalizedReceipts.map((receipt) => ({
                        receiptNumber: receipt.receiptNumber,
                        sellingTotal: receipt.sellingTotal,
                        paymentMethod: receipt.paymentMethod,
                        items: {
                            create: receipt.items.map((item) => ({
                                productName: item.productName,
                                buyingPrice: 0,
                            })),
                        },
                    })),
                },
            },
            select: { id: true },
        });
        entryId = created.id;
        await tx.attendantActivity.createMany({
            data: normalizedReceipts.map((receipt) => ({
                userId: auth.user.id,
                category: (auth.user.attendantCategory ?? client_1.AttendantCategory.JUMIA_KILIMALL_OPS),
                metric: "onlineDirectSale",
                numericValue: receipt.sellingTotal,
                entryDate,
            })),
        });
    });
    const period = (0, tradingPeriod_1.getTradingPeriodFor)(entryDate);
    const aggregates = await (0, supportEntries_1.getSupportPeriodAggregates)({ userId: auth.user.id, period });
    return server_1.NextResponse.json({
        entryId,
        period: {
            key: period.key,
            label: period.label,
        },
        aggregates: aggregates.aggregates,
    }, { status: 201 });
}
