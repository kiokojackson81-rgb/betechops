"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const auth_1 = require("@/lib/auth");
const prisma_1 = require("@/lib/prisma");
const weekWindow_1 = require("@/lib/weekWindow");
const payoutDeduper_1 = require("@/lib/payoutDeduper");
exports.dynamic = "force-dynamic";
async function GET(req) {
    const auth = await (0, auth_1.requireAttendant)(req, ["ADMIN", "SUPERVISOR"]);
    if (!auth.ok)
        return auth.res;
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - 90);
    const recentPayouts = await prisma_1.prisma.marketplacePayoutWeek.findMany({
        where: { account: { platform: "JUMIA" }, weekEnd: { gte: lookbackDate } },
        select: {
            accountId: true,
            weekStart: true,
            weekEnd: true,
            statementNumber: true,
            rawPayload: true,
            grossSales: true,
            payoutAmount: true,
            isPaid: true,
            createdAt: true,
            updatedAt: true,
            id: true,
        },
    });
    const weekBucket = new Map();
    for (const row of recentPayouts) {
        const { weekStart: canonicalStart, weekEnd: canonicalEnd } = (0, weekWindow_1.mondayToSundayNairobiWindow)(new Date(row.weekStart));
        const key = canonicalStart.toISOString();
        if (!weekBucket.has(key)) {
            weekBucket.set(key, { weekStart: canonicalStart, weekEnd: canonicalEnd, accounts: new Map() });
        }
        const entry = weekBucket.get(key);
        const bucket = entry.accounts.get(row.accountId) ?? [];
        bucket.push(row);
        entry.accounts.set(row.accountId, bucket);
    }
    const allAccounts = await prisma_1.prisma.marketplaceAccount.findMany({ where: { platform: "JUMIA", isActive: true }, select: { id: true } });
    const totalActiveAccounts = allAccounts.length;
    const enrichedWeeks = Array.from(weekBucket.values()).map((entry) => {
        const bestRows = Array.from(entry.accounts.values())
            .map((rows) => {
            const nonPlaceholder = rows.filter((row) => !(row.rawPayload?.placeholder === true));
            const candidates = nonPlaceholder.length ? nonPlaceholder : rows;
            return (0, payoutDeduper_1.chooseAuthoritativeCandidate)(candidates, entry.weekStart);
        })
            .filter(Boolean);
        const realRows = bestRows.filter((row) => !(row.rawPayload?.placeholder === true));
        const placeholderRows = bestRows.filter((row) => row.rawPayload?.placeholder === true);
        const present = realRows.length;
        const missing = Math.max(totalActiveAccounts - present, 0);
        const gross = bestRows.reduce((sum, row) => sum + Number(row?.grossSales ?? 0), 0);
        const totalRealPayout = realRows.reduce((sum, row) => sum + Number(row?.payoutAmount ?? row?.grossSales ?? 0), 0);
        const totalPlaceholderPayout = placeholderRows.reduce((sum, row) => sum + Number(row?.payoutAmount ?? row?.grossSales ?? 0), 0);
        const displayPayout = totalRealPayout > 0 ? totalRealPayout : totalPlaceholderPayout;
        const displayEnd = new Date(entry.weekEnd.getTime() - 3 * 60 * 60 * 1000);
        return {
            period: { start: entry.weekStart.toISOString(), end: entry.weekEnd.toISOString() },
            _sum: { grossSales: gross, payoutAmount: displayPayout },
            accountCount: present,
            missingCount: missing,
            label: `${(0, weekWindow_1.formatNairobiDate)(entry.weekStart)} – ${(0, weekWindow_1.formatNairobiDate)(displayEnd)}`,
            realRowCount: realRows.length,
            placeholderRowCount: placeholderRows.length,
            totalRealPayout,
            totalPlaceholderPayout,
            displayPayout,
        };
    });
    const sortedWeeks = enrichedWeeks.sort((a, b) => (a.period.start < b.period.start ? 1 : -1));
    return server_1.NextResponse.json({ weeks: sortedWeeks.slice(0, 8), totalActiveAccounts });
}
