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
    const init: RequestInit = {
      method: 'POST',
      headers: {
        ...hdrs,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    };
    let res: Response | null = null;
    let text = '';
    let json: any = null;
    try {
      res = await fetch(url, init as any);
      text = await res.text().catch(() => '');
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      const bodySnippet = (text || '').slice(0, 200);
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
      console.info('[chatrace][http][debug]', { status: res.status, path, bodySnippet });
      return { ok: res.ok, status: res.status, text, json, bodyError };
    } catch (e) {
      const errMessage = String(e);
      console.error('[chatrace][http] failed', { method: 'POST', path, error: errMessage });
      return { ok: false, status: 0, text: errMessage, json: null, bodyError: errMessage };
    }
  }

  const ensureHttps = /^https:\/\//i.test(receiptLink);
  if (!ensureHttps) {
    debug.pdfUrlWarning = 'receiptLink should be HTTPS and publicly reachable';
    console.warn('[chatrace] receiptLink does not look public HTTPS', { receiptLink });
  }

  const finalTag = tagName?.trim() || '';

  const setFieldValue = (fieldName: string, value: any) => ({
    action: 'set_field_value',
    field_name: fieldName,
    value: value == null ? '' : String(value),
  });

  const actions: any[] = [];
  const receiptMode = receiptUrlTrimmed ? 'pdf' : 'link';
  if (receiptUrlTrimmed) {
    actions.push(setFieldValue('receipt_url', receiptUrlTrimmed));
    actions.push(setFieldValue('media_url', receiptUrlTrimmed));
    actions.push(setFieldValue('receipt_pdf_url', receiptUrlTrimmed));
    actions.push(setFieldValue('file_url', receiptUrlTrimmed));
  }

  actions.push(setFieldValue('customer_name', customerName || 'Customer'));
  actions.push(setFieldValue('order_placed', receiptNumber));
  actions.push(setFieldValue('amount', amount));
  actions.push(setFieldValue('currency', currency || 'KES'));
  if (receiptId) {
    actions.push(setFieldValue('receipt_id', receiptId));
  }
  actions.push(setFieldValue('receipt_channel', 'customer'));

  const tagToApply =
    finalTag || (receiptMode === 'pdf' ? 'receipt_created_pdf' : 'receipt_created_link');
  actions.push({ action: 'add_tag', tag_name: tagToApply });

  debug.payloadPreview = {
    phone: phoneE164,
    first_name: customerName || 'Customer',
    actionsCount: actions.length,
    tag: tagToApply,
    hasReceiptUrl: !!receiptUrlTrimmed,
    receiptMode,
  };

  console.info('[chatrace] pushReceipt', {
    receiptNumber,
    phoneE164,
    tagName: finalTag,
    baseUrl: BASE_URL,
    accountId: ACCOUNT_ID,
    headerKeys,
    receiptUrlLength: receiptUrlTrimmed?.length ?? 0,
    receiptMode,
    receiptUrlSnippet: receiptUrlTrimmed ? receiptUrlTrimmed.slice(0, 120) : '',
    tagToApply,
  });

  const path = '/contacts';
  const createRes = await runRequest(path, { phone: phoneE164, first_name: customerName || 'Customer', actions }, headers);
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

  debug.ok = Boolean(createRes.ok && success);
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
