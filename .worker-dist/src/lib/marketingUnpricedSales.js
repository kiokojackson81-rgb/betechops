"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUnpricedDailySalesForCurrentPeriod = getUnpricedDailySalesForCurrentPeriod;
const prisma_1 = require("@/lib/prisma");
const marketingPeriod_1 = require("./marketingPeriod");
async function getUnpricedDailySalesForCurrentPeriod() {
    const { startDate, endDate } = await (0, marketingPeriod_1.getCurrentTradingPeriod)();
    const [dailyReportSales, supportItems] = await Promise.all([
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
        prisma_1.prisma.supportReceiptItem.findMany({
            where: {
                buyingPrice: 0,
                receipt: {
                    dailyEntry: {
                        date: {
                            gte: startDate,
                            lte: endDate,
                        },
                    },
                },
            },
            include: {
                receipt: {
                    include: {
                        dailyEntry: {
                            include: { submittedBy: true },
                        },
                        items: true,
                    },
                },
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
        attendantName: sale.dailyReport?.submittedBy ??
            sale.dailyReport?.user?.name ??
            "Unknown",
        attendantEmail: sale.dailyReport?.user?.email ?? null,
        receiptTotal: Number(sale.price),
    }));
    const supportSales = supportItems.map((item) => {
        const receipt = item.receipt;
        const entry = receipt.dailyEntry;
        const itemsCount = Math.max(1, receipt.items.length);
        const productLabel = item.productName || "Support sale";
        return {
            id: item.id,
            source: "support",
            saleDate: (entry?.date ?? receipt.createdAt ?? new Date()).toISOString(),
            day: entry?.dayOfWeek ?? null,
            productName: productLabel,
            sellingPrice: Math.round(Number(receipt.sellingTotal) / itemsCount),
            paymentMethod: receipt.paymentMethod ?? null,
            receiptNumber: receipt.receiptNumber ?? "",
            attendantName: entry?.submittedBy?.name ?? "Support attendant",
            attendantEmail: entry?.submittedBy?.email ?? null,
            receiptTotal: Number(receipt.sellingTotal ?? 0),
        };
    });
    return [...marketingSales, ...supportSales];
}
