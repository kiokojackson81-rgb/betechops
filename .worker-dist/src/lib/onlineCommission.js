"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.progressiveAmount = progressiveAmount;
exports.computeDirectCommission = computeDirectCommission;
exports.computeMarketplaceCommission = computeMarketplaceCommission;
exports.computeOnlinePeriodCommission = computeOnlinePeriodCommission;
const STEP_POINTS = [
    2000000,
    3000000,
    4000000,
    5000000,
    6000000,
    7000000,
    8000000,
    9000000,
    10000000,
];
const STEP_REWARDS = [15000, 20000, 20000, 20000, 20000, 20000, 20000, 20000, 20000];
const clamp01 = (value) => Math.max(0, Math.min(1, value));
function progressiveAmount(totalSales) {
    // Band 500k-1M produces up to KES 10k (prorated).
    if (totalSales <= 1000000) {
        const progress = (totalSales - 500000) / 500000;
        return Math.round(clamp01(progress) * 10000);
    }
    let commission = 10000;
    // Steps 2M..10M pay out the flat amount only once the threshold is reached.
    for (let i = 0; i < STEP_POINTS.length; i += 1) {
        const point = STEP_POINTS[i];
        const reward = STEP_REWARDS[i];
        if (totalSales >= point) {
            commission += reward;
            continue;
        }
        break;
    }
    return Math.round(commission);
}
function computeDirectCommission(totalSales, totalProfit) {
    if (totalSales <= 0) {
        return { amount: 0, mode: "none" };
    }
    if (totalSales < 500000) {
        const profit = Math.max(totalProfit ?? 0, 0);
        const amount = Math.round(profit * 0.05);
        return { amount, mode: amount > 0 ? "direct_fallback" : "none" };
    }
    const progressive = progressiveAmount(totalSales);
    // Apply 5% of profit only for the portion of sales within the first band
    // (up to KES 500,000). This ensures we don't double-count 5% on the
    // full profit when progressive payouts apply.
    const profitWithinFirstBand = totalSales > 0 ? (Math.min(totalSales, 500000) / totalSales) * Math.max(totalProfit ?? 0, 0) : 0;
    const profitPart = Math.round(profitWithinFirstBand * 0.05);
    const amount = progressive + profitPart;
    const reason = profitPart > 0 ? `progressive + 5% profit (first band ${profitPart})` : undefined;
    return { amount, mode: "direct_progressive", reason };
}
function computeMarketplaceCommission(totalSales, flags) {
    if (flags?.abandonedDuties || flags?.grossMisconduct || flags?.resignedOrTerminated) {
        return { amount: 0, mode: "withheld", reason: "Withheld per memo policy." };
    }
    if (totalSales < 500000) {
        return { amount: 0, mode: "none" };
    }
    return { amount: progressiveAmount(totalSales), mode: "marketplace_progressive" };
}
function computeOnlinePeriodCommission(inputs) {
    const direct = computeDirectCommission(inputs.directSales, inputs.directProfit);
    const jumia = computeMarketplaceCommission(inputs.jumiaSales, {
        abandonedDuties: inputs.abandonedDuties,
        grossMisconduct: inputs.grossMisconduct,
        resignedOrTerminated: inputs.resignedOrTerminated,
    });
    const kilimall = computeMarketplaceCommission(inputs.kilimallSales, {
        abandonedDuties: inputs.abandonedDuties,
        grossMisconduct: inputs.grossMisconduct,
        resignedOrTerminated: inputs.resignedOrTerminated,
    });
    const lines = [
        {
            channel: "DIRECT",
            sales: inputs.directSales,
            profit: inputs.directProfit,
            commission: direct.amount,
            mode: direct.mode,
            reason: direct.reason,
        },
        {
            channel: "JUMIA",
            sales: inputs.jumiaSales,
            commission: jumia.amount,
            mode: jumia.mode,
            reason: jumia.reason,
        },
        {
            channel: "KILIMALL",
            sales: inputs.kilimallSales,
            commission: kilimall.amount,
            mode: kilimall.mode,
            reason: kilimall.reason,
        },
    ];
    const totalCommission = Math.round(lines.reduce((acc, line) => acc + (line.commission || 0), 0));
    return { lines, totalCommission };
}
