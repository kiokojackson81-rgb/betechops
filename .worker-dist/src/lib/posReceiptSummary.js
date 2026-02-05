"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizePosReceiptsForPeriod = summarizePosReceiptsForPeriod;
const prisma_1 = require("@/lib/prisma");
const receiptKey_1 = require("@/lib/receiptKey");
const receiptKey_2 = require("@/lib/receiptKey");
const toNumber = (value) => {
    if (value === null || typeof value === "undefined")
        return 0;
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
};
const extractSales = (row) => {
    const totals = row.totals ?? {};
    const data = row.data ?? {};
    return (toNumber(totals.sellingTotal) ||
        toNumber(totals.grandTotal) ||
        toNumber(totals.total) ||
        toNumber(totals.amount) ||
        toNumber(totals.subtotal) ||
        toNumber(data.total) ||
        toNumber(data.amount) ||
        toNumber(row.order?.totalAmount) ||
        0);
};
const extractProfit = (row, sales) => {
    const totals = row.totals ?? {};
    const data = row.data ?? {};
    const candidate = toNumber(totals.profit) ||
        toNumber(data.profit) ||
        toNumber(totals.sellingTotal) - toNumber(totals.buyingTotal) ||
        toNumber(data.sellingTotal) - toNumber(data.buyingTotal);
    if (candidate !== 0)
        return candidate;
    const buying = toNumber(totals.buyingTotal) || toNumber(data.buyingTotal);
    if (buying > 0) {
        return sales - buying;
    }
    return 0;
};
const countItems = (row) => {
    const items = row.order?.items ?? [];
    return items.reduce((sum, item) => sum + Math.max(1, Math.trunc(Number(item?.quantity ?? 1))), 0);
};
const canonicalKeyForRow = (row) => {
    const canonicalNumber = (0, receiptKey_2.normalizeReceiptNumber)(row.receiptNumber) ||
        (0, receiptKey_2.normalizeReceiptNumber)(row.order?.orderNumber);
    return canonicalNumber || row.id;
};
async function summarizePosReceiptsForPeriod(period) {
    const receipts = (await prisma_1.prisma.receipt.findMany({
        where: {
            generatedAt: {
                gte: period.start,
                lte: period.end,
            },
        },
        include: {
            order: {
                select: {
                    orderNumber: true,
                    totalAmount: true,
                    items: {
                        select: {
                            quantity: true,
                        },
                    },
                },
            },
        },
    }));
    const seen = new Map();
    const periodLabel = `${period.start.toISOString()}_${period.end.toISOString()}`;
    let totalSales = 0;
    let totalProfit = 0;
    let totalItems = 0;
    const paymentStats = {
        totalSalesMpesa: 0,
        totalSalesCash: 0,
        countMpesaReceipts: 0,
        countCashReceipts: 0,
    };
    for (const receipt of receipts) {
        const key = canonicalKeyForRow(receipt);
        if (seen.has(key)) {
            console.warn(`[pos-summary][period=${periodLabel}] duplicate POS receipt detected for key=${key} (existing=${seen.get(key)}, new=${receipt.id}); counting only the first entry.`);
            continue;
        }
        seen.set(key, receipt.id);
        const sales = extractSales(receipt);
        totalSales += sales;
        totalProfit += extractProfit(receipt, sales);
        totalItems += countItems(receipt);
        const method = (0, receiptKey_1.normalizePaymentMethod)(receipt.data?.paymentMethod ??
            receipt.totals?.paymentMethod ??
            "MPESA");
        if (method === "CASH") {
            paymentStats.totalSalesCash += sales;
            paymentStats.countCashReceipts += 1;
        }
        else {
            paymentStats.totalSalesMpesa += sales;
            paymentStats.countMpesaReceipts += 1;
        }
    }
    return {
        totalSales,
        totalProfit,
        totalItems,
        totalReceipts: seen.size,
        receiptKeys: Array.from(seen.keys()),
        paymentStats,
    };
}
