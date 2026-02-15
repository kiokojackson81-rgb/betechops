import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

const BASE_URL = (process.env.CHATRACE_BASE_URL || '').replace(/\/$/, '');
const API_TOKEN = process.env.CHATRACE_API_TOKEN;
const ACCOUNT_ID = process.env.CHATRACE_ACCOUNT_ID;

export type SendReceiptToChatraceInput = {
  phoneE164: string;
  customerName: string;
  receiptNumber: string;
  amount: string;
  currency: string;
  receiptLink: string;
  receiptUrl?: string; // final URL to be written into Chatrace `receipt_url`
  receiptId?: string;
  tagName?: string;
  skipDefaultTags?: boolean;
  items?: any[];
  paymentMethod?: string;
  attendant?: string;
};

function checkConfig() {
  const missing: string[] = [];
  if (!BASE_URL) missing.push('CHATRACE_BASE_URL');
  if (!API_TOKEN) missing.push('CHATRACE_API_TOKEN');
  if (!ACCOUNT_ID) missing.push('CHATRACE_ACCOUNT_ID');
  return missing;
}

export async function pushReceiptToChatrace(input: SendReceiptToChatraceInput): Promise<{ ok: boolean; debug: any }> {
  const {
    phoneE164,
    customerName,
    receiptNumber,
    amount,
    currency,
    receiptLink,
    receiptUrl,
    receiptId,
    tagName,
    skipDefaultTags,
  } = input;
  const receiptUrlTrimmed = receiptUrl?.trim();
  const debug: any = {
    ok: false,
    steps: {},
    contactId: null,
    phoneNormalized: phoneE164,
    receiptUrlPresent: !!receiptUrlTrimmed,
    receiptUrlLength: receiptUrlTrimmed?.length ?? 0,
    env: {
      baseUrlPresent: !!BASE_URL,
      accountIdPresent: !!ACCOUNT_ID,
      tokenPresent: !!API_TOKEN,
      baseUrl: BASE_URL,
      accountId: ACCOUNT_ID,
      headerKeys: [],
      skipDefaultTags: Boolean(skipDefaultTags),
    },
  };

  if (!phoneE164) throw new Error('phoneE164 is required');
  if (!customerName) throw new Error('customerName is required');
  if (!receiptNumber) throw new Error('receiptNumber is required');
  if (!amount) throw new Error('amount is required');
  if (!currency) throw new Error('currency is required');
  if (!receiptLink) throw new Error('receiptLink is required');

  const missingConfig = checkConfig();
  if (missingConfig.length) {
    const message = `Missing Chatrace env vars: ${missingConfig.join(', ')}`;
    console.error('[chatrace] config missing', message);
    debug.error = message;
    await persistDebug(receiptNumber, debug);
    return { ok: false, debug };
  }

  const headers = {
    'X-ACCESS-TOKEN': API_TOKEN || '',
    Accept: 'application/json',
  } as Record<string, string>;
  if (ACCOUNT_ID) {
    headers['X-ACCOUNT-ID'] = ACCOUNT_ID;
  }
  const headerKeys = Object.keys(headers);
  debug.env.headerKeys = headerKeys;

  const pathWithBase = (path: string) => `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  async function runRequest(path: string, body: unknown, hdrs: Record<string, string> = headers) {
    const url = pathWithBase(path);
    const timeoutMs = 8_000;
    const controller = new AbortController();
    const init: RequestInit = {
      method: 'POST',
      signal: controller.signal as any,
      headers: {
        ...hdrs,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    };
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response | null = null;
    let text = '';
    let json: any = null;
    try {
      res = await fetch(url, init as any);
      clearTimeout(timer);
      text = await res.text().catch(() => '');
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      const bodySnippet = (text || '').slice(0, 500);
      const bodyError =
        json && (json.error ?? (Array.isArray(json.errors) ? json.errors[0] : null))
          ? json.error ?? json.errors
          : null;
      console.info('[chatrace][http]', {
        method: 'POST',
        path,
        url,
        status: res.status,
        headerKeys,
        success: json?.success ?? null,
        contactCreated: json?.contact_created ?? json?.data?.contact_created ?? null,
        bodySnippet,
        bodyError,
      });
      console.info('[chatrace][http][debug]', { status: res.status, path, bodySnippet, json: json ?? null, rawHead: text ? (text.length > 500 ? text.slice(0, 500) : text) : null });
      if (!res.ok) {
        console.error('[chatrace][http] non-2xx response', { path, status: res.status, bodySnippet });
      }
      return { ok: res.ok, status: res.status, text, json, bodyError };
    } catch (e: any) {
      clearTimeout(timer);
      const errMessage = String(e);
      const stack = e && e.stack ? e.stack : null;
      console.error('[chatrace][http] failed', { method: 'POST', path, error: errMessage, stack });
      return { ok: false, status: 0, text: errMessage, json: null, bodyError: errMessage };
    }
  }

  const ensureHttps = /^https:\/\//i.test(receiptLink);
  if (!ensureHttps) {
    debug.pdfUrlWarning = 'receiptLink should be HTTPS and publicly reachable';
    console.warn('[chatrace] receiptLink does not look public HTTPS', { receiptLink });
  }

  const finalTag = (tagName?.trim() || '').toLowerCase();
  const receiptMode = receiptUrlTrimmed ? 'pdf' : 'link';

  const finalReceiptUrl = (receiptUrlTrimmed || receiptLink || '').trim();
  if (!finalReceiptUrl) {
    throw new Error('finalReceiptUrl is empty (receiptUrl + receiptLink both missing)');
  }

  const setFieldValue = (fieldName: string, value: any) => ({
    action: 'set_field_value',
    field_name: fieldName,
    value: value == null ? '' : String(value),
  });
  // Build minimal required custom fields according to integration
  // requirements. We'll perform a two-step POST: first upsert/set fields,
  // then apply the trigger tag `receipt_created` so Chatrace Flows render
  // template variables from the persisted fields.
  const fieldActions: any[] = [];

  // Required custom fields (must match exactly)
  fieldActions.push(setFieldValue('receipt_url', finalReceiptUrl));
  fieldActions.push(setFieldValue('customer_name', customerName || 'Customer'));
  fieldActions.push(setFieldValue('receipt_number', receiptNumber));
  fieldActions.push(setFieldValue('amount', amount));
  fieldActions.push(setFieldValue('currency', currency || 'KES'));

  // Format items_summary as plain text lines (1. name xqty — KES #)
  const formatCurrencyKesLocal = (v: number | string) => {
    try {
      const n = Number(v) || 0;
      return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(n);
    } catch {
      return `${Math.round(Number(v) || 0)} KES`;
    }
  };

  let itemsSummary = '';
  try {
    if (input.items && Array.isArray(input.items) && input.items.length) {
      const lines = input.items.map((it: any, idx: number) => {
        const title = String(it.title || it.productName || it.product || it.name || '').trim() || 'Item';
        const qty = Number.isFinite(Number(it.quantity ?? 1)) ? Number(it.quantity ?? 1) : 1;
        const unit = Number.isFinite(Number(it.unitPrice ?? it.sellingPrice ?? 0)) ? Number(it.unitPrice ?? it.sellingPrice ?? 0) : 0;
        const priceText = formatCurrencyKesLocal(unit * qty);
        return `${idx + 1}) ${title} x${qty} — ${priceText}`;
      });
      itemsSummary = lines.join('\n');
      // Truncate to ~700 chars to keep WhatsApp template safe
      const MAX_LEN = 700;
      if (itemsSummary.length > MAX_LEN) {
        itemsSummary = itemsSummary.slice(0, MAX_LEN - 1).trimEnd() + '…';
      }
    }
  } catch (e) {
    itemsSummary = '';
  }
  // Ensure we always set the field (fallback text when no items) so the template parameters never send empty
  const itemsSummarySafe = itemsSummary.trim().length ? itemsSummary : 'Items: (not available)';
  fieldActions.push(setFieldValue('items_summary', itemsSummarySafe));
  // Optionally include receipt_id as well
  if (receiptId) fieldActions.push(setFieldValue('receipt_id', receiptId));
  // Also write common alias fields so templates that use alternate names
  // (e.g. order_placed, order_number) still receive the value.
  try {
    fieldActions.push(setFieldValue('order_placed', receiptNumber));
    fieldActions.push(setFieldValue('order_number', receiptNumber));
    fieldActions.push(setFieldValue('receipt_no', receiptNumber));
    // Some flows expect items under a shorter key
    fieldActions.push(setFieldValue('items', itemsSummarySafe));
  } catch (e) {
    // noop — best-effort
  }

  // Build tag actions separately so they can be applied after fields persist
  const tagActions: any[] = [];
  // Always apply the trigger tag the Flow listens for
  tagActions.push({ action: 'add_tag', tag_name: 'receipt_created' });
  // Apply pdf/link variant tag (helps flows that branch on pdf vs link)
  tagActions.push({ action: 'add_tag', tag_name: receiptMode === 'pdf' ? 'receipt_created_pdf' : 'receipt_created_link' });
  // Also apply any custom tag provided (e.g. pod dispatch). Do not skip
  // applying the core trigger tag even when skipDefaultTags is true.
  if (finalTag && finalTag !== 'receipt_created') {
    tagActions.push({ action: 'add_tag', tag_name: finalTag });
  }

  debug.payloadPreview = {
    phone: phoneE164,
    first_name: customerName || 'Customer',
    fieldActionsCount: fieldActions.length,
    tagActionsCount: tagActions.length,
    tag: finalTag || 'receipt_created',
    debugTag: finalTag || (receiptMode === 'pdf' ? 'receipt_created_pdf' : 'receipt_created_link'),
    skipDefaultTags: Boolean(skipDefaultTags),
    hasReceiptUrl: !!finalReceiptUrl,
    receiptMode,
    finalReceiptUrlLength: finalReceiptUrl.length,
    itemsCount: Array.isArray(input.items) ? input.items.length : 0,
    paymentMethod: input.paymentMethod ?? null,
    attendant: input.attendant ?? null,
  };

  console.info('[chatrace] pushReceipt', {
    receiptNumber,
    phoneE164,
    baseUrl: BASE_URL,
    accountId: ACCOUNT_ID,
    headerKeys,
    receiptMode,
    receiptUrlTrimmedLength: receiptUrlTrimmed?.length ?? 0,
    finalReceiptUrlLength: finalReceiptUrl.length,
    finalReceiptUrlSnippet: finalReceiptUrl.slice(0, 120),
    tagToApply: finalTag || 'receipt_created',
    debugTag: finalTag || (receiptMode === 'pdf' ? 'receipt_created_pdf' : 'receipt_created_link'),
  });

  // summary log for monitoring integrations (phone, final receipt_url, tag, mode)
  console.info('[chatrace] pushSummary', {
    phone: phoneE164,
    receipt_url: finalReceiptUrl,
    tag: finalTag || 'receipt_created',
    receiptMode,
  });

  const path = '/contacts';
  // Step 1: upsert contact and set fields
  // Persist the exact request bodies into debug for post-mortem
  debug.steps = debug.steps || {};
  debug.steps.create = debug.steps.create || {};
  debug.steps.create.request = { phone: phoneE164, first_name: customerName || 'Customer', actions: fieldActions };
  const createRes = await runRequest(path, { phone: phoneE164, first_name: customerName || 'Customer', actions: fieldActions }, headers);
  debug.steps.create = {
    status: createRes.status,
    bodySnippet: (createRes.text || '').slice(0, 200),
    path,
    bodyError: createRes.bodyError ?? null,
    ok: createRes.ok,
  };
  if (createRes.bodyError && !debug.error) {
    debug.error = typeof createRes.bodyError === 'string' ? createRes.bodyError : JSON.stringify(createRes.bodyError);
  }

  const bodyJson = createRes.json ?? {};
  // capture contact id and full response for debugging
  debug.contactId = bodyJson?.data?.id ?? bodyJson?.id ?? null;
  debug.responseJson = bodyJson;
  debug.steps.create.response = bodyJson;
  const success = Boolean(bodyJson?.success);
  console.info('[chatrace] create contact response', { receiptNumber, phoneE164, status: createRes.status, success });

  // If first step failed, persist debug and return
  if (!createRes.ok || !success) {
    debug.ok = false;
    if (!debug.error) debug.error = 'failed_to_create_or_update_contact';
    await persistDebug(receiptNumber, debug);
    return { ok: false, debug };
  }

  // Step 2: apply tags in a separate request to ensure fields are persisted.
  // Add a short delay to avoid Chatrace evaluating the Flow before fields are indexed.
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  await sleep(300);
  debug.steps.tag = debug.steps.tag || {};
  debug.steps.tag.request = { phone: phoneE164, actions: tagActions };
  const tagRes = await runRequest(path, { phone: phoneE164, actions: tagActions }, headers);
  debug.steps.tag = { status: tagRes.status, bodySnippet: (tagRes.text || '').slice(0, 200), ok: tagRes.ok };
  try {
    const tagJson = tagRes.json ?? null;
    debug.steps.tag.response = tagJson;
  } catch {}

  debug.ok = Boolean(tagRes.ok || createRes.ok);
  await persistDebug(receiptNumber, debug);
  return { ok: debug.ok, debug };
}

async function persistDebug(receiptNumber: string, debug: any) {
  if (process.env.NODE_ENV === 'test') return;
  try {
    const receipt = await prisma.receipt.findFirst({
      where: { OR: [{ id: receiptNumber }, { order: { orderNumber: receiptNumber } }] },
    });
    if (!receipt) return;
    const baseData = typeof receipt.data === 'object' && receipt.data ? { ...(receipt.data as Record<string, unknown>) } : {};
    const existing = typeof baseData.chatrace === 'object' && baseData.chatrace ? { ...(baseData.chatrace as Record<string, unknown>) } : {};
    const next = { ...baseData, chatrace: { ...existing, debug } };
    await prisma.receipt.update({ where: { id: receipt.id }, data: { data: next as Prisma.InputJsonValue } });
  } catch (e) {
    console.error('[chatrace] failed to persist debug', e);
  }
}
