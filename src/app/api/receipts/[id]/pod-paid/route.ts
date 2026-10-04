import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAttendant } from '@/lib/auth';
import { publishSummaryUpdate } from '@/lib/receiptSseBroker';
import { randomUUID } from 'crypto';
import { notifyPodCustomer } from '@/lib/customerOrderNotifications';

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

  const role = String(guard?.user?.role ?? 'attendant').toLowerCase();
  const receipt = await prisma.receipt.findUnique({ where: { id: receiptId }, include: { order: true } });
  if (!receipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
  const actorId = guard.user?.id ?? null;
  const dataOwnerId = typeof receipt.data === 'object' && receipt.data ? String((receipt.data as Record<string, unknown>).attendantId || '') : '';
  const ownsReceipt = Boolean(actorId) && (actorId === receipt.issuedById || actorId === receipt.order?.attendantId || actorId === dataOwnerId);
  if (!['admin', 'supervisor'].includes(role) && !ownsReceipt) {
    return NextResponse.json({ error: 'Only the assigned agent or an administrator can confirm this payment' }, { status: 403 });
  }

  const baseData = typeof receipt.data === 'object' && receipt.data ? { ...(receipt.data as Record<string, unknown>) } : {};
  const pod = typeof baseData.podDelivery === 'object' && baseData.podDelivery ? { ...(baseData.podDelivery as Record<string, unknown>) } : null;
  if (!pod?.status) return NextResponse.json({ error: 'Receipt is not a POD receipt' }, { status: 400 });

  if (pod?.paidAt) {
    return NextResponse.json({ error: 'POD already marked paid' }, { status: 409 });
  }

  const paidAt = new Date().toISOString();
  const paidById = actorId;
  const paidByName = guard.user?.name ?? guard.user?.email ?? null;

  const updatedPod = { ...pod, paidAt, paidById, paidBy: paidByName } as Record<string, unknown>;

  try {
    await prisma.$transaction(async (tx) => {
      const re = await tx.receipt.findUnique({ where: { id: receiptId } });
      const rd = typeof re?.data === 'object' && re?.data ? (re.data as any) : {};
      const rp = rd?.podDelivery || {};
      if (rp.paidAt) throw new Error('already_paid');
      rd.podDelivery = { ...rp, ...updatedPod };
      await tx.receipt.update({ where: { id: receiptId }, data: { data: rd as Prisma.InputJsonValue } });
      if (re?.orderId) {
        await tx.order.update({
          where: { id: re.orderId },
          data: { paidAmount: receipt.order.totalAmount, paymentStatus: 'PAID' },
        });
      }

      if (paidById) {
        try {
          await tx.actionLog.create({ data: { actorId: paidById, entity: 'Receipt', entityId: receiptId, action: 'POD_MARK_PAID', before: { podDelivery: rp } as Prisma.InputJsonValue, after: { podDelivery: rd.podDelivery } as Prisma.InputJsonValue } as any });
        } catch (logErr) {
          console.warn('[pod-paid] failed to write action log', logErr);
        }
      }
    });
  } catch (e) {
    console.error(`[pod-paid][${requestId}] failed to mark pod paid`, e);
    return NextResponse.json({ error: 'Failed to mark POD paid' }, { status: 500 });
  }

  try {
    publishSummaryUpdate({ receiptId, timestamp: new Date().toISOString() });
  } catch (e) {
    console.warn('[pod-paid] failed to publish summary update', e);
  }
  await notifyPodCustomer({ receiptId, event: 'POD_PAID' }).catch((error) => console.error(`[pod-paid][${requestId}] customer notification failed`, error));

  return NextResponse.json({ ok: true });
}
