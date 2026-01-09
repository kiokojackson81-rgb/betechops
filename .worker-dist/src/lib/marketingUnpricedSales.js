"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUnpricedDailySalesForCurrentPeriod = getUnpricedDailySalesForCurrentPeriod;
const prisma_1 = require("@/lib/prisma");
const marketingPeriod_1 = require("./marketingPeriod");
const timezone_1 = require("@/lib/timezone");
async function getUnpricedDailySalesForCurrentPeriod() {
    const { startDate, endDate } = await (0, marketingPeriod_1.getCurrentTradingPeriodFor)((0, timezone_1.nowInNairobi)());
    const [dailyReportSales, supportReceipts] = await Promise.all([
        prisma_1.prisma.dailySale.findMany({
            where: {
                dailyReport: {
                    date: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
                marketingSales: { none: {} },
            },
            include: {
                dailyReport: {
                    include: { user: true },
                },
            },
            orderBy: { createdAt: "asc" },
        }),
        prisma_1.prisma.supportReceipt.findMany({
            where: {
                dailyEntry: {
                    date: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
                items: {
                    some: {
                        buyingPrice: 0,
                    },
                },
            },
            include: {
                dailyEntry: {
                    include: { submittedBy: true },
                },
                items: true,
            },
            orderBy: { createdAt: "asc" },
        }),
    ]);
    const marketingSales = dailyReportSales.map((sale) => ({
        id: sale.id,
        source: "daily-sale",
        saleDate: (sale.dailyReport?.date ?? sale.createdAt).toISOString(),
        day: sale.dailyReport?.day ?? null,
        productName: sale.productName,
        sellingPrice: Number(sale.price),
        paymentMethod: sale.paymentMethod ?? null,
        receiptNumber: sale.receiptNumber ?? "",
        attendantName: sale.dailyReport?.submittedBy ?? sale.dailyReport?.user?.name ?? "Unknown",
        attendantEmail: sale.dailyReport?.user?.email ?? null,
        receiptTotal: Number(sale.price),
        itemsPending: 1,
        itemsTotal: 1,
    }));
    const supportSales = supportReceipts
        .map((receipt) => {
        const entry = receipt.dailyEntry;
        const pendingItems = (receipt.items || []).filter((item) => Number(item.buyingPrice ?? 0) <= 0);
        if (!pendingItems.length)
            return null;
        return {
            id: receipt.id,
            source: "support",
            saleDate: (entry?.date ?? receipt.createdAt ?? new Date()).toISOString(),
            day: entry?.dayOfWeek ?? null,
            productName: `Receipt ${receipt.receiptNumber || ""}`.trim() || "Support receipt",
            sellingPrice: Number(receipt.sellingTotal ?? 0),
            paymentMethod: receipt.paymentMethod ?? null,
            receiptNumber: receipt.receiptNumber ?? "",
            attendantName: entry?.submittedBy?.name ?? "Support attendant",
            attendantEmail: entry?.submittedBy?.email ?? null,
            receiptTotal: Number(receipt.sellingTotal ?? 0),
            receiptItems: pendingItems.map((item) => ({
                id: item.id,
                productName: item.productName || "Item",
                buyingPrice: item.buyingPrice ? Number(item.buyingPrice) : null,
            })),
            itemsPending: pendingItems.length,
            itemsTotal: receipt.items.length || pendingItems.length,
        };
    })
        .filter(Boolean);
    // Exclude support receipts with zero sellingTotal from the unpriced list
    const filteredSupportSales = supportSales.filter((s) => (s.receiptTotal ?? 0) > 0);
    return [...marketingSales, ...filteredSupportSales];
}
