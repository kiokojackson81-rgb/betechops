import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

const BASE_URL = (process.env.CHATRACE_BASE_URL || "").replace(/\/$/, "");
const API_TOKEN = process.env.CHATRACE_API_TOKEN;
const ACCOUNT_ID = process.env.CHATRACE_ACCOUNT_ID;

export type SendReceiptToChatraceInput = {
  phoneE164: string;
  customerName: string;
  receiptNumber: string;
  amount: string;
  currency: string;
  receiptLink: string; // always pass receipt page link
  pdfUrl?: string | null; // optional - only include when available
  tagName: string; // receipt_created_pdf | receipt_created_link
};

function checkConfig() {
  const missing: string[] = [];
  if (!BASE_URL) missing.push("CHATRACE_BASE_URL");
  if (!API_TOKEN) missing.push("CHATRACE_API_TOKEN");
  if (!ACCOUNT_ID) missing.push("CHATRACE_ACCOUNT_ID");
  return missing;
}

export async function pushReceiptToChatrace(input: SendReceiptToChatraceInput): Promise<{ ok: boolean; debug: any }> {
  const { phoneE164, customerName, receiptNumber, amount, currency, receiptLink, pdfUrl, tagName } = input;
  const debug: any = {
    ok: false,
    steps: {},
    contactId: null,
    phoneNormalized: phoneE164,
    receiptLink,
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
  if (!tagName) throw new Error('tagName is required');

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

  async function runRequest(method: string, path: string, body?: unknown) {
    const url = pathWithBase(path);
    const requestHeaders: Record<string, string> = { ...headers };
    if (body && method !== 'GET') {
      requestHeaders['Content-Type'] = 'application/json';
    }
    const init: RequestInit = { method, headers: requestHeaders, body: body ? JSON.stringify(body) : undefined };
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
      const bodyHasError = !!(json && (json.error || json.errors));
      const bodyError = bodyHasError ? (json.error ?? json.errors) : null;
      if (bodyHasError) {
        console.warn('[chatrace][http] response contains error payload', { method, path, url, status: res.status, headerKeys, bodySnippet, bodyError });
      }
      console.info('[chatrace][http]', { method, path, url, status: res.status, headerKeys, bodySnippet });
      console.info('[chatrace][http][debug]', { status: res.status, path, bodySnippet });
      return { ok: res.ok && !bodyHasError, status: res.status, text, json, bodyError };
    } catch (e) {
      const errMessage = String(e);
      console.error('[chatrace][http] failed', { method, path, error: errMessage });
      return { ok: false, status: 0, text: errMessage, json: null, bodyError: errMessage };
    }
  }

  console.info('[chatrace] pushReceipt', {
    receiptNumber,
    phoneE164,
    tagName,
    baseUrl: BASE_URL,
    accountId: ACCOUNT_ID,
    headerKeys,
    env: debug.env,
    receiptLinkLength: receiptLink?.length ?? 0,
    pdfUrlLength: pdfUrl?.length ?? 0,
  });

  // Build actions array: always include receipt_link, only include pdf_url when present
  const actions: any[] = [
    { action: 'set_field_value', field_name: 'customer_name', value: customerName },
    { action: 'set_field_value', field_name: 'order_placed', value: receiptNumber },
    { action: 'set_field_value', field_name: 'amount', value: amount },
    { action: 'set_field_value', field_name: 'currency', value: currency },
    { action: 'set_field_value', field_name: 'receipt_link', value: receiptLink },
  ];
  if (pdfUrl) {
    actions.push({ action: 'set_field_value', field_name: 'pdf_url', value: pdfUrl });
  }
  actions.push({ action: 'add_tag', tag_name: tagName });

  // Use single POST /contacts which supports actions (upsert/create + apply actions)
  try {
    const createPath = '/contacts';
    const createBody: any = {
      phone: phoneE164,
      first_name: customerName || 'Customer',
      actions,
    };
    const createRes = await runRequest('POST', createPath, createBody);
    debug.steps.create = { status: createRes.status, path: createPath, bodySnippet: (createRes.text || '').slice(0, 250), bodyError: createRes.bodyError ?? null };
    if (createRes.bodyError && !debug.error) debug.error = typeof createRes.bodyError === 'string' ? createRes.bodyError : JSON.stringify(createRes.bodyError);
    if (!createRes.ok) {
      debug.ok = false;
      await persistDebug(receiptNumber, debug);
      return { ok: false, debug };
    }

    // parse returned id in common shapes
    const cdata = createRes.json ?? {};
    const contact = cdata?.contact ?? (Array.isArray(cdata?.data) ? cdata.data[0] : cdata) ?? cdata;
    const contactId = contact?.id ?? contact?.contact_id ?? contact?.contactId ?? null;
    if (!contactId) {
      debug.ok = false;
      await persistDebug(receiptNumber, debug);
      return { ok: false, debug };
    }
    debug.contactId = contactId;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[chatrace] failed to create/apply actions', msg);
    debug.ok = false;
    debug.error = debug.error ?? msg;
    await persistDebug(receiptNumber, debug);
    return { ok: false, debug };
  }

  debug.ok = true;
  await persistDebug(receiptNumber, debug);
  return { ok: true, debug };
}

async function persistDebug(receiptNumber: string, debug: any) {
  // During unit tests we avoid hitting the real DB to persist debug
  // (tests mock network calls and don't provision a Prisma DB). Skip
  // persistence if running under the test environment.
  if (process.env.NODE_ENV === 'test') return;

  try {
    // Find receipt by order number (receipt.order.orderNumber may be used elsewhere), receipts use orderId unique; but receiptNumber is orderNumber or id
    // We'll try to find by order number field present on receipt.order.orderNumber or fallback to id
    const receipt = await prisma.receipt.findFirst({ where: { OR: [{ id: receiptNumber }, { order: { orderNumber: receiptNumber } }] } });
    if (!receipt) return;
    const baseData = typeof receipt.data === 'object' && receipt.data ? { ...(receipt.data as Record<string, unknown>) } : {};
    const existing = typeof baseData.chatrace === 'object' && baseData.chatrace ? { ...(baseData.chatrace as Record<string, unknown>) } : {};
    const next = { ...baseData, chatrace: { ...existing, debug } };
    await prisma.receipt.update({ where: { id: receipt.id }, data: { data: next as Prisma.InputJsonValue } });
  } catch (e) {
    console.error('[chatrace] failed to persist debug', e);
  }
}
