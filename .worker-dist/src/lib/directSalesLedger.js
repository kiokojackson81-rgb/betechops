"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recomputeDirectSalesLedger = recomputeDirectSalesLedger;
const prisma_1 = require("@/lib/prisma");
const posReceiptSummary_1 = require("@/lib/posReceiptSummary");
const commission_1 = require("@/lib/commission");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
async function recomputeDirectSalesLedger(opts) {
    const client = opts.client ?? prisma_1.prisma;
    const period = opts.period ?? (0, tradingPeriod_1.getTradingPeriodFor)(opts.date ?? new Date());
    if (!period)
        throw new Error("No trading period for given date");
    const { tiers } = await (0, commission_1.getOrCreateCommissionPeriod)(period.start);
    const totals = await (0, posReceiptSummary_1.summarizePosReceiptsForPeriod)(period);
    const totalSales = totals.totalSales ?? 0;
    const totalProfit = totals.totalProfit ?? 0;
    // Jeniffer rule: fallbackPercent = 0 (no commission below first tier)
    const directSalesCommission = (0, commission_1.computeSalesCommissionFromTiers)(totalSales, totalProfit, tiers, 0);
    // Merge with existing ledger without clobbering other sections
    const existingLedger = await client.commissionLedger.findUnique({
        where: {
            userId_periodStart_periodEnd: {
                userId: opts.userId,
                periodStart: period.start,
                periodEnd: period.end,
            },
        },
    });
    const existingDetail = typeof existingLedger?.detail === "object" && existingLedger?.detail ? { ...existingLedger.detail } : {};
    const previousDirect = typeof existingDetail.directSales === "object" ? existingDetail.directSales : null;
    const previousDirectCommission = previousDirect?.commission ?? 0;
    const grossBefore = Math.max(0, Number(existingLedger?.grossCommission ?? 0) - Number(previousDirectCommission ?? 0));
    const grossCommission = grossBefore + directSalesCommission;
    const penalties = Number(existingLedger?.penalties ?? 0);
    const netCommission = grossCommission - penalties;
    const nextDetail = {
        ...existingDetail,
        directSales: {
            periodKey: `${period.start.toISOString()}_${period.end.toISOString()}`,
            totals,
            commission: directSalesCommission,
            computedAt: new Date().toISOString(),
        },
    };
    // Best-effort: remove overlapping ledgers that reference same periodKey but different start/end
    try {
        await client.$executeRaw `
      DELETE FROM "CommissionLedger"
      WHERE "userId" = ${opts.userId}
        AND (detail->'directSales'->>'periodKey') = ${nextDetail.directSales.periodKey}
        AND NOT ("periodStart" = ${period.start} AND "periodEnd" = ${period.end})
    `;
    }
    catch (_e) {
        // ignore
    }
    const ledger = await client.commissionLedger.upsert({
        where: {
            userId_periodStart_periodEnd: {
                userId: opts.userId,
                periodStart: period.start,
                periodEnd: period.end,
            },
        },
        update: {
            grossCommission: grossCommission.toFixed(2),
            netCommission: netCommission.toFixed(2),
            commissionTotal: (Number(existingLedger?.commissionTotal ?? 0) - Number(previousDirectCommission ?? 0) + directSalesCommission).toFixed(2),
            detail: nextDetail,
        },
        create: {
            userId: opts.userId,
            periodStart: period.start,
            periodEnd: period.end,
            grossCommission: grossCommission.toFixed(2),
            netCommission: netCommission.toFixed(2),
            commissionTotal: directSalesCommission.toFixed(2),
            detail: nextDetail,
        },
    });
    return { ledgerId: ledger.id, commission: directSalesCommission, totals, period };
}
