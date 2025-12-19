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
  pdfUrl: string;
};

function checkConfig() {
  const missing: string[] = [];
  if (!BASE_URL) missing.push("CHATRACE_BASE_URL");
  if (!API_TOKEN) missing.push("CHATRACE_API_TOKEN");
  if (!ACCOUNT_ID) missing.push("CHATRACE_ACCOUNT_ID");
  return missing;
}

export async function pushReceiptToChatrace(input: SendReceiptToChatraceInput): Promise<{ ok: boolean; debug: any }> {
  const { phoneE164, customerName, receiptNumber, amount, currency, pdfUrl } = input;
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
    },
  };

  if (!phoneE164) throw new Error("phoneE164 is required");
  if (!customerName) throw new Error("customerName is required");
  if (!receiptNumber) throw new Error("receiptNumber is required");
  if (!amount) throw new Error("amount is required");
  if (!currency) throw new Error("currency is required");
  if (!pdfUrl) throw new Error("pdfUrl is required");

  const missingConfig = checkConfig();
  if (missingConfig.length) {
    const message = `Missing Chatrace env vars: ${missingConfig.join(', ')}`;
    console.error('[chatrace] config missing', message);
    debug.error = message;
    await persistDebug(receiptNumber, debug);
    return { ok: false, debug };
  }

  const tagName = 'receipt_created';
  const fieldPayload = {
    customer_name: customerName,
    order_placed: receiptNumber,
    amount,
    currency,
    pdf_url: pdfUrl,
  } as Record<string, unknown>;

  const headers = {
    Authorization: `Bearer ${API_TOKEN}`,
    'Content-Type': 'application/json',
  } as Record<string, string>;

  const accountQuery = `accountId=${encodeURIComponent(ACCOUNT_ID || '')}`;

  const pathWithBase = (path: string) => `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  async function runRequest(method: string, path: string, body?: unknown) {
    const url = pathWithBase(path);
    const init: RequestInit = { method, headers, body: body ? JSON.stringify(body) : undefined };
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
      console.info('[chatrace][http]', { method, path, status: res.status, url: path, bodySnippet: text.slice(0, 200) });
      return { ok: res.ok, status: res.status, text, json };
    } catch (e) {
      const errMessage = String(e);
      console.error('[chatrace][http] failed', { method, path, error: errMessage });
      return { ok: false, status: 0, text: errMessage, json: null };
    }
  }

  const ensureHttps = /^https:\/\//i.test(pdfUrl);
  if (!ensureHttps) {
    debug.pdfUrlWarning = 'pdfUrl should be HTTPS and publicly reachable';
    console.warn('[chatrace] pdfUrl does not look public HTTPS', { pdfUrl });
  }

  console.info('[chatrace] pushReceipt', {
    receiptNumber,
    phoneE164,
    tagName,
    env: debug.env,
    pdfUrlLength: pdfUrl?.length ?? 0,
  });

  const searchPath = `/api/v1/contacts?${accountQuery}&phone=${encodeURIComponent(phoneE164)}`;
  const searchRes = await runRequest('GET', searchPath);
  debug.steps.search = { status: searchRes.status, bodySnippet: (searchRes.text || '').slice(0, 200), path: searchPath };

  let contact: any = null;
  try {
    const data = searchRes.json ?? {};
    if (Array.isArray(data?.contacts) && data.contacts.length) contact = data.contacts[0];
    else if (Array.isArray(data?.data) && data.data.length) contact = data.data[0];
    else if (data?.contact) contact = data.contact;
  } catch {}

  if (!contact) {
    const createPath = '/api/v1/contacts';
    const createRes = await runRequest('POST', createPath, { accountId: ACCOUNT_ID, phone: phoneE164, name: customerName });
    debug.steps.create = {
      status: createRes.status,
      bodySnippet: (createRes.text || '').slice(0, 200),
      path: createPath,
    };
    try {
      const cdata = createRes.json ?? {};
      contact = cdata?.contact ?? cdata?.data ?? cdata;
    } catch {}
    if (!contact || !contact.id) {
      debug.ok = false;
      await persistDebug(receiptNumber, debug);
      return { ok: false, debug };
    }
  }

  const contactId = contact.id;
  debug.contactId = contactId;

  const updatePath = `/api/v1/contacts/${encodeURIComponent(contactId)}`;
  const updateRes = await runRequest('PATCH', updatePath, { accountId: ACCOUNT_ID, custom_fields: fieldPayload });
  debug.steps.updateFields = {
    status: updateRes.status,
    bodySnippet: (updateRes.text || '').slice(0, 200),
    path: updatePath,
  };

  if (!updateRes.ok) {
    debug.ok = false;
    await persistDebug(receiptNumber, debug);
    return { ok: false, debug };
  }

  const tagPath = `/api/v1/contacts/${encodeURIComponent(contactId)}/tags`;
  const tagRes = await runRequest('POST', tagPath, { accountId: ACCOUNT_ID, tag: tagName });
  debug.steps.applyTag = {
    status: tagRes.status,
    bodySnippet: (tagRes.text || '').slice(0, 200),
    path: tagPath,
  };

  if (!tagRes.ok) {
    debug.ok = false;
    await persistDebug(receiptNumber, debug);
    return { ok: false, debug };
  }

  debug.ok = true;
  await persistDebug(receiptNumber, debug);
  return { ok: true, debug };
}

async function persistDebug(receiptNumber: string, debug: any) {
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
