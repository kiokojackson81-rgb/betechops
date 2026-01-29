import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { publishSummaryUpdate } from '@/lib/receiptSseBroker';
import { requireAttendant } from '@/lib/auth';
import { sendReceiptChannels } from '@/workers/receiptSender';
import { notifyInternalReceipt } from '@/lib/receiptInternalNotifications';
import { randomUUID } from 'crypto';

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
    console.error(`[pod](rid=${requestId}) failed to resolve params`, e);
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  let guard;
  try {
    guard = await requireAttendant(req as unknown as Request);
  } catch (maybeRes) {
    if (maybeRes instanceof NextResponse) {
      return maybeRes;
    }
    console.error(`[pod](rid=${requestId}) auth failure`, maybeRes);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: {
      order: true,
    },
  });
  if (!receipt) {
    return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
  }

  const baseData =
    typeof receipt.data === 'object' && receipt.data ? { ...(receipt.data as Record<string, unknown>) } : {};
  const podDelivery = typeof baseData.podDelivery === 'object' ? (baseData.podDelivery as Record<string, any>) : null;
  if (!podDelivery?.status) {
    return NextResponse.json({ error: 'Receipt is not marked for POD delivery' }, { status: 400 });
  }
  if (podDelivery.status !== 'pending') {
    return NextResponse.json({ error: 'POD receipt already finalized' }, { status: 409 });
  }
  if (!receipt.orderId || !receipt.order) {
    return NextResponse.json({ error: 'Missing associated order' }, { status: 400 });
  }

  const updatedPodDelivery = {
    ...podDelivery,
    status: 'delivered',
    deliveredAt: new Date().toISOString(),
    deliveredById: guard?.user?.id ?? null,
  };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: receipt.orderId! },
        data: {
          status: 'COMPLETED',
          paymentStatus: 'PAID',
          paidAmount: Math.max(Number(receipt.order?.totalAmount ?? 0), 0),
        },
      });
      await tx.receipt.update({
        where: { id: receiptId },
        data: {
          data: { ...baseData, podDelivery: updatedPodDelivery } as Prisma.InputJsonValue,
        },
      });
    });
  } catch (err) {
    console.error(`[pod][${requestId}] failed to mark POD delivered`, err);
    return NextResponse.json({ error: 'Failed to mark POD delivery' }, { status: 500 });
  }

  if (receipt.order?.attendantId) {
    try {
      publishSummaryUpdate({
        attendantId: receipt.order.attendantId,
        receiptId,
        timestamp: new Date().toISOString(),
      });
    } catch (summaryErr) {
      console.warn('[pod] failed to publish summary update', summaryErr);
    }
  }

  let sendResult: any = null;
  try {
    sendResult = await sendReceiptChannels(receiptId, ['whatsapp'], {
      requestId,
      chatraceTag: 'betech_dispatch_pay_on_delivery',
      skipDefaultChatraceTags: true,
    });
  } catch (sendErr) {
    console.error(`[pod][${requestId}] sendReceiptChannels failed`, sendErr);
    sendResult = {
      ok: false,
      errors: [{ channel: 'send', error: String(sendErr) }],
      channelStatus: {},
    };
  }

  const pdfForInternal = sendResult?.pdfUrlCustomer ?? sendResult?.pdfUrlFull;
  if (pdfForInternal) {
    try {
      await notifyInternalReceipt(receiptId, receipt.docType, requestId, pdfForInternal);
    } catch (internalErr) {
      console.error('[pod] failed to notify internal ops', internalErr);
    }
  }

  return NextResponse.json({ ok: true, send: sendResult });
}
