"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTradingPeriodFor = getTradingPeriodFor;
exports.getRecentTradingPeriods = getRecentTradingPeriods;
const formatLabel = (date) => date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
});
function getTradingPeriodFor(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const year = d.getFullYear();
    const month = d.getMonth(); // 0-indexed
    const day = d.getDate();
    let startYear;
    let startMonth;
    let endYear;
    let endMonth;
    if (day >= 25) {
        startYear = year;
        startMonth = month;
        // next month
        const next = new Date(year, month + 1, 1);
        endYear = next.getFullYear();
        endMonth = next.getMonth();
    }
    else {
        // current period started last month
        const prev = new Date(year, month - 1, 1);
        startYear = prev.getFullYear();
        startMonth = prev.getMonth();
        endYear = year;
        endMonth = month;
    }
    const start = new Date(startYear, startMonth, 25, 0, 0, 0, 0);
    const end = new Date(endYear, endMonth, 24, 23, 59, 59, 999);
    const label = `${formatLabel(start)} – ${formatLabel(end)}`;
    const key = `${start.toISOString().split("T")[0]}_${end.toISOString().split("T")[0]}`;
    return { start, end, label, key };
}
function getRecentTradingPeriods(n) {
    const periods = [];
    let cursor = getTradingPeriodFor(new Date());
    for (let i = 0; i < n; i++) {
        periods.push(cursor);
        const prevEnd = new Date(cursor.start.getTime() - 24 * 60 * 60 * 1000);
        cursor = getTradingPeriodFor(prevEnd);
    }
    return periods;
}
