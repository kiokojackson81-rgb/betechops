"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const auth_1 = require("@/lib/auth");
const prisma_1 = require("@/lib/prisma");
const onlineOps_1 = require("@/lib/onlineOps");
const payoutDeduper_1 = require("@/lib/payoutDeduper");
exports.dynamic = "force-dynamic";
async function GET(req) {
    const auth = await (0, auth_1.requireAttendant)(req, ["JUMIA_KILIMALL_OPS", "BETECH_OPS", "SUPERVISOR", "ADMIN"]);
    if (!auth.ok)
        return auth.res;
    const { assignments } = await (0, onlineOps_1.getMarketplaceAssignmentsForUser)(auth.user.id);
    if (!assignments.length) {
        return server_1.NextResponse.json({ accounts: [] });
    }
    const weekStarts = [];
    const today = new Date();
    let cursor = (0, payoutDeduper_1.ensureCanonicalWeekStart)(today);
    for (let i = 0; i < 4; i += 1) {
        weekStarts.push(new Date(cursor));
        cursor = new Date(cursor.getTime() - 7 * 24 * 3600 * 1000);
    }
    const oldestStart = weekStarts[weekStarts.length - 1];
    const newestEndExclusive = new Date(weekStarts[0].getTime() + 7 * 24 * 3600 * 1000);
    const payload = await Promise.all(assignments.map(async (assignment) => {
        const rows = await prisma_1.prisma.marketplacePayoutWeek.findMany({
            where: {
                accountId: assignment.accountId,
                weekStart: { gte: oldestStart },
                weekEnd: { lte: newestEndExclusive },
            },
            orderBy: [{ weekStart: "desc" }, { createdAt: "desc" }],
        });
        const grouped = new Map();
        for (const row of rows) {
            const canonicalStart = (0, payoutDeduper_1.ensureCanonicalWeekStart)(new Date(row.weekStart));
            const key = canonicalStart.toISOString();
            if (!grouped.has(key))
                grouped.set(key, []);
            grouped.get(key).push(row);
        }
        const weeks = weekStarts.map((start) => {
            const key = start.toISOString();
            const items = grouped.get(key) ?? [];
            const endInclusive = new Date(start.getTime() + 7 * 24 * 3600 * 1000 - 1);
            if (!items.length) {
                return {
                    id: null,
                    statementNumber: null,
                    weekStart: start.toISOString(),
                    weekEnd: endInclusive.toISOString(),
                    grossSales: 0,
                    payoutAmount: 0,
                    currency: "KES",
                    isPaid: false,
                    placeholder: true,
                };
            }
            const candidates = items.map((r) => ({
                id: r.id,
                weekStart: new Date(r.weekStart),
                createdAt: r.createdAt ? new Date(r.createdAt) : new Date(0),
                updatedAt: r.updatedAt ? new Date(r.updatedAt) : null,
                statementNumber: r.statementNumber ?? null,
                payoutAmount: r.payoutAmount ?? null,
                grossSales: r.grossSales ?? null,
                rawPayload: r.rawPayload,
                isPaid: r.isPaid ?? false,
            }));
            const keeper = (0, payoutDeduper_1.chooseAuthoritativeCandidate)(candidates, start);
            const payout = Number(keeper?.payoutAmount ?? 0);
            const gross = Number(keeper?.grossSales ?? payout);
            return {
                id: keeper?.id ?? null,
                statementNumber: keeper?.statementNumber ?? null,
                weekStart: start.toISOString(),
                weekEnd: endInclusive.toISOString(),
                grossSales: gross,
                payoutAmount: payout,
                currency: "KES",
                isPaid: !!keeper?.isPaid,
                placeholder: Boolean(keeper?.rawPayload?.placeholder === true),
            };
        });
        const total4Weeks = weeks.reduce((sum, w) => sum + Number(w.grossSales ?? 0), 0);
        return {
            accountId: assignment.accountId,
            accountName: assignment.account.displayName,
            platform: assignment.account.platform,
            weeks,
            total4Weeks,
        };
    }));
    return server_1.NextResponse.json({ accounts: payload });
}
