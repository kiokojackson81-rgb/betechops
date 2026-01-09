"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeSupportEntriesForPeriod = summarizeSupportEntriesForPeriod;
exports.recomputeSupportCommissionLedger = recomputeSupportCommissionLedger;
const prisma_1 = require("@/lib/prisma");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const marketingCommission_1 = require("@/lib/marketingCommission");
const marketingPeriodTotals_1 = require("./marketingPeriodTotals");
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
    // Include receipts and sales so we can validate that aggregated totals are backed
    // by explicit sales/receipts. Ignore rows that have totals but no backing details.
    const entries = await client.supportDailyEntry.findMany({
        where: {
            submittedById: userId,
            date: {
                gte: period.start,
                lte: period.end,
            },
        },
        include: {
            receipts: true,
            sales: true,
            // keep basic totals
            // Prisma will still provide totalSales/totalProfit on the root
        },
    });
    if (entries.length === 0) {
        return { totals: { ...emptyTotals }, hasEntries: false };
    }
    // Only count entries that have explicit backing: either `receipts` or `sales` rows.
    const backed = entries.filter((e) => (Array.isArray(e.receipts) && e.receipts.length > 0) || (Array.isArray(e.sales) && e.sales.length > 0));
    if (backed.length === 0) {
        // No backed entries in the period — treat as no entries to avoid awarding commission
        return { totals: { ...emptyTotals }, hasEntries: false };
    }
    const totals = backed.reduce((acc, entry) => {
        acc.totalSales += Number(entry.totalSales ?? 0);
        acc.totalProfit += Number(entry.totalProfit ?? 0);
        acc.newBatteries += Number(entry.newBatteries ?? 0);
        acc.changedBatteries += Number(entry.changedBatteries ?? 0);
        acc.totalReceipts += Array.isArray(entry.receipts) ? entry.receipts.length : 0;
        acc.totalItems += Array.isArray(entry.receipts) ? entry.receipts.reduce((sum, receipt) => sum + (Array.isArray(receipt.items) ? receipt.items.length : 0), 0) : 0;
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
    // Guard: if support-reported profit is implausibly larger than marketing
    // profit for the same period, skip creating/upserting a support-derived
    // ledger. This prevents support fallback ledgers (often from manual
    // entries) from overriding authoritative marketing-based ledgers.
    try {
        const marketingSummary = await (0, marketingPeriodTotals_1.summarizeMarketingReportsForPeriod)({ userId, period });
        const marketingProfit = Number(marketingSummary?.totals?.totalProfit ?? 0);
        // If marketing has non-zero profit and support profit is > 2x marketing profit,
        // consider it implausible and abort ledger creation.
        if (marketingProfit > 0 && totals.totalProfit > marketingProfit * 2) {
            return {
                updated: false,
                supportCommission: 0,
                totals,
                period,
                ledgerId: null,
            };
        }
    }
    catch (err) {
        // If the marketing summary check fails for any reason, continue with existing flow.
    }
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
    // If an existing ledger already contains a marketing-derived commission,
    // do not allow support recompute to overwrite it. This avoids support
    // fallbacks creating larger commissions that conflict with marketing data.
    const existingMarketingCommission = isRecord(existingDetail.marketing)
        ? Number(existingDetail.marketing?.commission ?? 0)
        : 0;
    if (existingMarketingCommission > 0) {
        return {
            updated: false,
            supportCommission: 0,
            totals,
            period,
            ledgerId: existingLedger?.id ?? null,
        };
    }
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
            commissionTotal: (Number(existingLedger?.commissionTotal ?? 0) - previousSupportCommission + supportCommission).toString(),
            detail: nextDetail,
        },
        create: {
            userId,
            periodStart: period.start,
            periodEnd: period.end,
            grossCommission: grossCommission.toString(),
            netCommission: netCommission.toString(),
            commissionTotal: supportCommission.toString(),
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
