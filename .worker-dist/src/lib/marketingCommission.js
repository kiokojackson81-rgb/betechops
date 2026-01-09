"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCommissionSummaryForSales = getCommissionSummaryForSales;
const commissionCommon_1 = require("./commissionCommon");
// Wrapper that exposes the commission logic used across admin + tracker.
// It delegates to the existing `calculateCumulativeCommission` implementation
// to ensure the math stays identical.
function getCommissionSummaryForSales(totalSales) {
    const info = (0, commissionCommon_1.calculateCumulativeCommission)(totalSales);
    return {
        commission: info.commission,
        currentSales: totalSales,
        nextTarget: info.nextTarget ?? null,
        tiersReached: info.tiersReached ?? [],
        nextTierReward: info.nextTierReward ?? null,
    };
}
