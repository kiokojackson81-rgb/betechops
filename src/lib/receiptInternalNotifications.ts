import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { extractItemsShort, extractReceiptTotalKES } from '@/lib/receiptExtract';
import { pushInternalReceiptAlert } from '@/lib/chatraceInternalFixed';

export function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://ops.betech.co.ke';
}

function formatCurrencyKes(value: number) {
  try {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${Math.round(value)} KES`;
  }
}

function digitsOnly(value?: string) {
  const raw = (value ?? '').toString().trim();
  if (!raw) return '';
  return raw.replace(/[^0-9]/g, '');
}

function getNairobiUtcWindow(date: Date) {
  // Nairobi is UTC+3 and does not observe DST.
  const nairobiOffsetMs = 3 * 60 * 60 * 1000;
  const createdInNairobi = new Date(date.getTime() + nairobiOffsetMs);
  const yyyy = createdInNairobi.getUTCFullYear();
  const mm = createdInNairobi.getUTCMonth();
  const dd = createdInNairobi.getUTCDate();
  const startUtcMs = Date.UTC(yyyy, mm, dd, 0, 0, 0) - nairobiOffsetMs;
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000;
  return { start: new Date(startUtcMs), end: new Date(endUtcMs) };
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
          customerName: true,
          customerPhone: true,
          attendant: { select: { name: true } },
          totalAmount: true,
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
  const formattedAmount = formatCurrencyKes(invoiceAmount);
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
  const itemsSummary = String(itemsShort || '').replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();
  const itemsCount = itemsShort
    ? String(itemsShort)
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean).length
    : 0;
  const baseUrl = getSiteUrl().replace(/\/$/, '');
  const receiptLink = `${baseUrl}/receipts/${receipt.id}`;

  const rid = requestId || randomUUID();
  if (requestId) {
    console.info(`[receiptSender][${requestId}] INTERNAL:begin`);
  }
  const receiptLinkSafe = (receiptUrl && receiptUrl.trim()) || receiptLink;

  // Daily total sales (Nairobi day window). Best-effort; failures should not block the admin alert.
  let totalSalesToday = 0;
  try {
    const { start, end } = getNairobiUtcWindow(receipt.createdAt ? new Date(receipt.createdAt) : new Date());
    const receiptsToday = await prisma.receipt.findMany({
      where: { createdAt: { gte: start, lt: end } },
      include: { order: { select: { totalAmount: true } } },
    });
    for (const r of receiptsToday) {
      const t = typeof r.totals === 'object' && r.totals ? (r.totals as any).total : undefined;
      let val = NaN;
      if (typeof t === 'number') val = t;
      else if (typeof t === 'string') val = Number(t);
      else if (typeof r.order?.totalAmount === 'number') val = r.order.totalAmount;
      totalSalesToday += Number.isFinite(Number(val)) ? Number(val) : 0;
    }
  } catch (e) {
    console.warn('[receipts][internal] failed to compute totalSalesToday', e instanceof Error ? e.message : String(e));
  }

  console.info('[receipts][internal] attempting push', { receiptId, rid });
  const result = await pushInternalReceiptAlert({
    requestId: rid,
    receiptNumber,
    amount: String(Math.round(invoiceAmount)),
    // If the Chatrace field is configured as Number, send a numeric-only value.
    formattedAmount: Math.round(invoiceAmount),
    paymentMethod,
    createdBy: snapshot.attendantName ?? '(unknown)',
    itemsText: itemsShort,
    itemsSummary,
    itemsCount,
    totalSalesToday: Math.round(totalSalesToday),
    customerName: (receipt.order as any)?.customerName ?? snapshot.customerName ?? 'Customer',
    // If the Chatrace field is configured as Number, send digits only (E.164 without +).
    customerPhone: digitsOnly((receipt.order as any)?.customerPhone ?? (snapshot.customerPhone as any) ?? ''),
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
