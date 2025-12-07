"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateCumulativeCommission = exports.COMMISSION_LADDER = void 0;
exports.getOrCreateCommissionPeriod = getOrCreateCommissionPeriod;
exports.computeSalesCommissionFromTiers = computeSalesCommissionFromTiers;
exports.computeProductCommissions = computeProductCommissions;
const prisma_1 = require("@/lib/prisma");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const commissionCommon_1 = require("./commissionCommon");
Object.defineProperty(exports, "COMMISSION_LADDER", { enumerable: true, get: function () { return commissionCommon_1.COMMISSION_LADDER; } });
Object.defineProperty(exports, "calculateCumulativeCommission", { enumerable: true, get: function () { return commissionCommon_1.calculateCumulativeCommission; } });
const DEFAULT_TIERS = [
    { minSales: 500000, maxSales: 1000000, payoutFlat: 10000 },
    { minSales: 2000000, maxSales: 2000000, payoutFlat: 15000 },
    { minSales: 3000000, maxSales: 3000000, payoutFlat: 20000 },
    { minSales: 4000000, maxSales: 4000000, payoutFlat: 20000 },
    { minSales: 5000000, maxSales: 5000000, payoutFlat: 20000 },
    { minSales: 6000000, maxSales: 6000000, payoutFlat: 20000 },
    { minSales: 7000000, maxSales: 7000000, payoutFlat: 20000 },
    { minSales: 8000000, maxSales: 8000000, payoutFlat: 20000 },
    { minSales: 9000000, maxSales: 9000000, payoutFlat: 20000 },
    { minSales: 10000000, maxSales: 10000000, payoutFlat: 20000 },
];
async function getOrCreateCommissionPeriod(date) {
    const tradingPeriod = (0, tradingPeriod_1.getTradingPeriodFor)(date);
    if (!tradingPeriod)
        throw new Error("No trading period for given date");
    const { key: periodKey, label: periodLabel, start, end } = tradingPeriod;
    let period = await prisma_1.prisma.commissionPeriod.findFirst({
        where: {
            startDate: start,
            endDate: end,
        },
    });
    if (!period) {
        period = await prisma_1.prisma.commissionPeriod.create({
            data: {
                name: periodLabel,
                startDate: start,
                endDate: end,
            },
        });
    }
    const existingTiers = await prisma_1.prisma.commissionTier.findMany({
        where: { periodId: period.id },
    });
    if (existingTiers.length === 0) {
        await prisma_1.prisma.commissionTier.createMany({
            data: DEFAULT_TIERS.map((tier) => ({
                periodId: period.id,
                minSales: tier.minSales,
                maxSales: tier.maxSales,
                payoutFlat: tier.payoutFlat,
            })),
        });
    }
    const tiers = await prisma_1.prisma.commissionTier.findMany({
        where: { periodId: period.id },
        orderBy: { minSales: "asc" },
    });
    return {
        period,
        tiers,
        tradingPeriod: {
            key: periodKey,
            label: periodLabel,
            startDate: start,
            endDate: end,
        },
    };
}
function computeSalesCommissionFromTiers(totalSales, totalProfit, tiers, 
// optional: percentage fallback to apply when sales are below first tier.
// If `undefined` or 0 the fallback is disabled (returns 0 until a tier is reached).
fallbackPercent = 0.05) {
    // If no tiers provided, fall back to the profit-percentage behavior.
    if (!tiers || tiers.length === 0) {
        if (!fallbackPercent || fallbackPercent <= 0)
            return 0;
        return fallbackPercent * totalProfit;
    }
    // Make a safe sorted copy of tiers by minSales.
    const sorted = [...tiers].sort((a, b) => a.minSales - b.minSales);
    const firstTierMin = sorted[0].minSales;
    if (totalSales < firstTierMin) {
        if (!fallbackPercent || fallbackPercent <= 0)
            return 0;
        return fallbackPercent * totalProfit;
    }
    let commission = 0;
    // We treat each tier as a band. For band i we consider the range from
    // bandStart (previous band end or this tier.min for the first) up to bandEnd.
    // Within a band, payout is proportional to progress through that band.
    let previousMaxSales = sorted[0].minSales;
    for (let i = 0; i < sorted.length; i++) {
        const tier = sorted[i];
        const bandStart = i === 0 ? tier.minSales : previousMaxSales;
        const bandEnd = tier.maxSales ?? tier.minSales;
        const bandWidth = Math.max(0, bandEnd - bandStart);
        if (bandWidth <= 0) {
            // Degenerate band — treat as a step. If we've reached it, award full payout.
            if (totalSales >= bandEnd) {
                commission += tier.payoutFlat;
                previousMaxSales = bandEnd;
                continue;
            }
            else {
                break;
            }
        }
        if (totalSales >= bandEnd) {
            // Completed this band fully → full payout
            commission += tier.payoutFlat;
        }
        else if (totalSales > bandStart) {
            // Inside this band → prorate based on progress and stop.
            const progress = (totalSales - bandStart) / bandWidth; // 0..1
            commission += tier.payoutFlat * progress;
            return commission;
        }
        else {
            // Haven't started this band yet.
            break;
        }
        previousMaxSales = bandEnd;
    }
    return commission;
}
function computeProductCommissions(args) {
    const { newProducts, copiedProducts, editedProducts } = args;
    const eligibleNew = Math.max(0, newProducts - 2000);
    const newProductCommission = Math.min(eligibleNew * 3, 10000);
    const copiedCommission = Math.floor(copiedProducts / 5);
    const editedCommission = Math.floor(editedProducts / 10);
    return { newProductCommission, copiedCommission, editedCommission };
}
