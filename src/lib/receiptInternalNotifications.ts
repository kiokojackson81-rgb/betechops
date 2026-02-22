import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { extractItemsShort, extractReceiptTotalKES } from '@/lib/receiptExtract';
import { pushInternalReceiptAlert } from '@/lib/chatraceInternalFixed';
import { pushReceiptToChatrace } from '@/lib/integrations/chatrace';
import { getPodPendingStats } from '@/lib/podPendingStats';

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

function normalizeRecipientPhone(value?: string) {
  const raw = (value ?? '').toString().trim();
  if (!raw) return '';
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('254')) return digits;
  if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`;
  return digits;
}

function isPodPaymentMethod(value: string) {
  const raw = (value ?? '').toString().trim().toLowerCase();
  if (!raw) return false;
  const compact = raw.replace(/[\s_-]+/g, '');
  return compact === 'pod' || compact.includes('payondelivery');
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
  // Allow disabling the normal (non-POD) internal admin receipt WhatsApp notification
  // without affecting POD internal alerts (pod_receipt_admin_alert/pod_followup_alert).
  if (process.env.CHATRACE_INTERNAL_NORMAL_RECEIPT_ALERT_ENABLED === '0') {
    if (requestId) {
      console.info(`[receiptSender][${requestId}] INTERNAL:skipped normal_admin_disabled`);
    } else {
      console.info('[receipts][internal] skipped normal admin alert: disabled');
    }
    return;
  }
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

  // For POD receipts we only want the dedicated POD internal alerts
  // (pod_receipt_admin_alert + pod_followup_alert). Skip the "normal"
  // internal admin receipt notification to avoid duplicate messages.
  const hasPodDelivery = Boolean(
    receipt &&
      typeof receipt.data === 'object' &&
      receipt.data &&
      (receipt.data as any).podDelivery &&
      typeof (receipt.data as any).podDelivery === 'object' &&
      Boolean((receipt.data as any).podDelivery?.status)
  );
  if (hasPodDelivery || isPodPaymentMethod(paymentMethod)) {
    const ridSkip = requestId || randomUUID();
    console.info('[receipts][internal] skipping normal admin alert for POD receipt', {
      receiptId,
      rid: ridSkip,
      paymentMethod,
      hasPodDelivery,
    });
    return;
  }

  // Only notify admins for WALK IN / ONLINE / DELIVERY receipts. POD is handled separately.
  try {
    const rawType = (snapshot as any)?.customerType ?? (receipt.data as any)?.customerType ?? '';
    const compact = String(rawType || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '');
    if (compact === 'pod') {
      console.info('[receipts][internal] skipping normal admin alert for customerType=pod', {
        receiptId,
        customerType: rawType,
      });
      return;
    }
    if (compact && compact !== 'pod') {
      const allowed = new Set(['walkin', 'online', 'delivery']);
      if (!allowed.has(compact)) {
        console.info('[receipts][internal] skipping normal admin alert for non-notify customerType', {
          receiptId,
          customerType: rawType,
        });
        return;
      }
    }
  } catch (e) {
    // If parsing fails, fall back to existing behavior (best-effort).
  }

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

  const basePayload = {
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
  };

  const recipientsRaw = (process.env.ADMIN_NOTIFICATION_WHATSAPP_NUMBERS || '').toString().trim();
  const recipients = recipientsRaw
    ? recipientsRaw
        .split(/[,\s;]+/g)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const mainChatraceConfigured = Boolean(
    (process.env.CHATRACE_BASE_URL || '').toString().trim() &&
      (process.env.CHATRACE_ACCOUNT_ID || '').toString().trim() &&
      (process.env.CHATRACE_API_TOKEN || '').toString().trim(),
  );
  const adminChatraceAccountPrefRaw = (process.env.ADMIN_NOTIFICATION_CHATRACE_ACCOUNT || 'internal').toString();
  const adminChatraceAccountPref = adminChatraceAccountPrefRaw
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  const adminAccountMode =
    adminChatraceAccountPref === 'internal' || adminChatraceAccountPref === 'main' ? adminChatraceAccountPref : 'auto';

  console.info('[receipts][internal] attempting push', {
    receiptId,
    rid,
    recipients: recipients.length || '(default)',
    mode:
      adminAccountMode === 'main'
        ? 'main_chatrace(forced)'
        : adminAccountMode === 'internal'
          ? 'internal_chatrace(forced)'
          : mainChatraceConfigured
            ? 'main_chatrace(auto)'
            : 'internal_chatrace(auto)',
  });
  const results: any[] = [];
  const sendViaMainChatrace = async (toPhoneRaw: string, idx: number) => {
    const phone = normalizeRecipientPhone(toPhoneRaw);
    if (!phone) throw new Error(`Invalid admin recipient phone: ${toPhoneRaw}`);
    return pushReceiptToChatrace({
      phoneE164: phone,
      // This value is only used as the contact's first_name; we override the actual
      // receipt/customer fields via extraFields below.
      customerName: 'Admin',
      receiptNumber,
      amount: String(Math.round(invoiceAmount)),
      currency: 'KES',
      receiptLink: receiptLinkSafe,
      receiptUrl: undefined,
      receiptId: receipt.id,
      tagName: 'receipt_admin_alert',
      skipDefaultTags: true,
      extraFields: {
        receipt_number: receiptNumber,
        customer_name: basePayload.customerName,
        customer_phone: basePayload.customerPhone,
        formatted_amount: Math.round(invoiceAmount),
        payment_method: paymentMethod || 'N/A',
        created_by: basePayload.createdBy,
        admin_items: basePayload.itemsSummary || basePayload.itemsText || 'N/A',
        total_sales_today: Math.round(totalSalesToday),
      },
    });
  };

  const sendViaInternalChatrace = async (toPhoneRaw: string, idx: number) => {
    const phone = normalizeRecipientPhone(toPhoneRaw);
    if (!phone) throw new Error(`Invalid admin recipient phone: ${toPhoneRaw}`);
    const ridPerRecipient = `${rid}-admin-${idx + 1}`;
    return pushInternalReceiptAlert({ requestId: ridPerRecipient, toPhone: phone, ...basePayload });
  };

  const sendFallbackInternal = async () => {
    if (!recipients.length) {
      results.push(await pushInternalReceiptAlert({ requestId: rid, ...basePayload }));
      return;
    }
    for (let i = 0; i < recipients.length; i++) {
      results.push(await sendViaInternalChatrace(recipients[i]!, i));
    }
  };

  if (!recipients.length) {
    // Backwards-compatible fallback behavior (single internal admin recipient via envs).
    results.push(await pushInternalReceiptAlert({ requestId: rid, ...basePayload }));
  } else if (adminAccountMode === 'main' || (adminAccountMode === 'auto' && mainChatraceConfigured)) {
    for (let i = 0; i < recipients.length; i++) {
      try {
        results.push(await sendViaMainChatrace(recipients[i]!, i));
      } catch (e) {
        console.error('[receipts][internal] main chatrace send failed; falling back to internal chatrace', {
          receiptId,
          rid,
          idx: i + 1,
          err: e instanceof Error ? e.message : String(e),
        });
        results.push(await sendViaInternalChatrace(recipients[i]!, i));
      }
    }
  } else {
    await sendFallbackInternal();
  }

  for (const result of results) {
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
  }
  if (requestId) {
    console.info(`[receiptSender][${requestId}] INTERNAL:ok`);
  }
}

export async function notifyInternalPodAlerts(receiptId: string, opts?: { requestId?: string }) {
  const requestId = opts?.requestId ?? randomUUID();

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

  const snapshot: any =
    typeof receipt.data === 'object' && receipt.data
      ? { ...(receipt.data as Record<string, unknown>) }
      : { order: receipt.order, totals: receipt.totals };

  const receiptNumberValue =
    (typeof receipt.totals === 'object' && receipt.totals
      ? (receipt.totals as Record<string, any>).receiptNumber
      : null) ||
    (typeof receipt.data === 'object' && receipt.data
      ? (receipt.data as Record<string, any>).receiptNumber
      : null) ||
    receipt.order?.orderNumber;
  const receiptNumber = String(receiptNumberValue || receipt.orderId || receipt.id);

  const amountKES = extractReceiptTotalKES(receipt as any);
  const invoiceAmount = Number.isFinite(amountKES) ? amountKES : 0;

  if (!snapshot.attendantName) {
    snapshot.attendantName =
      receipt.order?.attendant?.name ??
      receipt.issuedBy?.name ??
      receipt.issuedBy?.email ??
      '(unknown)';
  }

  const staffName = snapshot.attendantName ?? '(unknown)';
  const itemsShort = extractItemsShort(receipt as any);
  const itemsSummary = String(itemsShort || '').trim();
  const itemsCount = itemsShort
    ? String(itemsShort)
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean).length
    : 0;

  let pendingCount = 0;
  let pendingTotal = 0;
  let pendingList = '';
  try {
    const stats = await getPodPendingStats(10);
    pendingCount = stats.pendingCount;
    pendingTotal = stats.pendingTotal;
    pendingList = stats.pendingList;
  } catch (e) {
    console.warn('[pod][internal] failed to compute pending stats', e instanceof Error ? e.message : String(e));
  }
  if (!pendingList || !pendingList.trim()) pendingList = 'None';

  // ADMIN POD RECEIPT ALERT
  try {
    const adminPodTagRaw = (process.env.CHATRACE_INTERNAL_POD_ADMIN_TAG || 'pod_receipt_admin_alert').toString().trim();
    const adminPodTag = adminPodTagRaw === 'receipt_admin_alert' ? 'pod_receipt_admin_alert' : adminPodTagRaw;
    if (adminPodTagRaw !== adminPodTag) {
      console.warn('[pod][internal] CHATRACE_INTERNAL_POD_ADMIN_TAG misconfigured; overriding', {
        from: adminPodTagRaw,
        to: adminPodTag,
      });
    }
    const recipientsRaw = (process.env.ADMIN_NOTIFICATION_WHATSAPP_NUMBERS || '').toString().trim();
    const recipients = recipientsRaw
      ? recipientsRaw
          .split(/[,\s;]+/g)
          .map((s) => s.trim())
          .filter(Boolean)
          .map((p) => normalizeRecipientPhone(p))
          .filter(Boolean)
      : [];

    // Fallback to the configured internal admin phone if no explicit recipients.
    const finalRecipients = recipients.length
      ? recipients
      : [normalizeRecipientPhone(process.env.CHATRACE_INTERNAL_ADMIN_PHONE || process.env.ADMIN_PHONE || '')].filter(Boolean);

    for (let i = 0; i < finalRecipients.length; i++) {
      const toPhone = finalRecipients[i]!;
      const rid = `${requestId}-pod-admin-${i + 1}`;
      await pushInternalReceiptAlert({
        requestId: rid,
        toPhone,
        tagName: adminPodTag,
        receiptNumber,
        amount: String(Math.round(invoiceAmount)),
        formattedAmount: Math.round(invoiceAmount),
        paymentMethod: 'POD',
        createdBy: staffName,
        itemsText: itemsShort,
        itemsSummary,
        itemsCount,
        customerName: (receipt.order as any)?.customerName ?? (snapshot.customerName as any) ?? 'Customer',
        customerPhone: (receipt.order as any)?.customerPhone ?? (snapshot.customerPhone as any) ?? '',
        podPendingCount: pendingCount,
        podPendingTotal: pendingTotal,
      });
    }
  } catch (e) {
    console.error('[pod][internal] failed to push admin POD alert', e instanceof Error ? e.message : String(e));
  }

  // FOLLOW-UP RESPONSIBLE ALERT
  try {
    const followupPhone =
      (process.env.CHATRACE_INTERNAL_FOLLOWUP_PHONE || '254716722601').toString().trim();
    const followupTag = (process.env.CHATRACE_INTERNAL_POD_FOLLOWUP_TAG || 'pod_followup_alert').toString().trim();
    await pushInternalReceiptAlert({
      requestId,
      toPhone: followupPhone,
      tagName: followupTag,
      receiptNumber,
      amount: String(Math.round(invoiceAmount)),
      formattedAmount: Math.round(invoiceAmount),
      paymentMethod: 'POD',
      createdBy: staffName,
      itemsText: itemsShort,
      itemsSummary,
      itemsCount,
      customerName: (receipt.order as any)?.customerName ?? (snapshot.customerName as any) ?? 'Customer',
      customerPhone: (receipt.order as any)?.customerPhone ?? (snapshot.customerPhone as any) ?? '',
      podPendingCount: pendingCount,
      podPendingList: pendingList,
    });
  } catch (e) {
    console.error('[pod][internal] failed to push follow-up POD alert', e instanceof Error ? e.message : String(e));
  }
}
