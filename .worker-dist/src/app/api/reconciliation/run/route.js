"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
async function POST(request) {
    var _a, _b;
    const auth = await (0, api_1.requireRole)('ADMIN');
    if (!auth.ok)
        return auth.res;
    const body = (await request.json().catch(() => ({})));
    const { shopId, day } = body;
    if (!shopId || !day)
        return server_1.NextResponse.json({ error: 'shopId and day required' }, { status: 400 });
    // Compute reconciliation for the given day
    const start = new Date(day);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    const p = prisma_1.prisma;
    const ordersCount = await p.order.count({ where: { shopId, createdAt: { gte: start, lt: end } } });
    const ordersSumRow = await p.order.aggregate({ _sum: { totalAmount: true }, where: { shopId, createdAt: { gte: start, lt: end } } }).catch(() => null);
    const ordersTotal = ((_a = ordersSumRow === null || ordersSumRow === void 0 ? void 0 : ordersSumRow._sum) === null || _a === void 0 ? void 0 : _a.totalAmount) ? Number(ordersSumRow._sum.totalAmount) : 0;
    // Sum settlement rows posted that day
    const payoutRow = await p.settlementRow.aggregate({ _sum: { amount: true }, where: { shopId, postedAt: { gte: start, lt: end } } }).catch(() => null);
    const payoutAmount = ((_b = payoutRow === null || payoutRow === void 0 ? void 0 : payoutRow._sum) === null || _b === void 0 ? void 0 : _b.amount) ? Number(payoutRow._sum.amount) : 0;
    const variance = Number((payoutAmount - ordersTotal).toFixed(2));
    const recon = await p.reconciliation.create({ data: { shopId, day: start, ordersCount, payoutAmount, variance } });
    if (variance !== 0) {
        await p.discrepancy.create({ data: { shopId, kind: 'AMOUNT_MISMATCH', ref: day, amount: variance, status: 'OPEN' } });
    }
    return server_1.NextResponse.json({ ok: true, recon, variance });
}
