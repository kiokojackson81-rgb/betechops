"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJumiaWeeklyPeriodFor = getJumiaWeeklyPeriodFor;
exports.getRecentJumiaWeeks = getRecentJumiaWeeks;
exports.getTradingPeriodFor = getTradingPeriodFor;
exports.getRecentTradingPeriods = getRecentTradingPeriods;
function getJumiaWeeklyPeriodFor(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    // getDay(): Sunday=0…Saturday=6. Jumia weeks start on Monday.
    const dayOfWeek = d.getDay();
    const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
    const start = new Date(d);
    start.setDate(d.getDate() + diffToMonday);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    function toLocalIso(dt) {
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, "0");
        const d = String(dt.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    }
    const label = `${toLocalIso(start)} – ${toLocalIso(end)}`;
    const key = `${toLocalIso(start)}_${toLocalIso(end)}`;
    return { start, end, label, key };
}
function getRecentJumiaWeeks(n) {
    const out = [];
    const today = new Date();
    for (let i = 0; i < n; i += 1) {
        const ref = new Date(today);
        ref.setDate(ref.getDate() - i * 7);
        out.push(getJumiaWeeklyPeriodFor(ref));
    }
    return out;
}
exports.default = getJumiaWeeklyPeriodFor;
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
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}_${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
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
