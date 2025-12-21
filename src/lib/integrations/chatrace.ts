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
  pdfUrl?: string;
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
    pdfUrl,
    receiptId,
    tagName,
  } = input;
  const pdfUrlTrimmed = pdfUrl?.trim();
  const debug: any = {
    ok: false,
    steps: {},
    contactId: null,
    phoneNormalized: phoneE164,
    pdfUrlPresent: !!pdfUrlTrimmed,
    pdfUrlLength: pdfUrlTrimmed?.length ?? 0,
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

  const finalTag = tagName?.trim() || 'receipt_created';

  // Hard-fail rule: require a .pdf URL for receipt_url/pdf_url. If absent or not a .pdf, log and abort.
  const abort = async (message: string) => {
    console.error('[chatrace] abort:', message, { receiptNumber, pdfUrl: pdfUrlTrimmed });
    debug.error = message;
    await persistDebug(receiptNumber, debug);
    return { ok: false, debug };
  };

  const looksLikePdf = typeof pdfUrlTrimmed === 'string' && /\.pdf(\?|$)/i.test(pdfUrlTrimmed);
  if (!looksLikePdf) {
    return abort('pdfUrl is missing or not a .pdf URL');
  }

  const setField = (fieldName: string, value: any) => ({
    action: 'set_custom_field',
    field_id: fieldName,
    value: value == null ? '' : String(value),
  });

  const USE_SET_FIELD_VALUE = false;
  const setFieldCompat = (fieldName: string, value: any) =>
    USE_SET_FIELD_VALUE
      ? { action: 'set_field_value', field_name: fieldName, value: value == null ? '' : String(value) }
      : setField(fieldName, value);

  const fieldActions: any[] = [];
  fieldActions.push(setFieldCompat('pdf_url', pdfUrlTrimmed));
  fieldActions.push(setFieldCompat('receipt_url', pdfUrlTrimmed));
  fieldActions.push(setFieldCompat('customer_name', customerName || 'Customer'));
  fieldActions.push(setFieldCompat('order_placed', receiptNumber));
  fieldActions.push(setFieldCompat('amount', amount));
  fieldActions.push(setFieldCompat('currency', currency || 'KES'));
  if (receiptId) {
    fieldActions.push(setFieldCompat('receipt_id', receiptId));
  }
  const tagAction = { action: 'add_tag', tag_name: finalTag };

  const fieldsPayload = {
    phone: phoneE164,
    first_name: customerName || 'Customer',
    actions: fieldActions,
  };

  const tagPayload = {
    phone: phoneE164,
    actions: [tagAction],
  };

  debug.payloadPreview = {
    phone: phoneE164,
    first_name: customerName || 'Customer',
    actionsCount: fieldActions.length,
    tag: finalTag,
    hasPdfUrl: !!pdfUrlTrimmed,
  };

  console.info('[chatrace] pushReceipt', {
    receiptNumber,
    phoneE164,
    tagName: finalTag,
    baseUrl: BASE_URL,
    accountId: ACCOUNT_ID,
    headerKeys,
    pdfUrlLength: pdfUrlTrimmed?.length ?? 0,
    receiptLinkLength: receiptLink.length,
  });

  const fieldsPath = '/contacts';
  const fieldsRes = await runRequest(fieldsPath, fieldsPayload, headers);
  debug.steps.fields = {
    status: fieldsRes.status,
    bodySnippet: (fieldsRes.text || '').slice(0, 200),
    path: fieldsPath,
    bodyError: fieldsRes.bodyError ?? null,
    ok: fieldsRes.ok,
  };
  if (fieldsRes.bodyError && !debug.error) {
    debug.error =
      typeof fieldsRes.bodyError === 'string'
        ? fieldsRes.bodyError
        : JSON.stringify(fieldsRes.bodyError);
  }
  if (!fieldsRes.ok) {
    return abort('chatrace_fields_failed');
  }

  const fieldsJson = fieldsRes.json ?? {};
  const fieldsSuccess = Boolean(fieldsJson?.success);
  const contactCreated =
    fieldsJson?.contact_created ?? fieldsJson?.data?.contact_created ?? false;
  console.info('[chatrace] create contact response', {
    receiptNumber,
    phoneE164,
    status: fieldsRes.status,
    success: fieldsSuccess,
    contactCreated,
  });

  const tagPath = '/contacts';
  const tagRes = await runRequest(tagPath, tagPayload, headers);
  debug.steps.tag = {
    status: tagRes.status,
    bodySnippet: (tagRes.text || '').slice(0, 200),
    path: tagPath,
    bodyError: tagRes.bodyError ?? null,
    ok: tagRes.ok,
  };
  if (tagRes.bodyError && !debug.error) {
    debug.error =
      typeof tagRes.bodyError === 'string'
        ? tagRes.bodyError
        : JSON.stringify(tagRes.bodyError);
  }
  if (!tagRes.ok) {
    return abort('chatrace_tag_failed');
  }

  const tagJson = tagRes.json ?? {};
  const success = Boolean(fieldsRes.ok && tagRes.ok && (tagJson?.success ?? true));
  debug.ok = success;
  await persistDebug(receiptNumber, debug);
  return { ok: success, debug };
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
