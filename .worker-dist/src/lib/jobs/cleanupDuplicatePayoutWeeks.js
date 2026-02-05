"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupDuplicatePayoutWeeks = cleanupDuplicatePayoutWeeks;
const prisma_1 = require("@/lib/prisma");
const weekWindow_1 = require("@/lib/weekWindow");
async function cleanupDuplicatePayoutWeeks() {
    const rows = await prisma_1.prisma.marketplacePayoutWeek.findMany({
        select: {
            id: true,
            accountId: true,
            statementNumber: true,
            weekStart: true,
            weekEnd: true,
            rawPayload: true,
            updatedAt: true,
            createdAt: true,
            currency: true,
            payoutAmount: true,
            grossSales: true,
            isPaid: true,
        },
        orderBy: [{ accountId: "asc" }, { weekStart: "asc" }],
    });
    const grouped = new Map();
    for (const row of rows) {
        const canonicalStart = (0, weekWindow_1.canonicalNairobiWeekStartUtc)(new Date(row.weekStart));
        const key = `${row.accountId}::${canonicalStart.toISOString()}`;
        if (!grouped.has(key)) {
            grouped.set(key, { accountId: row.accountId, weekStart: canonicalStart, rows: [] });
        }
        grouped.get(key).rows.push(row);
    }
    const cleanupDetails = [];
    let totalRemoved = 0;
    for (const { accountId, weekStart, rows: duplicates } of grouped.values()) {
        if (duplicates.length <= 1)
            continue;
        const keeper = chooseKeeperRow(duplicates, weekStart);
        const toRemove = duplicates.filter((r) => r.id !== keeper.id).map((r) => r.id);
        if (toRemove.length === 0)
            continue;
        await prisma_1.prisma.marketplacePayoutWeek.deleteMany({ where: { id: { in: toRemove } } });
        cleanupDetails.push({ accountId, weekStart: weekStart.toISOString(), removed: toRemove.length });
        totalRemoved += toRemove.length;
    }
    return { removed: totalRemoved, details: cleanupDetails };
}
function chooseKeeperRow(rows, canonicalWeekStart) {
    let best = null;
    for (const row of rows) {
        const rowStart = (0, weekWindow_1.canonicalNairobiWeekStartUtc)(new Date(row.weekStart));
        const diff = Math.abs(rowStart.getTime() - canonicalWeekStart.getTime());
        const payload = row.rawPayload;
        const periodStart = (0, weekWindow_1.parseDateOnlyUtc)(payload?.period?.startDate ?? null);
        const periodMatches = periodStart ? (0, weekWindow_1.canonicalNairobiWeekStartUtc)(periodStart).getTime() === canonicalWeekStart.getTime() : false;
        const normalizedNumber = String(row.statementNumber ?? "").toUpperCase();
        const hasSuffix = /(OPEN|PAID|UNPAID)$/.test(normalizedNumber);
        const updatedScore = (row.updatedAt?.getTime() ?? 0) / 1000000;
        const score = (periodMatches ? 100 : 0) - diff + (hasSuffix ? 10 : 0) + updatedScore;
        if (!best || score > best.score) {
            best = { row, score };
        }
    }
    return best?.row ?? rows[0];
}
