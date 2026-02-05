import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { extractItemsShort, extractReceiptTotalKES } from '@/lib/receiptExtract';
import { pushInternalReceiptAlert } from '@/lib/chatraceInternalFixed';

export function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://ops.betech.co.ke';
}

export async function notifyInternalReceipt(
  receiptId: string,
  docType?: string,
  requestId?: string,
  receiptUrl?: string,
) {
  if (docType && docType !== 'RECEIPT') return;
  if (requestId) {
    console.info(`[receiptSender][${requestId}] INTERNAL:begin`);
  }
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: {
      issuedBy: { select: { name: true, email: true } },
      order: {
        select: {
          orderNumber: true,
          attendant: { select: { name: true } },
        },
      },
    },
  });
  if (!receipt) return;

  const receiptNumberValue =
    (typeof receipt.totals === 'object' && receipt.totals
      ? (receipt.totals as Record<string, any>).receiptNumber
      : null) ||
    (typeof receipt.data === 'object' && receipt.data
      ? (receipt.data as Record<string, any>).receiptNumber
      : null) ||
    receipt.order?.orderNumber;
  const receiptNumber = String(receiptNumberValue || receipt.orderId || receipt.id);

  const snapshot: any =
    typeof receipt.data === 'object' && receipt.data
      ? { ...(receipt.data as Record<string, unknown>) }
      : { order: receipt.order, totals: receipt.totals };
  if (!snapshot.attendantName) {
    snapshot.attendantName =
      receipt.order?.attendant?.name ??
      receipt.issuedBy?.name ??
      receipt.issuedBy?.email ??
      '(unknown)';
  }

  const amountKES = extractReceiptTotalKES(receipt as any);
  const invoiceAmount = Number.isFinite(amountKES) ? amountKES : 0;
  const paymentMethod = String(
    (typeof receipt.data === 'object' && receipt.data
      ? (receipt.data as Record<string, any>).paymentMethod
      : null) ||
      (typeof receipt.totals === 'object' && receipt.totals
        ? (receipt.totals as Record<string, any>).paymentMethod
        : null) ||
      ''
  )
    .trim();

  const staffName = receipt.issuedBy?.name || receipt.issuedBy?.email || '(unknown)';

  const itemsShort = extractItemsShort(receipt as any);
  const baseUrl = getSiteUrl().replace(/\/$/, '');
  const receiptLink = `${baseUrl}/receipts/${receipt.id}`;

  const rid = requestId || randomUUID();
  if (requestId) {
    console.info(`[receiptSender][${requestId}] INTERNAL:begin`);
  }
  const receiptLinkSafe = (receiptUrl && receiptUrl.trim()) || receiptLink;
  console.info('[receipts][internal] attempting push', { receiptId, rid });
  const result = await pushInternalReceiptAlert({
    requestId: rid,
    receiptNumber,
    amount: String(Math.round(invoiceAmount)),
    paymentMethod,
    createdBy: snapshot.attendantName ?? '(unknown)',
    itemsText: itemsShort,
    receiptLink: receiptLinkSafe,
    receiptPdfUrl: receiptUrl ?? null,
  });
  console.info('[receipts][internal] push result', {
    ok: result?.ok,
    rid: result?.debug?.rid ?? null,
    enabled: result?.debug?.enabled ?? null,
    env: result?.debug?.env ?? null,
    status: result?.debug?.steps?.createOrUpdate?.status ?? null,
    stepOk: result?.debug?.steps?.createOrUpdate?.ok ?? null,
    snippet: result?.debug?.steps?.createOrUpdate?.bodySnippet ?? null,
    json: result?.debug?.steps?.createOrUpdate?.json ?? null,
    rawHead: result?.debug?.steps?.createOrUpdate?.raw
      ? result.debug.steps.createOrUpdate.raw.length > 400
        ? result.debug.steps.createOrUpdate.raw.slice(0, 400)
        : result.debug.steps.createOrUpdate.raw
      : null,
  });
  if (!result?.ok) {
    try {
      console.error('[receipts][internal] push failed', result?.debug ?? result);
    } catch (logErr) {
      console.error('[receipts][internal] push failed (unable to serialize debug)', logErr);
    }
  }
  if (requestId) {
    console.info(`[receiptSender][${requestId}] INTERNAL:ok`);
  }
}
