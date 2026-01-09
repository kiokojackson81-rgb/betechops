"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recomputeWeeklySummary = recomputeWeeklySummary;
exports.uniqueAccountCountForWindow = uniqueAccountCountForWindow;
const prisma_1 = require("../prisma");
const payoutDeduper_1 = require("@/lib/payoutDeduper");
// Helper: interpret a UTC timestamp as Nairobi local time and return the
// canonical UTC Monday midnight for that Nairobi-local week. This matches
// the canonicalization used during ingestion (getJumiaWeeklyPeriodFor).
function canonicalNairobiWeekStartUtc(dateUtc) {
    const NAIR0BI_OFFSET_HOURS = 3;
    const nairobiMs = dateUtc.getTime() + NAIR0BI_OFFSET_HOURS * 3600 * 1000;
    const nairobi = new Date(nairobiMs);
    const y = nairobi.getUTCFullYear();
    const m = nairobi.getUTCMonth();
    const d = nairobi.getUTCDate();
    const nairobiMidnightUtcMs = Date.UTC(y, m, d, 0, 0, 0) - NAIR0BI_OFFSET_HOURS * 3600 * 1000;
    const nairobiLocalMidnight = new Date(nairobiMidnightUtcMs + NAIR0BI_OFFSET_HOURS * 3600 * 1000);
    const day = nairobiLocalMidnight.getUTCDay();
    const deltaToMonday = (day + 6) % 7;
    const mondayUtcMs = nairobiMidnightUtcMs - deltaToMonday * 24 * 3600 * 1000;
    return new Date(mondayUtcMs);
}
async function recomputeWeeklySummary(weekStart, weekEnd) {
    // Fetch rows overlapping the requested window
    const rows = await prisma_1.prisma.marketplacePayoutWeek.findMany({
        where: { AND: [{ weekStart: { lte: weekEnd } }, { weekEnd: { gte: weekStart } }] },
    });
    // Aggregate by accountId + canonical Nairobi weekStart
    // Use authoritative single-row selection per account/week (do NOT sum duplicates).
    const grouped = new Map();
    for (const r of rows) {
        const canonicalStart = canonicalNairobiWeekStartUtc(new Date(r.weekStart));
        const key = `${r.accountId}::${canonicalStart.toISOString()}`;
        if (!grouped.has(key))
            grouped.set(key, []);
        grouped.get(key).push(r);
    }
    const map = new Map();
    for (const [key, items] of grouped.entries()) {
        const [accountId, startIso] = key.split('::');
        const canonicalStart = new Date(startIso);
        const canonicalEnd = new Date(canonicalStart.getTime() + 7 * 24 * 3600 * 1000 - 1);
        // build candidates from DB rows
        const candidates = items.map((r) => ({ id: r.id, statementNumber: r.statementNumber ?? null, amount: Number(r.payoutAmount ?? r.grossSales ?? 0), createdAt: r.createdAt ? new Date(r.createdAt) : new Date(0), rawPayload: r.rawPayload, isPaid: r.isPaid ?? false }));
        const keeper = (0, payoutDeduper_1.chooseAuthoritativeCandidate)(candidates);
        map.set(key, { accountId, weekStart: canonicalStart, weekEnd: canonicalEnd, totalPayout: keeper.amount, totalGross: keeper.amount });
    }
    return Array.from(map.values());
}
async function uniqueAccountCountForWindow(weekStart, weekEnd) {
    const aggs = await recomputeWeeklySummary(weekStart, weekEnd);
    const unique = new Set(aggs.map((a) => a.accountId));
    return unique.size;
}
exports.default = recomputeWeeklySummary;
