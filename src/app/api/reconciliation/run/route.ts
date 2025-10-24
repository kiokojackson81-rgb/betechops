import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api';

export async function POST(request: Request) {
  const auth = await requireRole('ADMIN');
  if (!auth.ok) return auth.res;

  const body = await request.json().catch(() => ({}));
  const { shopId, day } = body as any;
  if (!shopId || !day) return NextResponse.json({ error: 'shopId and day required' }, { status: 400 });

  // Compute reconciliation for the given day
  const start = new Date(day);
  start.setUTCHours(0,0,0,0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const p = prisma;
  const ordersCount = await p.order.count({ where: { shopId, createdAt: { gte: start, lt: end } } });
  const ordersSumRow = await p.order.aggregate({ _sum: { totalAmount: true }, where: { shopId, createdAt: { gte: start, lt: end } } }).catch(() => null);
  const ordersTotal = (ordersSumRow?._sum?.totalAmount) ? Number(ordersSumRow._sum.totalAmount) : 0;

  // Sum settlement rows posted that day
  const payoutRow = await p.settlementRow.aggregate({ _sum: { amount: true }, where: { shopId, postedAt: { gte: start, lt: end } } }).catch(() => null);
  const payoutAmount = (payoutRow?._sum?.amount) ? Number(payoutRow._sum.amount) : 0;

  const variance = Number((payoutAmount - ordersTotal).toFixed(2));

  const recon = await p.reconciliation.create({ data: { shopId, day: start, ordersCount, payoutAmount, variance } });

  if (variance !== 0) {
    await p.discrepancy.create({ data: { shopId, kind: 'AMOUNT_MISMATCH', ref: day, amount: variance, status: 'OPEN' } });
  }

  return NextResponse.json({ ok: true, recon, variance });
}
