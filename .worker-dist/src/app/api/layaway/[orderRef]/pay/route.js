"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const auth_1 = require("@/lib/auth");
const commission_1 = require("@/lib/commission");
exports.dynamic = "force-dynamic";
async function POST(req, context) {
    try {
        await (0, auth_1.requireAttendant)(req);
    }
    catch (res) {
        if (res instanceof server_1.NextResponse)
            return res;
        throw res;
    }
    const { orderRef } = 'params' in context && typeof context.params?.then === 'function'
        ? await context.params
        : context.params;
    const body = (await req.json());
    const amount = Number(body.amount || 0);
    const method = body.method ?? null;
    const ref = body.ref ?? null;
    if (!amount || amount <= 0)
        return server_1.NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    try {
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const order = await tx.order.findFirst({ where: { orderNumber: orderRef } });
            if (!order)
                throw new Error("Order not found");
            const plan = await tx.layawayPlan.findUnique({ where: { orderId: order.id } });
            if (!plan)
                throw new Error("Layaway plan not found");
            const payment = await tx.layawayPayment.create({ data: { planId: plan.id, amount: String(amount), method, ref } });
            // recompute balance
            const agg = await tx.layawayPayment.aggregate({ where: { planId: plan.id }, _sum: { amount: true } });
            const paid = Number(agg._sum.amount ?? 0);
            const newBalance = Number(plan.balance) - paid;
            const isComplete = newBalance <= 0;
            await tx.layawayPlan.update({ where: { id: plan.id }, data: { balance: newBalance <= 0 ? 0 : newBalance, isComplete } });
            if (isComplete) {
                // release commission if any pending
                const provisional = await tx.commissionRecord.findFirst({ where: { orderId: order.id, status: 'PENDING' } });
                if (provisional) {
                    const { period, tiers } = await (0, commission_1.getOrCreateCommissionPeriod)(new Date());
                    const totalsAgg = await tx.order.aggregate({ where: { attendantId: order.attendantId, createdAt: { gte: period.startDate, lte: period.endDate }, status: 'PAID' }, _sum: { totalAmount: true } });
                    const totalSales = Number(totalsAgg._sum.totalAmount ?? 0);
                    const totalProfit = totalSales;
                    const salesCommission = (0, commission_1.computeSalesCommissionFromTiers)(totalSales, totalProfit, tiers);
                    await tx.commissionRecord.update({ where: { id: provisional.id }, data: { amount: String(salesCommission), status: 'RELEASED', releasedAt: new Date(), periodId: period.id } });
                }
            }
            return { ok: true, paymentId: payment.id, isComplete };
        });
        return server_1.NextResponse.json(result);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return server_1.NextResponse.json({ error: msg }, { status: 500 });
    }
}
