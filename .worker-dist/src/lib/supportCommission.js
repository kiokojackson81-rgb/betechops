"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeSupportEntriesForPeriod = summarizeSupportEntriesForPeriod;
exports.recomputeSupportCommissionLedger = recomputeSupportCommissionLedger;
const prisma_1 = require("@/lib/prisma");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const marketingCommission_1 = require("@/lib/marketingCommission");
const emptyTotals = {
    totalSales: 0,
    totalProfit: 0,
    totalReceipts: 0,
    totalItems: 0,
    newBatteries: 0,
    changedBatteries: 0,
};
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
async function summarizeSupportEntriesForPeriod(opts) {
    const { userId, period } = opts;
    const client = opts.client ?? prisma_1.prisma;
    const entries = await client.supportDailyEntry.findMany({
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
    if (entries.length === 0) {
        return { totals: { ...emptyTotals }, hasEntries: false };
    }
    const totals = entries.reduce((acc, entry) => {
        acc.totalSales += entry.totalSales;
        acc.totalProfit += entry.totalProfit;
        acc.newBatteries += entry.newBatteries;
        acc.changedBatteries += entry.changedBatteries;
        acc.totalReceipts += entry.receipts.length;
        acc.totalItems += entry.receipts.reduce((sum, receipt) => sum + (receipt._count?.items ?? 0), 0);
        return acc;
    }, { ...emptyTotals });
    return { totals, hasEntries: true };
}
async function recomputeSupportCommissionLedger(opts) {
    const { userId, dryRun } = opts;
    const client = opts.client ?? prisma_1.prisma;
    const period = opts.period ?? (0, tradingPeriod_1.getTradingPeriodFor)(new Date());
    const { totals, hasEntries } = await summarizeSupportEntriesForPeriod({ userId, period, client });
    if (!hasEntries) {
        return {
            updated: false,
            supportCommission: 0,
            totals,
            period,
            ledgerId: null,
        };
    }
    const fallbackCommission = Math.max(0, Math.round(totals.totalProfit * 0.05));
    const tierInfo = (0, marketingCommission_1.getCommissionSummaryForSales)(totals.totalSales ?? 0);
    const tierCommission = tierInfo.commission ?? 0;
    const supportCommission = fallbackCommission + tierCommission;
    if (dryRun) {
        return {
            updated: false,
            supportCommission,
            totals,
            period,
            ledgerId: null,
        };
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
    const existingDetail = isRecord(detailValue)
        ? { ...detailValue }
        : {};
    const previousSupport = isRecord(existingDetail.support) ? existingDetail.support : null;
    const previousSupportCommission = typeof previousSupport?.commission === "number"
        ? previousSupport.commission
        : Number(existingDetail.supportCommission ?? 0);
    const baseGross = Math.max(0, Number(existingLedger?.grossCommission ?? 0) - Number(previousSupportCommission ?? 0));
    const grossCommission = baseGross + supportCommission;
    const penalties = Number(existingLedger?.penalties ?? 0);
    const netCommission = grossCommission - penalties;
    const nextDetail = {
        ...existingDetail,
        support: {
            periodKey: period.key,
            totals,
            commission: supportCommission,
            fallbackCommission,
            tierCommission,
            computedAt: new Date().toISOString(),
        },
        supportCommission,
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
            grossCommission: grossCommission.toString(),
            netCommission: netCommission.toString(),
            detail: nextDetail,
        },
        create: {
            userId,
            periodStart: period.start,
            periodEnd: period.end,
            grossCommission: grossCommission.toString(),
            netCommission: netCommission.toString(),
            detail: nextDetail,
        },
    });
    return {
        updated: true,
        supportCommission,
        totals,
        period,
        ledgerId: ledger.id,
    };
}
