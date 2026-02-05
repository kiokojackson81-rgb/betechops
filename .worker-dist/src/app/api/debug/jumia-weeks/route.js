"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runtime = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const weekWindow_1 = require("@/lib/weekWindow");
// Force server runtime so Prisma Client can be used during production start
exports.runtime = 'nodejs';
async function GET() {
    try {
        const weekStart = (0, weekWindow_1.canonicalNairobiWeekStartUtc)(new Date('2026-01-05T00:00:00.000Z'));
        const lower = new Date(weekStart.getTime() - 24 * 3600 * 1000);
        const upper = new Date(weekStart.getTime() + 24 * 3600 * 1000);
        const rows = await prisma_1.prisma.marketplacePayoutWeek.findMany({
            where: { weekStart: { gte: lower, lte: upper }, currency: 'KES' },
        });
        const perAccount = {};
        let grand = 0;
        for (const r of rows) {
            const acc = perAccount[r.accountId] ?? { accountId: r.accountId, displayName: undefined, total: 0 };
            acc.total += Number(r.payoutAmount ?? r.grossSales ?? 0);
            perAccount[r.accountId] = acc;
            grand += Number(r.payoutAmount ?? r.grossSales ?? 0);
        }
        return server_1.NextResponse.json({ weekStart: weekStart.toISOString(), countRows: rows.length, perAccount, grandTotal: grand });
    }
    catch (e) {
        return server_1.NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
    }
}
