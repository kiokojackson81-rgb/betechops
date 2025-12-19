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
  tagName: string;
};

function checkConfig() {
  const missing: string[] = [];
  if (!BASE_URL) missing.push('CHATRACE_BASE_URL');
  if (!API_TOKEN) missing.push('CHATRACE_API_TOKEN');
  if (!ACCOUNT_ID) missing.push('CHATRACE_ACCOUNT_ID');
  return missing;
}

export async function pushReceiptToChatrace(input: SendReceiptToChatraceInput): Promise<{ ok: boolean; debug: any }> {
  const { phoneE164, customerName, receiptNumber, amount, currency, receiptLink, pdfUrl, tagName } = input;
  const debug: any = {
    ok: false,
    steps: {},
    contactId: null,
    phoneNormalized: phoneE164,
    pdfUrl,
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

  async function runRequest(path: string, body: unknown) {
    const url = pathWithBase(path);
    const init: RequestInit = {
      method: 'POST',
      headers: {
        ...headers,
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

  console.info('[chatrace] pushReceipt', {
    receiptNumber,
    phoneE164,
    tagName,
    baseUrl: BASE_URL,
    accountId: ACCOUNT_ID,
    headerKeys,
    pdfUrlLength: pdfUrl?.length ?? 0,
    receiptLinkLength: receiptLink.length,
  });

  const payload = {
    phone: phoneE164,
    first_name: customerName,
    actions: [
      { action: 'add_tag', tag_name: tagName },
      { action: 'set_field_value', field_name: 'receipt_number', value: receiptNumber },
      { action: 'set_field_value', field_name: 'amount', value: amount },
      { action: 'set_field_value', field_name: 'receipt_link', value: receiptLink },
      ...(pdfUrl ? [{ action: 'set_field_value', field_name: 'receipt_url', value: pdfUrl }] : []),
    ],
  };

  const createPath = '/contacts';
  const createRes = await runRequest(createPath, payload);
  debug.steps.create = {
    status: createRes.status,
    bodySnippet: (createRes.text || '').slice(0, 200),
    path: createPath,
    bodyError: createRes.bodyError ?? null,
  };
  if (createRes.bodyError && !debug.error) {
    debug.error =
      typeof createRes.bodyError === 'string'
        ? createRes.bodyError
        : JSON.stringify(createRes.bodyError);
  }

  const json = createRes.json ?? {};
  const success = Boolean(json?.success);
  const contactCreated = json?.contact_created ?? json?.data?.contact_created ?? false;
  console.info('[chatrace] create contact response', {
    receiptNumber,
    phoneE164,
    status: createRes.status,
    success,
    contactCreated,
  });

  if (createRes.ok && success) {
    debug.ok = true;
    await persistDebug(receiptNumber, debug);
    return { ok: true, debug };
  }

  debug.ok = false;
  if (!debug.error) {
    debug.error = `Chatrace responded with success=${success} contact_created=${contactCreated}`;
  }
  await persistDebug(receiptNumber, debug);
  return { ok: false, debug };
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
