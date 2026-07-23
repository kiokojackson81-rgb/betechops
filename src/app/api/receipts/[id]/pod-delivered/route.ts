import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { publishSummaryUpdate } from '@/lib/receiptSseBroker';
import { requireAttendant } from '@/lib/auth';
import { sendReceiptChannels } from '@/workers/receiptSender';
import { notifyInternalReceipt } from '@/lib/receiptInternalNotifications';
import { getOrCreateCommissionPeriod, computeSalesCommissionFromTiers } from '@/lib/commission';
import { getTradingPeriodFor } from '@/lib/tradingPeriod';
import { recomputeSupportCommissionLedger } from '@/lib/supportCommission';
import { canonicalReceiptNumber } from '@/lib/receiptGuard';
import { syncPosReceiptToCustomerAccount } from '@/lib/posCustomerAccountSync';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

function resolveOrderItemName(item: any): string {
  return String(item?.title || item?.productName || item?.product?.name || 'Item').trim() || 'Item';
}

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
  const actorRole = String(guard?.user?.role ?? '').toUpperCase();
  const actorId = String(guard?.user?.id ?? '').trim();
  const creatorIds = new Set(
    [
      receipt.issuedById,
      receipt.order?.attendantId,
      typeof baseData.attendantId === 'string' ? baseData.attendantId : null,
    ]
      .map((value) => String(value ?? '').trim())
      .filter(Boolean),
  );
  const canManageAnyReceipt = actorRole === 'ADMIN' || actorRole === 'SUPERVISOR';
  if (!canManageAnyReceipt && (!actorId || !creatorIds.has(actorId))) {
    return NextResponse.json({ error: 'Only the creator of this POD receipt can finalize delivery' }, { status: 403 });
  }
  if (!podDelivery?.status) {
    return NextResponse.json({ error: 'Receipt is not marked for POD delivery' }, { status: 400 });
  }
  // Prevent concurrent/follow-up finalization
  const lockTtlMs = Number(process.env.POD_FINALIZE_LOCK_TTL_MS || 5 * 60 * 1000);
  if (podDelivery.status !== 'pending') {
    return NextResponse.json({ error: 'POD receipt already finalized' }, { status: 409 });
  }
  if (podDelivery.lockedAt) {
    const lockedAt = new Date(podDelivery.lockedAt);
    if (!isNaN(lockedAt.getTime()) && Date.now() - lockedAt.getTime() < lockTtlMs) {
      return NextResponse.json({ error: 'POD delivery is currently being finalized by another process' }, { status: 409 });
    }
  }
  // allow caller to select outcome. default to delivered.
  let desiredStatus = 'delivered';
  let finalReason: string | null = null;
  let evidenceUrl: string | null = null;
  let evidenceFileName: string | null = null;
  let deliveryFee: number | null = null;
  try {
    const body = (await req.json()) ?? {};
    if (body && typeof body.status === 'string') {
      const s = body.status.trim().toLowerCase();
      if (s === 'delivered' || s === 'delivery_failed' || s === 'failed') {
        desiredStatus = s === 'failed' ? 'delivery_failed' : s;
      }
    }
    if (body && body.force === true) {
      const role = guard?.user?.role ?? 'attendant';
      if (role !== 'admin') {
        return NextResponse.json({ error: 'Insufficient role to force finalization' }, { status: 403 });
      }
    }
    if (body && typeof body.reason === 'string' && body.reason.trim().length > 0) {
      finalReason = body.reason.trim();
    }
    if (body && typeof body.evidenceUrl === 'string' && body.evidenceUrl.trim().length > 0) {
      evidenceUrl = body.evidenceUrl.trim();
    }
    if (body && typeof body.evidenceFileName === 'string' && body.evidenceFileName.trim().length > 0) {
      evidenceFileName = body.evidenceFileName.trim();
    }
    if (body && typeof body.deliveryFee !== 'undefined') {
      const parsedFee = Number(body.deliveryFee);
      if (Number.isFinite(parsedFee)) {
        deliveryFee = Math.max(0, Math.round(parsedFee));
      }
    }
  } catch {
    // no body / invalid json – default to 'delivered'
  }
  if (!receipt.orderId || !receipt.order) {
    return NextResponse.json({ error: 'Missing associated order' }, { status: 400 });
  }

  const updatedPodDeliveryBase: Record<string, any> = { ...podDelivery };
  if (desiredStatus === 'delivered') {
    updatedPodDeliveryBase.status = 'delivered';
    updatedPodDeliveryBase.deliveredAt = new Date().toISOString();
    updatedPodDeliveryBase.deliveredById = guard?.user?.id ?? null;
    if (finalReason) updatedPodDeliveryBase.deliveredReason = finalReason;
    if (evidenceUrl) updatedPodDeliveryBase.evidenceUrl = evidenceUrl;
    if (evidenceFileName) updatedPodDeliveryBase.evidenceFileName = evidenceFileName;
    if (deliveryFee !== null) updatedPodDeliveryBase.deliveryFee = deliveryFee;
  } else {
    updatedPodDeliveryBase.status = 'delivery_failed';
    updatedPodDeliveryBase.failedAt = new Date().toISOString();
    updatedPodDeliveryBase.failedById = guard?.user?.id ?? null;
    if (finalReason) updatedPodDeliveryBase.failedReason = finalReason;
    if (evidenceUrl) updatedPodDeliveryBase.evidenceUrl = evidenceUrl;
    if (evidenceFileName) updatedPodDeliveryBase.evidenceFileName = evidenceFileName;
    if (deliveryFee !== null) updatedPodDeliveryBase.deliveryFee = deliveryFee;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const deliveredOrder = desiredStatus === 'delivered'
        ? await tx.order.findUnique({
            where: { id: receipt.orderId! },
            include: {
              items: {
                include: {
                  product: {
                    select: {
                      id: true,
                      commissionEnabled: true,
                      commissionAmount: true,
                      commissionRequiresApproval: true,
                    },
                  },
                },
              },
            },
          })
        : null;
      const deliveredReceiptItems = (deliveredOrder?.items || []).map((it: any) => ({
        productName: String(it.title || it.productName || 'Item').trim(),
        buyingPrice: Math.max(0, Math.round(Number(it.costPrice ?? it.buyingPrice ?? 0))),
      }));
      const deliveredBuyingTotal = deliveredReceiptItems.reduce((sum: number, item: any) => sum + Number(item.buyingPrice || 0), 0);
      const deliveredSellingTotal = Math.round(Number(deliveredOrder?.totalAmount ?? receipt.order?.totalAmount ?? 0));
      const deliveredAllItemsPriced =
        deliveredReceiptItems.length > 0 && deliveredReceiptItems.every((item: any) => Number(item.buyingPrice ?? 0) > 0);

      // Re-read receipt inside transaction to enforce lock and avoid race
      const pr = await tx.receipt.findUnique({ where: { id: receiptId } });
      const prData = typeof pr?.data === 'object' && pr?.data ? (pr.data as any) : {};
      const prPod = prData?.podDelivery || {};
      if (prPod.lockedAt) {
        const lockedAt = new Date(prPod.lockedAt);
        if (!isNaN(lockedAt.getTime()) && Date.now() - lockedAt.getTime() < lockTtlMs) {
          throw new Error('POD finalization locked');
        }
      }

      // mark lockedAt to prevent concurrent finalization
      prPod.lockedAt = new Date().toISOString();
      await tx.receipt.update({ where: { id: receiptId }, data: { data: { ...prData, podDelivery: prPod } as Prisma.InputJsonValue } });

      // Only finalize order/payment when actually delivered. If delivery failed,
      // we persist the failed state but do not immediately update order/payment/commissions.
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
          data: { ...baseData, podDelivery: { ...updatedPodDeliveryBase, lockedAt: undefined } } as Prisma.InputJsonValue,
        },
      });

      // If delivered, create/update support placeholders immediately so PODs
      // stay visible in pricing queues. Only post financial totals once every
      // buying price is already known.
      if (desiredStatus === 'delivered') {
        try {
          const attendantId = receipt.order?.attendantId ?? null;
          const entryDate = new Date();
          const dayOfWeek = String(entryDate.getDay());

          // Marketing entry/upsert
          if (attendantId && tx.marketingDailyEntry && tx.marketingReceipt) {
            try {
              const marketingStart = new Date(entryDate);
              marketingStart.setHours(0, 0, 0, 0);
              const marketingEnd = new Date(entryDate);
              marketingEnd.setHours(23, 59, 59, 999);

              let entry = await tx.marketingDailyEntry.findFirst({
                where: { submittedById: attendantId, date: { gte: marketingStart, lte: marketingEnd } },
              });

              const actorName = guard.user?.name ?? guard.user?.email ?? null;
              const actorEmail = guard.user?.email ?? null;

              if (!entry) {
                entry = await tx.marketingDailyEntry.create({
                  data: {
                    date: entryDate,
                    dayOfWeek,
                    submittedById: attendantId,
                    submittedByName: actorName,
                    submittedByEmail: actorEmail,
                    totalSales: 0,
                    totalProfit: 0,
                  },
                });
              }

              const orderWithItems = await tx.order.findUnique({
                where: { id: receipt.orderId },
                include: { items: { include: { product: true } } },
              });
              const receiptSellingTotal = Math.round(Number(orderWithItems?.totalAmount ?? receipt.order?.totalAmount ?? 0));
              const receiptItemsPayload = (orderWithItems?.items || []).map((it: any) => ({
                productName: resolveOrderItemName(it),
                buyingPrice: Math.max(0, Math.round(Number(it.costPrice ?? it.buyingPrice ?? 0))),
              }));
              const receiptBuyingTotal = receiptItemsPayload.reduce((s: number, i: any) => s + i.buyingPrice, 0);

              await tx.marketingReceipt.create({
                data: {
                  dailyEntryId: entry.id,
                  receiptNumber: receipt.order?.orderNumber ?? null,
                  receiptKey: null,
                  paymentMethod: (baseData as any)?.paymentMethod ?? null,
                  sellingTotal: receiptSellingTotal,
                  buyingTotal: receiptBuyingTotal,
                  items: receiptItemsPayload.length ? { create: receiptItemsPayload } : undefined,
                },
              });

              if (entry.id) {
                await tx.marketingDailyEntry.update({
                  where: { id: entry.id },
                  data: { totalSales: { increment: receiptSellingTotal }, totalProfit: { increment: receiptSellingTotal - receiptBuyingTotal } },
                });
              }
            } catch (e) {
              console.warn('[pod] failed to update marketing entry', e);
            }
          }
          // Support entry/upsert
          if (attendantId && tx.supportDailyEntry && tx.supportReceipt) {
            try {
              const startOfDay = new Date(entryDate);
              startOfDay.setHours(0, 0, 0, 0);
              const endOfDay = new Date(entryDate);
              endOfDay.setHours(23, 59, 59, 999);
              const receiptNumber = canonicalReceiptNumber(receipt.order?.orderNumber) ?? receipt.order?.orderNumber ?? null;
              const paymentMethod = (baseData as any)?.paymentMethod ?? null;

              const entryId = (await tx.supportDailyEntry.findFirst({ where: { submittedById: attendantId, date: { gte: startOfDay, lte: endOfDay } }, select: { id: true } }))?.id
                ?? (await tx.supportDailyEntry.create({ data: { date: entryDate, dayOfWeek, totalSales: 0, totalProfit: 0, newBatteries: 0, changedBatteries: 0, submittedById: attendantId }, select: { id: true } })).id;

              const existingSupportReceipt = receiptNumber
                ? await tx.supportReceipt.findFirst({
                    where: { receiptNumber },
                    orderBy: { updatedAt: 'desc' },
                    select: { id: true },
                  })
                : null;

              if (existingSupportReceipt) {
                await tx.supportReceiptItem.deleteMany({ where: { receiptId: existingSupportReceipt.id } });
                await tx.supportReceipt.update({
                  where: { id: existingSupportReceipt.id },
                  data: {
                    dailyEntryId: entryId,
                    receiptNumber,
                    receiptKey: null,
                    paymentMethod,
                    sellingTotal: deliveredSellingTotal,
                    buyingTotal: deliveredBuyingTotal,
                    items: deliveredReceiptItems.length ? { create: deliveredReceiptItems } : undefined,
                  },
                });
              } else {
                await tx.supportReceipt.create({
                  data: {
                    dailyEntryId: entryId,
                    receiptNumber,
                    receiptKey: null,
                    paymentMethod,
                    sellingTotal: deliveredSellingTotal,
                    buyingTotal: deliveredBuyingTotal,
                    items: deliveredReceiptItems.length ? { create: deliveredReceiptItems } : undefined,
                  },
                });
              }

              if (entryId && deliveredAllItemsPriced) {
                await tx.supportDailyEntry.update({
                  where: { id: entryId },
                  data: {
                    totalSales: { increment: deliveredSellingTotal },
                    totalProfit: { increment: deliveredSellingTotal - deliveredBuyingTotal },
                  },
                });
              }
            } catch (e) {
              console.warn('[pod] failed to update support entry', e);
            }
          }
        } catch (e) {
          console.warn('[pod] failed to create marketing/support entries during finalize', e);
        }
      }

      // If delivered, release commission record and earnings, recompute ledgers.
      if (desiredStatus === 'delivered' && deliveredAllItemsPriced) {
        try {
          const attendantId = receipt.order?.attendantId ?? null;
          // Release commission record if present
          if (attendantId) {
            const provisional = await tx.commissionRecord.findFirst({ where: { orderId: receipt.orderId } });
            const { period, tiers } = await getOrCreateCommissionPeriod(new Date());
            const totalsAgg = await tx.order.aggregate({
              where: { attendantId, createdAt: { gte: period.startDate, lte: period.endDate }, status: 'COMPLETED' },
              _sum: { totalAmount: true, paidAmount: true },
            });
            const totalSales = Number(totalsAgg._sum.totalAmount ?? 0);
            const totalProfit = totalSales;
            const salesCommission = computeSalesCommissionFromTiers(totalSales, totalProfit, tiers as any);

            if (provisional && tx.commissionRecord) {
              await tx.commissionRecord.update({ where: { id: provisional.id }, data: { amount: String(salesCommission), status: 'RELEASED', releasedAt: new Date(), periodId: period.id } });
            }

            // Create and release gross earnings only when POD is actually delivered.
            if (tx.commissionEarning) {
              const deliveredItems = deliveredOrder?.items ?? [];
              const deliveredItemIds = deliveredItems.map((item) => item.id);
              if (deliveredItemIds.length) {
                await tx.commissionEarning.deleteMany({
                  where: {
                    orderItemId: { in: deliveredItemIds },
                    basis: { in: ['gross', 'product_flat'] },
                  } as any,
                });

                await tx.commissionEarning.createMany({
                  data: deliveredItems.map((item) => ({
                    staffId: attendantId,
                    orderItemId: item.id,
                    basis: 'gross',
                    qty: item.quantity,
                    amount: Number(item.sellingPrice || 0) * Number(item.quantity || 1),
                    status: 'RELEASED',
                    calcDetail: {
                      reason: 'receipt_seed_pod_delivered',
                      orderNumber: receipt.order?.orderNumber ?? null,
                      receiptId,
                      customerType: 'pod',
                      releasedAt: new Date().toISOString(),
                    },
                  })),
                });

                const podProductEarnings = deliveredItems
                  .map((item) => {
                    const unitCommission = Number(item.product?.commissionAmount ?? 0);
                    const amount = unitCommission * Number(item.quantity || 1);
                    if (!item.product?.commissionEnabled || amount <= 0) return null;
                    const requiresAdminApproval = Boolean(item.product?.commissionRequiresApproval);
                    return {
                      staffId: attendantId,
                      orderItemId: item.id,
                      basis: 'product_flat',
                      qty: item.quantity,
                      amount,
                      status: requiresAdminApproval ? 'PENDING_APPROVAL' : 'RELEASED',
                      calcDetail: {
                        reason: 'pos_product_commission',
                        productId: item.product?.id ?? null,
                        productName: resolveOrderItemName(item),
                        orderNumber: receipt.order?.orderNumber ?? null,
                        receiptId,
                        requiresApproval: requiresAdminApproval,
                        unitCommission,
                        customerType: 'pod',
                        releasedAt: requiresAdminApproval ? undefined : new Date().toISOString(),
                        approvedAt: requiresAdminApproval ? undefined : new Date().toISOString(),
                      },
                    };
                  })
                  .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

                if (podProductEarnings.length) {
                  await tx.commissionEarning.createMany({ data: podProductEarnings });
                }
              }
            }

            // Upsert balance
            if (tx.balance) {
              try {
                await tx.balance.upsert({ where: { userId: attendantId }, create: { userId: attendantId, available: Number(salesCommission), pending: 0 }, update: { available: { increment: Number(salesCommission) } as any } });
              } catch (e) {
                // ignore
              }
            }

            // Create commission ledger entry for audit (guard against duplicates)
            if (tx.commissionLedger) {
              try {
                await tx.commissionLedger.upsert({
                  where: {
                    userId_periodStart_periodEnd: {
                      userId: attendantId,
                      periodStart: period.startDate,
                      periodEnd: period.endDate,
                    },
                  },
                  create: {
                    userId: attendantId,
                    periodStart: period.startDate,
                    periodEnd: period.endDate,
                    grossCommission: Number(salesCommission),
                    penalties: 0,
                    netCommission: Number(salesCommission),
                    commissionTotal: Number(salesCommission),
                    detail: { reason: 'POD delivered: release on delivery' },
                  },
                  update: {
                    grossCommission: Number(salesCommission),
                    penalties: 0,
                    netCommission: Number(salesCommission),
                    commissionTotal: Number(salesCommission),
                    detail: { reason: 'POD delivered: release on delivery' },
                  },
                });
              } catch (e) {
                // ignore ledger failures
              }
            }
          }
        } catch (e) {
          console.error('[pod] failed to release commissions on delivered', e);
        }
      }
    });
  } catch (err) {
    console.error(`[pod][${requestId}] failed to mark POD ${desiredStatus}`, err);
    return NextResponse.json({ error: 'Failed to mark POD delivery' }, { status: 500 });
  }

  // Ensure we don't leave a stale lock in receipt.data.podDelivery.lockedAt
  try {
    const recheck = await prisma.receipt.findUnique({ where: { id: receiptId } });
    if (recheck) {
      const rd = typeof recheck.data === 'object' && recheck.data ? (recheck.data as any) : {};
      const rp = rd?.podDelivery || {};
      if (rp.lockedAt) {
        try {
          rd.podDelivery = { ...rp, lockedAt: undefined };
          await prisma.receipt.update({ where: { id: receiptId }, data: { data: rd as Prisma.InputJsonValue } });
        } catch (clearErr) {
          console.warn('[pod] failed to clear podDelivery.lockedAt after finalization', { receiptId, error: clearErr instanceof Error ? clearErr.message : String(clearErr) });
        }
      }
    }
  } catch (e) {
    console.warn('[pod] failed to re-check receipt to clear lock', e);
  }

  const auditActorId = actorId || null;
  const orderId = receipt.orderId;
  const previousOrder = receipt.order;
  const orderPaidAfter = Math.max(Number(receipt.order?.totalAmount ?? 0), 0);
  if (auditActorId) {
    try {
      await prisma.actionLog.create({
        data: {
          actorId: auditActorId,
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

  // Recompute support commission ledger for the attendant for today's trading period
  try {
    const attendantId = receipt.order?.attendantId ?? null;
    if (attendantId) {
      const period = getTradingPeriodFor(new Date());
      await recomputeSupportCommissionLedger({ userId: attendantId, period });
    }
  } catch (e) {
    console.warn('[pod] failed to recompute support commission ledger', e);
  }

  try {
    await syncPosReceiptToCustomerAccount(receiptId);
  } catch (syncErr) {
    console.error(`[pod][${requestId}] failed to sync POS receipt status to customer account`, {
      receiptId,
      error: syncErr instanceof Error ? syncErr.message : String(syncErr),
    });
  }

  let sendResult: any = null;
  try {
    // If a creation-time POD send already recorded a sent timestamp, avoid duplicating the WhatsApp.
    const existingChatrace = typeof baseData.chatrace === 'object' && baseData.chatrace ? (baseData.chatrace as Record<string, any>) : null;
    const podSentAt = typeof baseData.podDelivery === 'object' && baseData.podDelivery ? (baseData.podDelivery as any).sentAt : null;
    if (desiredStatus === 'delivered' && podSentAt) {
      console.info(`[pod][${requestId}] skipping chatrace send: podDelivery.sentAt present (${podSentAt})`);
      sendResult = { ok: true, sent: [], channelStatus: { chatrace: 'skipped', whatsapp: 'skipped' } } as any;
    } else if (desiredStatus === 'delivered' && existingChatrace?.status === 'sent') {
      console.info(`[pod][${requestId}] skipping chatrace send: chatrace.status=sent`);
      sendResult = { ok: true, sent: [], channelStatus: { chatrace: 'skipped', whatsapp: 'skipped' } } as any;
    } else if (desiredStatus === 'delivered') {
      sendResult = await sendReceiptChannels(receiptId, ['whatsapp'], {
        requestId,
        chatraceTag: (process.env.CHATRACE_POD_CUSTOMER_TAG || 'pod_dispatch_speedaf').trim(),
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
