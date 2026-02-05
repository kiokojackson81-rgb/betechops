import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { publishSummaryUpdate } from '@/lib/receiptSseBroker';
import { requireAttendant } from '@/lib/auth';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: ParamsContext) {
  const requestId = randomUUID();

  let receiptId = '';
  try {
    const paramsObj = 'params' in context && typeof (context as any).params?.then === 'function'
      ? await (context as { params: Promise<{ id: string }> }).params
      : (context as { params: { id: string } }).params;
    receiptId = String(paramsObj.id || '');
  } catch (e) {
    console.error(`[pod-paid][${requestId}] failed to resolve params`, e);
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  let guard;
  try {
    guard = await requireAttendant(req as unknown as Request);
  } catch (maybeRes) {
    if (maybeRes instanceof NextResponse) return maybeRes;
    console.error(`[pod-paid][${requestId}] auth failure`, maybeRes);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const receipt = await prisma.receipt.findUnique({ where: { id: receiptId }, include: { order: true } });
  if (!receipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });

  const baseData = typeof receipt.data === 'object' && receipt.data ? { ...(receipt.data as Record<string, any>) } : {};
  const pod = typeof baseData.podDelivery === 'object' && baseData.podDelivery ? { ...(baseData.podDelivery as Record<string, any>) } : {};

  try {
    pod.status = 'paid';
    pod.paidAt = new Date().toISOString();
    pod.paidBy = guard?.user?.id ?? null;

    const nextData = { ...baseData, podDelivery: pod } as Prisma.InputJsonValue;
    await prisma.receipt.update({ where: { id: receiptId }, data: { data: nextData } });

    try {
      if (receipt.order?.attendantId) {
        publishSummaryUpdate({ attendantId: receipt.order.attendantId, receiptId, timestamp: new Date().toISOString() });
      }
    } catch (err) {
      console.warn('[pod-paid] failed to publish summary update', err);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`[pod-paid][${requestId}] failed to mark paid`, err);
    return NextResponse.json({ error: 'Failed to mark POD as paid' }, { status: 500 });
  }
}
