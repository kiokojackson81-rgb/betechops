import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAttendant } from "@/lib/auth";
import { getOrCreateCommissionPeriod, computeSalesCommissionFromTiers } from "@/lib/commission";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, context: { params: { orderRef: string } } | { params: Promise<{ orderRef: string }> }) {
  try {
    await requireAttendant(req as unknown as Request);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }

  const { orderRef } = 'params' in context && typeof (context as any).params?.then === 'function'
    ? await (context as { params: Promise<{ orderRef: string }> }).params
    : (context as { params: { orderRef: string } }).params;
  const body = (await req.json()) as any;
  const amount = Number(body.amount || 0);
  const method = body.method ?? null;
  const ref = body.ref ?? null;

  if (!amount || amount <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { orderNumber: orderRef } });
      if (!order) throw new Error("Order not found");
      const plan = await tx.layawayPlan.findUnique({ where: { orderId: order.id } });
      if (!plan) throw new Error("Layaway plan not found");

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
          const { period, tiers } = await getOrCreateCommissionPeriod(new Date());
          const totalsAgg = await tx.order.aggregate({ where: { attendantId: order.attendantId, createdAt: { gte: period.startDate, lte: period.endDate }, status: 'PAID' as any }, _sum: { totalAmount: true } });
          const totalSales = Number(totalsAgg._sum.totalAmount ?? 0);
          const totalProfit = totalSales;
          const salesCommission = computeSalesCommissionFromTiers(totalSales, totalProfit, tiers as any);
          await tx.commissionRecord.update({ where: { id: provisional.id }, data: { amount: String(salesCommission), status: 'RELEASED', releasedAt: new Date(), periodId: period.id } });
        }
      }

      return { ok: true, paymentId: payment.id, isComplete };
    });

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
