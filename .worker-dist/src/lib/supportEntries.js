"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupportPeriodAggregates = getSupportPeriodAggregates;
const prisma_1 = require("@/lib/prisma");
const receiptKey_1 = require("@/lib/receiptKey");
async function getSupportPeriodAggregates(opts) {
    const { userId, period } = opts;
    const entries = await prisma_1.prisma.supportDailyEntry.findMany({
        where: {
            submittedById: userId,
            date: { gte: period.start, lte: period.end },
        },
        include: {
            receipts: {
                select: {
                    id: true,
                    receiptNumber: true,
                    receiptKey: true,
                    sellingTotal: true,
                    buyingTotal: true,
                    paymentMethod: true,
                    createdAt: true,
                    items: { select: { id: true, buyingPrice: true } },
                },
            },
        },
    });
    const aggregates = {
        totalSales: 0,
        totalProfit: 0,
        totalReceipts: 0,
        totalItems: 0,
        newBatteries: 0,
        changedBatteries: 0,
        paymentStats: { totalSalesMpesa: 0, totalSalesCash: 0, countMpesaReceipts: 0, countCashReceipts: 0 },
    };
    // Map keyed by canonical receiptKey to avoid double-counting within support
    const seen = new Map();
    for (const entry of entries) {
        aggregates.newBatteries += entry.newBatteries ?? 0;
        aggregates.changedBatteries += entry.changedBatteries ?? 0;
        for (const r of entry.receipts ?? []) {
            const key = (0, receiptKey_1.buildReceiptKey)(r.receiptNumber ?? null, r.id) || `ID:${r.id}`;
            const selling = Number(r.sellingTotal ?? 0);
            const buying = Number(r.buyingTotal ?? 0);
            const itemsCount = Array.isArray(r.items) ? r.items.length : 0;
            const method = (0, receiptKey_1.normalizePaymentMethod)(r.paymentMethod);
            const existing = seen.get(key);
            if (existing) {
                // merge stats (do not increment receipt count)
                existing.sales += selling;
                existing.profit += selling - buying;
                existing.items += itemsCount;
                if (method === "CASH") {
                    existing.cash += selling;
                }
                else {
                    existing.mpesa += selling;
                }
            }
            else {
                seen.set(key, {
                    id: r.id,
                    sales: selling,
                    profit: selling - buying,
                    items: itemsCount,
                    mpesa: method === "MPESA" ? selling : 0,
                    cash: method === "CASH" ? selling : 0,
                });
            }
        }
    }
    // aggregate deduped receipts
    for (const [, v] of seen) {
        aggregates.totalSales += v.sales;
        aggregates.totalProfit += v.profit;
        aggregates.totalItems += v.items;
        aggregates.totalReceipts += 1;
        aggregates.paymentStats.totalSalesMpesa += v.mpesa;
        aggregates.paymentStats.totalSalesCash += v.cash;
        if (v.mpesa > 0)
            aggregates.paymentStats.countMpesaReceipts += 1;
        if (v.cash > 0)
            aggregates.paymentStats.countCashReceipts += 1;
    }
    return { entryCount: entries.length, aggregates, perReceipts: Object.fromEntries(Array.from(seen.entries())) };
}
