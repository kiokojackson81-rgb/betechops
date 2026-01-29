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
  // allow caller to select outcome. default to delivered.
  let desiredStatus = 'delivered';
  try {
    const body = await req.json();
    if (body && typeof body.status === 'string') {
      const s = body.status.trim().toLowerCase();
      if (s === 'delivered' || s === 'delivery_failed' || s === 'failed') {
        desiredStatus = s === 'failed' ? 'delivery_failed' : s;
      }
    }
  } catch {
    // no body / invalid json — default to 'delivered'
  }
  if (!receipt.orderId || !receipt.order) {
    return NextResponse.json({ error: 'Missing associated order' }, { status: 400 });
  }

  const updatedPodDeliveryBase: Record<string, any> = { ...podDelivery };
  if (desiredStatus === 'delivered') {
    updatedPodDeliveryBase.status = 'delivered';
    updatedPodDeliveryBase.deliveredAt = new Date().toISOString();
    updatedPodDeliveryBase.deliveredById = guard?.user?.id ?? null;
  } else {
    updatedPodDeliveryBase.status = 'failed';
    updatedPodDeliveryBase.failedAt = new Date().toISOString();
    updatedPodDeliveryBase.failedById = guard?.user?.id ?? null;
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Only finalize order/payment when actually delivered. If delivery failed,
      // we persist the failed state but do not update order/payment/commissions.
      if (desiredStatus === 'delivered') {
        await tx.order.update({
          where: { id: receipt.orderId! },
          data: {
            status: 'COMPLETED',
            paymentStatus: 'PAID',
            paidAmount: Math.max(Number(receipt.order?.totalAmount ?? 0), 0),
          },
        });
      }
      await tx.receipt.update({
        where: { id: receiptId },
        data: {
          data: { ...baseData, podDelivery: updatedPodDeliveryBase } as Prisma.InputJsonValue,
        },
      });
    });
  } catch (err) {
    console.error(`[pod][${requestId}] failed to mark POD ${desiredStatus}`, err);
    return NextResponse.json({ error: 'Failed to mark POD delivery' }, { status: 500 });
  }

  const actorId = guard?.user?.id ?? null;
  const orderId = receipt.orderId;
  const previousOrder = receipt.order;
  const orderPaidAfter = Math.max(Number(receipt.order?.totalAmount ?? 0), 0);
  if (actorId) {
    try {
      await prisma.actionLog.create({
        data: {
          actorId,
          entity: 'Receipt',
          entityId: receiptId,
          action: 'POD_DELIVERED',
          before: {
            podDelivery: podDelivery ?? null,
            orderId: receipt.orderId,
          } as Prisma.InputJsonValue,
          after: {
            podDelivery: updatedPodDeliveryBase,
            orderId: receipt.orderId,
          } as Prisma.InputJsonValue,
        },
      });
    } catch (logErr) {
      console.warn('[pod] failed to create receipt action log', logErr);
    }
    if (orderId) {
      try {
        await prisma.actionLog.create({
          data: {
            actorId,
            entity: 'Order',
            entityId: orderId,
            action: 'POD_DELIVERED',
            before: {
              status: previousOrder?.status ?? null,
              paymentStatus: previousOrder?.paymentStatus ?? null,
              paidAmount: Number(previousOrder?.paidAmount ?? 0),
            } as Prisma.InputJsonValue,
            after: {
              status: desiredStatus === 'delivered' ? 'COMPLETED' : previousOrder?.status ?? null,
              paymentStatus: desiredStatus === 'delivered' ? 'PAID' : previousOrder?.paymentStatus ?? null,
              paidAmount: desiredStatus === 'delivered' ? orderPaidAfter : Number(previousOrder?.paidAmount ?? 0),
            } as Prisma.InputJsonValue,
          },
        });
      } catch (logErr) {
        console.warn('[pod] failed to create order action log', logErr);
      }
    }
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
    // If a chatrace push already occurred at creation time, avoid duplicating the WhatsApp.
    const existingChatrace = typeof baseData.chatrace === 'object' && baseData.chatrace ? (baseData.chatrace as Record<string, any>) : null;
    if (desiredStatus === 'delivered' && existingChatrace?.status === 'sent') {
      console.info(`[pod][${requestId}] skipping chatrace send: already sent at creation`);
      sendResult = { ok: true, sent: [], channelStatus: { chatrace: 'skipped', whatsapp: 'skipped' } } as any;
    } else if (desiredStatus === 'delivered') {
      sendResult = await sendReceiptChannels(receiptId, ['whatsapp'], {
        requestId,
        chatraceTag: 'betech_dispatch_pay_on_delivery',
        skipDefaultChatraceTags: true,
      });
    } else {
      // delivery_failed: do not attempt to send WhatsApp
      console.info(`[pod][${requestId}] delivery failed — skipping chatrace send`);
      sendResult = { ok: true, sent: [], channelStatus: { chatrace: 'skipped', whatsapp: 'skipped' } } as any;
    }
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
