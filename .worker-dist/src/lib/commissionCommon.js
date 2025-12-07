"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMMISSION_LADDER = void 0;
exports.calculateCumulativeCommission = calculateCumulativeCommission;
exports.COMMISSION_LADDER = [
    { min: 1000000, reward: 10000 },
    { min: 2000000, reward: 15000 },
    { min: 3000000, reward: 20000 },
    { min: 4000000, reward: 20000 },
    { min: 5000000, reward: 20000 },
    { min: 6000000, reward: 20000 },
    { min: 7000000, reward: 20000 },
    { min: 8000000, reward: 20000 },
    { min: 9000000, reward: 20000 },
    { min: 10000000, reward: 20000 },
];
function calculateCumulativeCommission(totalSales) {
    const tiersReached = exports.COMMISSION_LADDER.filter((t) => t.min <= totalSales);
    const commission = tiersReached.reduce((sum, t) => sum + t.reward, 0);
    const nextTier = exports.COMMISSION_LADDER.find((t) => t.min > totalSales) || null;
    return {
        commission,
        tiersReached: tiersReached.map((t) => `${t.min}`),
        nextTarget: nextTier?.min ?? null,
        nextTierReward: nextTier?.reward ?? null,
    };
}
