"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconcileWeeks = reconcileWeeks;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
function startOfWeekLocal(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0 = Sunday, 1 = Monday
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}
async function reconcileWeeks(weeks = 8) {
    const results = [];
    const today = new Date();
    for (let i = 0; i < weeks; i++) {
        const ref = new Date(today);
        ref.setDate(ref.getDate() - i * 7);
        const weekStart = startOfWeekLocal(ref);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        const rows = await prisma.marketplacePayoutWeek.findMany({ where: { AND: [{ weekStart: { lte: weekEnd } }, { weekEnd: { gte: weekStart } }] } });
        let totalGross = 0;
        let totalPayout = 0;
        const byStatement = new Map();
        const missingSids = new Set();
        for (const r of rows) {
            totalGross += Number(r.grossSales ?? 0);
            totalPayout += Number(r.payoutAmount ?? r.grossSales ?? 0);
            const sn = r.statementNumber ?? '(none)';
            const arr = byStatement.get(sn) ?? [];
            arr.push(r);
            byStatement.set(sn, arr);
            const sid = r.rawPayload?.shopSid ?? null;
            if (sid) {
                const acct = await prisma.marketplaceAccount.findFirst({ where: { jumiaShopSid: sid } });
                if (!acct)
                    missingSids.add(sid);
            }
        }
        let duplicates = 0;
        for (const [, arr] of byStatement)
            if (arr.length > 1)
                duplicates++;
        // Compute deduplicated totals by taking a single representative row per statementNumber.
        let dedupedGross = 0;
        let dedupedPayout = 0;
        for (const [, arr] of byStatement) {
            // Prefer a row that contains a shopSid in the raw payload, otherwise take the first row
            const preferred = arr.find((x) => x.rawPayload?.shopSid) ?? arr[0];
            dedupedGross += Number(preferred.grossSales ?? 0);
            dedupedPayout += Number(preferred.payoutAmount ?? preferred.grossSales ?? 0);
        }
        const weeklySale = await prisma.weeklySale.aggregate({ _sum: { amount: true }, where: { platform: 'JUMIA', weekStart, weekEnd } });
        const weeklySum = Number(weeklySale._sum.amount ?? 0);
        const inflation = Number((totalGross ?? 0) - dedupedGross);
        results.push({
            weekStart: weekStart.toISOString().split('T')[0],
            weekEnd: weekEnd.toISOString().split('T')[0],
            payoutRows: rows.length,
            totalGross,
            totalPayout,
            dedupedGross,
            dedupedPayout,
            inflation,
            weeklySum,
            duplicates,
            missingSids: missingSids.size,
        });
    }
    return results;
}
