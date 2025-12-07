"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeMarketingReportsForPeriod = summarizeMarketingReportsForPeriod;
exports.recomputeMarketingCommissionLedger = recomputeMarketingCommissionLedger;
const prisma_1 = require("@/lib/prisma");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const marketingCommission_1 = require("@/lib/marketingCommission");
const emptyTotals = () => ({
    totalSales: 0,
    totalProfit: 0,
    totalReceipts: 0,
    totalItems: 0,
    totalNewProducts: 0,
    totalEditedProducts: 0,
    totalCopiedProducts: 0,
    walkInsServed: 0,
    walkInsPurchased: 0,
    paymentStats: {
        totalSalesMpesa: 0,
        totalSalesCash: 0,
        countMpesaReceipts: 0,
        countCashReceipts: 0,
    },
});
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const toNumber = (value) => {
    if (value === null || typeof value === "undefined")
        return 0;
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
};
const normalizeMethod = (method) => {
    if (typeof method !== "string")
        return "MPESA";
    return method.toUpperCase() === "CASH" ? "CASH" : "MPESA";
};
const deriveReceiptsFromSales = (sales) => {
    if (!sales.length)
        return 0;
    const keys = new Set();
    sales.forEach((sale, index) => {
        const method = normalizeMethod(sale.paymentMethod);
        const receiptKey = sale.receiptNumber && sale.receiptNumber.trim().length > 0 ? sale.receiptNumber.trim() : `unnamed-${index}`;
        keys.add(`${receiptKey}|${method}`);
    });
    return keys.size || 1;
};
async function summarizeMarketingReportsForPeriod(opts) {
    const { userId, period } = opts;
    const client = opts.client ?? prisma_1.prisma;
    if (!userId) {
        return { totals: emptyTotals(), entryCount: 0 };
    }
    const [marketingEntries, reports] = await Promise.all([
        client.marketingDailyEntry.findMany({
            where: {
                submittedById: userId,
                date: { gte: period.start, lte: period.end },
            },
            include: {
                receipts: { include: { items: true } },
                sales: true,
            },
        }),
        client.dailyReport.findMany({
            where: {
                userId,
                date: { gte: period.start, lte: period.end },
            },
            include: { sales: true },
        }),
    ]);
    if (marketingEntries.length === 0 && reports.length === 0) {
        return { totals: emptyTotals(), entryCount: 0 };
    }
    const totals = emptyTotals();
    marketingEntries.forEach((entry) => {
        const receipts = entry.receipts ?? [];
        if (receipts.length > 0) {
            receipts.forEach((receipt) => {
                const selling = toNumber(receipt.sellingTotal);
                totals.totalSales += selling;
                const items = receipt.items ?? [];
                const buyingSum = items.reduce((sum, item) => sum + toNumber(item.buyingPrice), 0);
                totals.totalProfit += selling - buyingSum;
                totals.totalItems += items.length;
                totals.totalReceipts += 1;
                const method = normalizeMethod(receipt.paymentMethod);
                if (method === "CASH") {
                    totals.paymentStats.totalSalesCash += selling;
                    totals.paymentStats.countCashReceipts += 1;
                }
                else {
                    totals.paymentStats.totalSalesMpesa += selling;
                    totals.paymentStats.countMpesaReceipts += 1;
                }
            });
            return;
        }
        const sales = entry.sales ?? [];
        if (sales.length > 0) {
            const receiptTracker = new Set();
            sales.forEach((sale, index) => {
                const selling = toNumber(sale.sellingPrice);
                const buying = toNumber(sale.buyingPrice);
                const itemsCount = Number(sale.itemsCount ?? 1);
                totals.totalSales += selling;
                totals.totalProfit += selling - buying;
                totals.totalItems += itemsCount;
                const method = normalizeMethod(sale.paymentMethod);
                if (method === "CASH") {
                    totals.paymentStats.totalSalesCash += selling;
                }
                else {
                    totals.paymentStats.totalSalesMpesa += selling;
                }
                const receiptKey = sale.receiptNumber && sale.receiptNumber.trim().length > 0
                    ? `${sale.receiptNumber.trim()}|${method}`
                    : `${entry.id}-${index}|${method}`;
                if (!receiptTracker.has(receiptKey)) {
                    receiptTracker.add(receiptKey);
                    if (method === "CASH") {
                        totals.paymentStats.countCashReceipts += 1;
                    }
                    else {
                        totals.paymentStats.countMpesaReceipts += 1;
                    }
                }
            });
            totals.totalReceipts += receiptTracker.size || sales.length;
            return;
        }
        const fallbackSales = toNumber(entry.totalSales);
        totals.totalSales += fallbackSales;
        totals.totalProfit += toNumber(entry.totalProfit);
        totals.totalReceipts += 1;
    });
    reports.forEach((report) => {
        const tasks = isRecord(report.tasks) ? report.tasks : {};
        const metrics = isRecord(tasks.metrics) ? tasks.metrics : {};
        const totalsJson = isRecord(tasks.totals) ? tasks.totals : {};
        const profitFromMetrics = toNumber(metrics.totalProfit) || toNumber(metrics.profit) || toNumber(totalsJson.profit) || 0;
        const entryProfit = profitFromMetrics > 0 ? profitFromMetrics : toNumber(report.totalSales);
        const receiptsFromMetrics = Math.max(0, Math.floor(toNumber(totalsJson.receipts)));
        const derivedReceipts = deriveReceiptsFromSales(report.sales);
        const receiptCount = receiptsFromMetrics > 0 ? receiptsFromMetrics : derivedReceipts;
        totals.totalSales += toNumber(report.totalSales);
        totals.totalProfit += entryProfit;
        totals.totalReceipts += receiptCount;
        totals.totalItems += report.sales.length;
        totals.totalNewProducts += report.newProducts ?? 0;
        totals.totalEditedProducts += report.productsEdited ?? 0;
        totals.totalCopiedProducts += report.copiesUploaded ?? 0;
        totals.walkInsServed += report.walkInServed ?? 0;
        totals.walkInsPurchased += report.purchasesMade ?? 0;
        const receiptTracker = new Set();
        report.sales.forEach((sale, index) => {
            const method = normalizeMethod(sale.paymentMethod);
            const price = toNumber(sale.price);
            if (method === "CASH") {
                totals.paymentStats.totalSalesCash += price;
            }
            else {
                totals.paymentStats.totalSalesMpesa += price;
            }
            const receiptKey = sale.receiptNumber && sale.receiptNumber.trim().length > 0
                ? `${sale.receiptNumber.trim()}|${method}`
                : `${report.id}-${index}|${method}`;
            if (!receiptTracker.has(receiptKey)) {
                receiptTracker.add(receiptKey);
                if (method === "CASH") {
                    totals.paymentStats.countCashReceipts += 1;
                }
                else {
                    totals.paymentStats.countMpesaReceipts += 1;
                }
            }
        });
    });
    return { totals, entryCount: marketingEntries.length + reports.length };
}
async function recomputeMarketingCommissionLedger(opts) {
    const { userId } = opts;
    const client = opts.client ?? prisma_1.prisma;
    const period = opts.period ?? (0, tradingPeriod_1.getTradingPeriodFor)(opts.date ?? new Date());
    const { totals } = await summarizeMarketingReportsForPeriod({ userId, period, client });
    const commissionInfo = (0, marketingCommission_1.getCommissionSummaryForSales)(totals.totalSales);
    const baseCommission = commissionInfo.commission ?? 0;
    const fallbackCommission = baseCommission === 0 && totals.totalSales > 0 && totals.totalSales < 500000
        ? Math.round(Math.max(totals.totalProfit, 0) * 0.05)
        : 0;
    const marketingCommission = baseCommission > 0 ? baseCommission : fallbackCommission;
    if (marketingCommission === 0 && totals.totalSales === 0) {
        return { updated: false, commission: 0, totals, period, ledgerId: null };
    }
    const existingLedger = await client.commissionLedger.findUnique({
        where: {
            userId_periodStart_periodEnd: {
                userId,
                periodStart: period.start,
                periodEnd: period.end,
            },
        },
    });
    const detailValue = existingLedger?.detail;
    const existingDetail = isRecord(detailValue) ? { ...detailValue } : {};
    const previousMarketing = isRecord(existingDetail.marketing) ? existingDetail.marketing : null;
    const previousMarketingCommission = toNumber(previousMarketing?.commission);
    const grossBeforeMarketing = Math.max(0, toNumber(existingLedger?.grossCommission) - previousMarketingCommission);
    const grossCommission = grossBeforeMarketing + marketingCommission;
    const penalties = toNumber(existingLedger?.penalties);
    const netCommission = grossCommission - penalties;
    const nextDetail = {
        ...existingDetail,
        marketing: {
            periodKey: period.key,
            totals,
            commission: marketingCommission,
            computedAt: new Date().toISOString(),
        },
    };
    const ledger = await client.commissionLedger.upsert({
        where: {
            userId_periodStart_periodEnd: {
                userId,
                periodStart: period.start,
                periodEnd: period.end,
            },
        },
        update: {
            grossCommission: grossCommission.toFixed(2),
            netCommission: netCommission.toFixed(2),
            detail: nextDetail,
        },
        create: {
            userId,
            periodStart: period.start,
            periodEnd: period.end,
            grossCommission: grossCommission.toFixed(2),
            netCommission: netCommission.toFixed(2),
            detail: nextDetail,
        },
    });
    return {
        updated: true,
        commission: marketingCommission,
        totals,
        period,
        ledgerId: ledger.id,
    };
}
