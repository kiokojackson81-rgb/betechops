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

function ensureConfig() {
  if (!BASE_URL) throw new Error("CHATRACE_BASE_URL is not configured");
  if (!API_TOKEN) throw new Error("CHATRACE_API_TOKEN is not configured");
  if (!ACCOUNT_ID) throw new Error("CHATRACE_ACCOUNT_ID is not configured");
}

async function chatraceFetch(path: string, init: RequestInit = {}) {
  ensureConfig();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${BASE_URL}${normalizedPath}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${API_TOKEN}`,
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    const message = bodyText || response.statusText;
    throw new Error(`Chatrace API failed (${response.status}): ${message}`);
  }
  return response.json().catch(() => ({}));
}

async function findContactByPhone(phone: string) {
  const data = await chatraceFetch(`/api/v1/contacts?accountId=${encodeURIComponent(ACCOUNT_ID!)}&phone=${encodeURIComponent(phone)}`);
  if (Array.isArray(data?.contacts) && data.contacts.length) return data.contacts[0];
  if (Array.isArray(data?.data) && data.data.length) return data.data[0];
  if (data?.contact) return data.contact;
  return null;
}

async function createContact(phone: string, name: string) {
  return chatraceFetch("/api/v1/contacts", {
    method: "POST",
    body: JSON.stringify({ accountId: ACCOUNT_ID, phone, name }),
  });
}

async function updateContactFields(contactId: string, payload: Record<string, unknown>) {
  return chatraceFetch(`/api/v1/contacts/${encodeURIComponent(contactId)}`, {
    method: "PATCH",
    body: JSON.stringify({ accountId: ACCOUNT_ID, custom_fields: payload }),
  });
}

async function applyTag(contactId: string, tag: string) {
  return chatraceFetch(`/api/v1/contacts/${encodeURIComponent(contactId)}/tags`, {
    method: "POST",
    body: JSON.stringify({ accountId: ACCOUNT_ID, tag }),
  });
}

export async function pushReceiptToChatrace(input: SendReceiptToChatraceInput): Promise<{ ok: boolean; debug: any }> {
  const { phoneE164, customerName, receiptNumber, amount, currency, pdfUrl } = input;
  const debug: any = { ok: false, steps: {}, contactId: null, phoneNormalized: phoneE164, pdfUrl };
  if (!phoneE164) throw new Error("phoneE164 is required");
  if (!customerName) throw new Error("customerName is required");
  if (!receiptNumber) throw new Error("receiptNumber is required");
  if (!amount) throw new Error("amount is required");
  if (!currency) throw new Error("currency is required");
  if (!pdfUrl) throw new Error("pdfUrl is required");

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

  // Helper to run a fetch and capture response
  async function runRequest(method: string, path: string, body?: unknown) {
    const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
    const init: RequestInit = { method, headers, body: body ? JSON.stringify(body) : undefined };
    let res: Response | null = null;
    let text = '';
    let json: any = null;
    try {
      res = await fetch(url, init as any);
      text = await res.text().catch(() => '');
      try { json = text ? JSON.parse(text) : null; } catch { json = null; }
      return { ok: res.ok, status: res.status, text, json };
    } catch (e) {
      return { ok: false, status: 0, text: String(e), json: null };
    }
  }

  console.info('[chatrace] pushReceipt', { receiptNumber, phoneE164, tagName, CHATRACE_BASE_URL: !!BASE_URL, CHATRACE_ACCOUNT_ID: !!ACCOUNT_ID, tokenPresent: !!API_TOKEN, pdfUrlLength: pdfUrl?.length ?? 0 });

  // 1) Search contact
  const searchPath = `/api/v1/contacts?${accountQuery}&phone=${encodeURIComponent(phoneE164)}`;
  const searchRes = await runRequest('GET', searchPath);
  debug.steps.search = { status: searchRes.status, bodySnippet: (searchRes.text || '').slice(0, 200) };
  console.info('[chatrace][search]', debug.steps.search);

  let contact: any = null;
  try {
    const data = searchRes.json ?? {};
    if (Array.isArray(data?.contacts) && data.contacts.length) contact = data.contacts[0];
    else if (Array.isArray(data?.data) && data.data.length) contact = data.data[0];
    else if (data?.contact) contact = data.contact;
  } catch {}

  // 2) Create contact if not found
  if (!contact) {
    const createRes = await runRequest('POST', '/api/v1/contacts', { accountId: ACCOUNT_ID, phone: phoneE164, name: customerName });
    debug.steps.create = { status: createRes.status, bodySnippet: (createRes.text || '').slice(0, 200) };
    console.info('[chatrace][create]', debug.steps.create);
    try {
      const cdata = createRes.json ?? {};
      contact = cdata?.contact ?? cdata?.data ?? cdata;
    } catch {}
    if (!contact || !contact.id) {
      // persist debug and return
      debug.ok = false;
      await persistDebug(receiptNumber, debug);
      return { ok: false, debug };
    }
  }

  const contactId = contact.id;
  debug.contactId = contactId;

  // 3) Update custom fields
  const updateRes = await runRequest('PATCH', `/api/v1/contacts/${encodeURIComponent(contactId)}`, { accountId: ACCOUNT_ID, custom_fields: fieldPayload });
  debug.steps.updateFields = { status: updateRes.status, bodySnippet: (updateRes.text || '').slice(0, 200) };
  console.info('[chatrace][updateFields]', debug.steps.updateFields);

  if (!updateRes.ok) {
    debug.ok = false;
    await persistDebug(receiptNumber, debug);
    return { ok: false, debug };
  }

  // 4) Apply tag
  const tagRes = await runRequest('POST', `/api/v1/contacts/${encodeURIComponent(contactId)}/tags`, { accountId: ACCOUNT_ID, tag: tagName });
  debug.steps.applyTag = { status: tagRes.status, bodySnippet: (tagRes.text || '').slice(0, 200) };
  console.info('[chatrace][applyTag]', debug.steps.applyTag);

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
