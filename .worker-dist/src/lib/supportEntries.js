"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupportPeriodAggregates = getSupportPeriodAggregates;
const prisma_1 = require("@/lib/prisma");
async function getSupportPeriodAggregates(opts) {
    const { userId, period } = opts;
    const entries = await prisma_1.prisma.supportDailyEntry.findMany({
        where: {
            submittedById: userId,
            date: {
                gte: period.start,
                lte: period.end,
            },
        },
        select: {
            totalSales: true,
            totalProfit: true,
            newBatteries: true,
            changedBatteries: true,
            receipts: {
                select: {
                    _count: {
                        select: { items: true },
                    },
                },
            },
        },
    });
    const aggregates = entries.reduce((acc, entry) => {
        acc.totalSales += entry.totalSales;
        acc.totalProfit += entry.totalProfit;
        acc.newBatteries += entry.newBatteries;
        acc.changedBatteries += entry.changedBatteries;
        acc.totalReceipts += entry.receipts.length;
        acc.totalItems += entry.receipts.reduce((sum, receipt) => sum + receipt._count.items, 0);
        return acc;
    }, {
        totalSales: 0,
        totalProfit: 0,
        totalReceipts: 0,
        totalItems: 0,
        newBatteries: 0,
        changedBatteries: 0,
    });
    return {
        entryCount: entries.length,
        aggregates,
    };
}
