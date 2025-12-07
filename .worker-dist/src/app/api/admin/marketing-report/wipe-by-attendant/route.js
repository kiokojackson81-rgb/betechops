"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const zod_1 = require("zod");
const BodySchema = zod_1.z.object({ userId: zod_1.z.string(), tradingPeriodKey: zod_1.z.string().optional() });
async function POST(req) {
    const authz = await (0, api_1.requireRole)("ADMIN");
    if (!authz.ok)
        return authz.res;
    let body;
    try {
        body = await req.json();
    }
    catch (e) {
        return server_1.NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    let parsed;
    try {
        parsed = BodySchema.parse(body);
    }
    catch (err) {
        return server_1.NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 });
    }
    const { userId, tradingPeriodKey } = parsed;
    try {
        const period = tradingPeriodKey
            ? (0, tradingPeriod_1.getRecentTradingPeriods)(12).find((p) => p.key === tradingPeriodKey) || (0, tradingPeriod_1.getTradingPeriodFor)(new Date())
            : (0, tradingPeriod_1.getTradingPeriodFor)(new Date());
        // Find entries for this attendant in the period
        const entries = await prisma_1.prisma.marketingDailyEntry.findMany({
            where: {
                submittedById: userId,
                date: { gte: period.start, lte: period.end },
            },
            include: { receipts: { include: { items: true } } },
        });
        if (!entries.length)
            return server_1.NextResponse.json({ wiped: 0, entries: [] });
        // Create a batch id for linking logs
        const batchId = `wipe_batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const wipedIds = [];
        for (const e of entries) {
            // delete items & receipts
            await prisma_1.prisma.marketingReceiptItem.deleteMany({ where: { receipt: { dailyEntryId: e.id } } });
            await prisma_1.prisma.marketingReceipt.deleteMany({ where: { dailyEntryId: e.id } });
            await prisma_1.prisma.marketingDailyEntry.update({ where: { id: e.id }, data: { totalSales: 0, totalProfit: 0 } });
            // Audit log per entry
            try {
                await prisma_1.prisma.actionLog.create({
                    data: {
                        actorId: req.headers.get('x-user-id') || '',
                        entity: 'MarketingDailyEntry',
                        entityId: e.id,
                        action: 'WIPE_RECEIPTS',
                        before: e,
                        after: { batchId, requestBy: req.headers.get('x-user-email') || '' },
                    },
                });
            }
            catch (logErr) {
                console.warn('failed to write actionLog for marketing wipe', logErr);
            }
            wipedIds.push(e.id);
        }
        return server_1.NextResponse.json({ wiped: wipedIds.length, entries: wipedIds, batchId });
    }
    catch (err) {
        console.error('wipe-by-attendant failed', err);
        return server_1.NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
    }
}
