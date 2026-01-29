"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateCumulativeCommission = exports.COMMISSION_LADDER = void 0;
exports.getOrCreateCommissionPeriod = getOrCreateCommissionPeriod;
exports.computeSalesCommissionFromTiers = computeSalesCommissionFromTiers;
exports.computeProductCommissions = computeProductCommissions;
exports.computeJenifferProratedCommission = computeJenifferProratedCommission;
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
function normalizeTiers(tiers) {
    return tiers
        .map((tier) => ({
        minSales: Number(tier.minSales),
        maxSales: tier.maxSales == null ? null : Number(tier.maxSales),
        payoutFlat: Number(tier.payoutFlat),
    }))
        .sort((a, b) => a.minSales - b.minSales);
}
function tiersAreEqual(a, b) {
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i += 1) {
        if (a[i].minSales !== b[i].minSales ||
            a[i].maxSales !== b[i].maxSales ||
            a[i].payoutFlat !== b[i].payoutFlat) {
            return false;
        }
    }
    return true;
}
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
        orderBy: { minSales: "asc" },
    });
    const normalizedExisting = normalizeTiers(existingTiers);
    const normalizedDefaults = normalizeTiers(DEFAULT_TIERS);
    let tiers = existingTiers;
    if (normalizedExisting.length === 0 ||
        !tiersAreEqual(normalizedExisting, normalizedDefaults)) {
        await prisma_1.prisma.commissionTier.deleteMany({ where: { periodId: period.id } });
        await prisma_1.prisma.commissionTier.createMany({
            data: DEFAULT_TIERS.map((tier) => ({
                periodId: period.id,
                minSales: tier.minSales,
                maxSales: tier.maxSales,
                payoutFlat: tier.payoutFlat,
            })),
        });
        tiers = await prisma_1.prisma.commissionTier.findMany({
            where: { periodId: period.id },
            orderBy: { minSales: "asc" },
        });
    }
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
    const baseSalesCap = firstTierMin;
    const profitWithinFirstBand = totalSales > 0 ? (Math.min(totalSales, baseSalesCap) / totalSales) * totalProfit : 0;
    const baseCommission = fallbackPercent && fallbackPercent > 0 ? fallbackPercent * profitWithinFirstBand : 0;
    let commission = baseCommission;
    if (totalSales <= firstTierMin) {
        return commission;
    }
    // We treat each tier as a band. For band i we consider the range from
    // bandStart (previous band end or this tier.min for the first) up to bandEnd.
    // Within a band, payout is proportional to progress through that band.
    let previousMaxSales = sorted[0].minSales;
    for (let i = 0; i < sorted.length; i++) {
        const tier = sorted[i];
        const bandStart = Math.max(tier.minSales, previousMaxSales);
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
// Special Jeniffer prorated commission: keep full payouts for completed tiers
// and prorate the next tier payout based on progress within the band.
function computeJenifferProratedCommission(totalSales, tiers) {
    if (!tiers || tiers.length === 0)
        return { commission: 0, baseCommission: 0, prorated: 0, nextTarget: null, progressPercent: 0 };
    const sorted = [...tiers].sort((a, b) => a.minSales - b.minSales);
    let nextIdx = sorted.findIndex((t) => t.minSales > totalSales);
    if (nextIdx === -1) {
        const total = sorted.reduce((s, t) => s + t.payoutFlat, 0);
        return { commission: total, baseCommission: total, prorated: 0, nextTarget: null, progressPercent: 1 };
    }
    let baseCommission = 0;
    for (let i = 0; i < nextIdx; i++)
        baseCommission += sorted[i].payoutFlat;
    if (nextIdx === 0)
        return { commission: baseCommission, baseCommission, prorated: 0, nextTarget: sorted[0].minSales, progressPercent: totalSales / sorted[0].minSales };
    const prev = sorted[nextIdx - 1];
    const next = sorted[nextIdx];
    const bandWidth = Math.max(1, next.minSales - prev.minSales);
    const progressInBand = Math.max(0, Math.min(1, (totalSales - prev.minSales) / bandWidth));
    const prorated = next.payoutFlat * progressInBand;
    const commission = baseCommission + prorated;
    return { commission, baseCommission, prorated, nextTarget: next.minSales, progressPercent: progressInBand };
}
