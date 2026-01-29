"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = exports.runtime = void 0;
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const receiptSseBroker_1 = require("@/lib/receiptSseBroker");
const auth_1 = require("@/lib/auth");
const receiptSender_1 = require("@/workers/receiptSender");
const receiptInternalNotifications_1 = require("@/lib/receiptInternalNotifications");
const crypto_1 = require("crypto");
exports.runtime = 'nodejs';
exports.dynamic = 'force-dynamic';
async function POST(req, context) {
    const requestId = (0, crypto_1.randomUUID)();
    let receiptId = '';
    try {
        const paramsObj = 'params' in context && typeof context.params?.then === 'function'
            ? await context.params
            : context.params;
        receiptId = String(paramsObj.id || '');
    }
    catch (e) {
        console.error(`[pod](rid=${requestId}) failed to resolve params`, e);
        return server_1.NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }
    let guard;
    try {
        guard = await (0, auth_1.requireAttendant)(req);
    }
    catch (maybeRes) {
        if (maybeRes instanceof server_1.NextResponse) {
            return maybeRes;
        }
        console.error(`[pod](rid=${requestId}) auth failure`, maybeRes);
        return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const receipt = await prisma_1.prisma.receipt.findUnique({
        where: { id: receiptId },
        include: {
            order: true,
        },
    });
    if (!receipt) {
        return server_1.NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }
    const baseData = typeof receipt.data === 'object' && receipt.data ? { ...receipt.data } : {};
    const podDelivery = typeof baseData.podDelivery === 'object' ? baseData.podDelivery : null;
    if (!podDelivery?.status) {
        return server_1.NextResponse.json({ error: 'Receipt is not marked for POD delivery' }, { status: 400 });
    }
    if (podDelivery.status !== 'pending') {
        return server_1.NextResponse.json({ error: 'POD receipt already finalized' }, { status: 409 });
    }
    if (!receipt.orderId || !receipt.order) {
        return server_1.NextResponse.json({ error: 'Missing associated order' }, { status: 400 });
    }
    const updatedPodDelivery = {
        ...podDelivery,
        status: 'delivered',
        deliveredAt: new Date().toISOString(),
        deliveredById: guard?.user?.id ?? null,
    };
    try {
        await prisma_1.prisma.$transaction(async (tx) => {
            await tx.order.update({
                where: { id: receipt.orderId },
                data: {
                    status: 'COMPLETED',
                    paymentStatus: 'PAID',
                    paidAmount: Math.max(Number(receipt.order?.totalAmount ?? 0), 0),
                },
            });
            await tx.receipt.update({
                where: { id: receiptId },
                data: {
                    data: { ...baseData, podDelivery: updatedPodDelivery },
                },
            });
        });
    }
    catch (err) {
        console.error(`[pod][${requestId}] failed to mark POD delivered`, err);
        return server_1.NextResponse.json({ error: 'Failed to mark POD delivery' }, { status: 500 });
    }
    const actorId = guard?.user?.id ?? null;
    const orderId = receipt.orderId;
    const previousOrder = receipt.order;
    const orderPaidAfter = Math.max(Number(receipt.order?.totalAmount ?? 0), 0);
    if (actorId) {
        try {
            await prisma_1.prisma.actionLog.create({
                data: {
                    actorId,
                    entity: 'Receipt',
                    entityId: receiptId,
                    action: 'POD_DELIVERED',
                    before: {
                        podDelivery: podDelivery ?? null,
                        orderId: receipt.orderId,
                    },
                    after: {
                        podDelivery: updatedPodDelivery,
                        orderId: receipt.orderId,
                    },
                },
            });
        }
        catch (logErr) {
            console.warn('[pod] failed to create receipt action log', logErr);
        }
        if (orderId) {
            try {
                await prisma_1.prisma.actionLog.create({
                    data: {
                        actorId,
                        entity: 'Order',
                        entityId: orderId,
                        action: 'POD_DELIVERED',
                        before: {
                            status: previousOrder?.status ?? null,
                            paymentStatus: previousOrder?.paymentStatus ?? null,
                            paidAmount: Number(previousOrder?.paidAmount ?? 0),
                        },
                        after: {
                            status: 'COMPLETED',
                            paymentStatus: 'PAID',
                            paidAmount: orderPaidAfter,
                        },
                    },
                });
            }
            catch (logErr) {
                console.warn('[pod] failed to create order action log', logErr);
            }
        }
    }
    if (receipt.order?.attendantId) {
        try {
            (0, receiptSseBroker_1.publishSummaryUpdate)({
                attendantId: receipt.order.attendantId,
                receiptId,
                timestamp: new Date().toISOString(),
            });
        }
        catch (summaryErr) {
            console.warn('[pod] failed to publish summary update', summaryErr);
        }
    }
    let sendResult = null;
    try {
        sendResult = await (0, receiptSender_1.sendReceiptChannels)(receiptId, ['whatsapp'], {
            requestId,
            chatraceTag: 'betech_dispatch_pay_on_delivery',
            skipDefaultChatraceTags: true,
        });
    }
    catch (sendErr) {
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
            await (0, receiptInternalNotifications_1.notifyInternalReceipt)(receiptId, receipt.docType, requestId, pdfForInternal);
        }
        catch (internalErr) {
            console.error('[pod] failed to notify internal ops', internalErr);
        }
    }
    return server_1.NextResponse.json({ ok: true, send: sendResult });
}
