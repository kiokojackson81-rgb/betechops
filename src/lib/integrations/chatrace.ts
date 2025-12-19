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
      baseUrl: BASE_URL,
      accountId: ACCOUNT_ID,
      headerKeys: [],
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
    'X-ACCESS-TOKEN': API_TOKEN || '',
    Accept: 'application/json',
  } as Record<string, string>;
  const headerKeys = Object.keys(headers);
  debug.env.headerKeys = headerKeys;

  const accountQuery = `accountId=${encodeURIComponent(ACCOUNT_ID || '')}`;

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
      // If the backend returns an error object in the JSON body (some endpoints
      // return HTTP 200 but include an `error` object), treat that as a failure
      // so callers don't proceed as if the request succeeded.
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

  const ensureHttps = /^https:\/\//i.test(pdfUrl);
  if (!ensureHttps) {
    debug.pdfUrlWarning = 'pdfUrl should be HTTPS and publicly reachable';
    console.warn('[chatrace] pdfUrl does not look public HTTPS', { pdfUrl });
  }

  console.info('[chatrace] pushReceipt', {
    receiptNumber,
    phoneE164,
    tagName,
    baseUrl: BASE_URL,
    accountId: ACCOUNT_ID,
    headerKeys,
    env: debug.env,
    pdfUrlLength: pdfUrl?.length ?? 0,
  });

  // Use documented Chatrace endpoints: find by custom field (phone)
  // GET /contacts/find?field_id=phone&value={phone}
  const searchPath = `/contacts/find?field_id=phone&value=${encodeURIComponent(phoneE164)}`;
  let searchRes = await runRequest('GET', searchPath);
  debug.steps.search = { status: searchRes.status, bodySnippet: (searchRes.text || '').slice(0, 200), path: searchPath, bodyError: searchRes.bodyError ?? null };
  if (searchRes.bodyError && !debug.error) debug.error = typeof searchRes.bodyError === 'string' ? searchRes.bodyError : JSON.stringify(searchRes.bodyError);

  // If the response contained an error payload (some deployments return
  // HTTP 200 with { error: ... }), attempt common alternative paths/param
  // names and record attempts so we can diagnose endpoint mismatches.
  if (!searchRes.ok && searchRes.bodyError && (searchRes.bodyError?.code === 404 || searchRes.status === 200)) {
    const altAttempts: any[] = [];
    const candidates = [
      `/api/v1/contacts?${accountQuery}&phone=${encodeURIComponent(phoneE164)}`,
      `/v1/contacts?account_id=${encodeURIComponent(ACCOUNT_ID || '')}&phone=${encodeURIComponent(phoneE164)}`,
      `/api/v1/contacts?account_id=${encodeURIComponent(ACCOUNT_ID || '')}&phone=${encodeURIComponent(phoneE164)}`,
    ];
    for (const p of candidates) {
      const r = await runRequest('GET', p);
      altAttempts.push({ path: p, status: r.status, ok: r.ok, bodyError: r.bodyError ?? null, snippet: (r.text || '').slice(0, 200) });
      if (r.ok) {
        searchRes = r;
        debug.steps.search = { status: searchRes.status, bodySnippet: (searchRes.text || '').slice(0, 200), path: p, bodyError: searchRes.bodyError ?? null };
        break;
      }
    }
    if (altAttempts.length) debug.steps.search.alternatives = altAttempts;
    if (searchRes.bodyError && !debug.error) debug.error = typeof searchRes.bodyError === 'string' ? searchRes.bodyError : JSON.stringify(searchRes.bodyError);
  }

  let contact: any = null;
  try {
    const data = searchRes.json ?? {};
    if (Array.isArray(data?.contacts) && data.contacts.length) contact = data.contacts[0];
    else if (Array.isArray(data?.data) && data.data.length) contact = data.data[0];
    else if (data?.contact) contact = data.contact;
  } catch {}

  if (!contact) {
    // Create a contact using the documented body + actions so we can set tags and fields in one request
    const createPath = '/contacts';
    const createBody: any = {
      phone: phoneE164,
      first_name: customerName,
      actions: [
        { action: 'add_tag', tag_name: tagName },
        { action: 'set_field_value', field_name: 'receipt_number', value: receiptNumber },
        { action: 'set_field_value', field_name: 'amount', value: amount },
        { action: 'set_field_value', field_name: 'receipt_url', value: pdfUrl },
      ],
    };
    const createRes = await runRequest('POST', createPath, createBody);
    debug.steps.create = {
      status: createRes.status,
      bodySnippet: (createRes.text || '').slice(0, 200),
      path: createPath,
      bodyError: createRes.bodyError ?? null,
    };
    if (createRes.bodyError && !debug.error) debug.error = typeof createRes.bodyError === 'string' ? createRes.bodyError : JSON.stringify(createRes.bodyError);
    try {
      const cdata = createRes.json ?? {};
      // create may return the created contact directly or under data/contact
      contact = cdata?.contact ?? (Array.isArray(cdata?.data) ? cdata.data[0] : cdata?.data) ?? cdata;
    } catch {}

    // If create didn't return contact id, try to re-run find by phone to fetch id
    if ((!contact || !contact.id) && createRes.ok) {
      const reFindRes = await runRequest('GET', `/contacts/find?field_id=phone&value=${encodeURIComponent(phoneE164)}`);
      debug.steps.create.followupFind = { status: reFindRes.status, bodySnippet: (reFindRes.text || '').slice(0,200), path: `/contacts/find?field_id=phone&value=${encodeURIComponent(phoneE164)}`, bodyError: reFindRes.bodyError ?? null };
      try {
        const d = reFindRes.json ?? {};
        contact = Array.isArray(d?.data) && d.data.length ? d.data[0] : (d?.contact ?? null);
      } catch {}
    }

    if (!contact || !contact.id) {
      debug.ok = false;
      await persistDebug(receiptNumber, debug);
      return { ok: false, debug };
    }
  }

  const contactId = contact.id;
  debug.contactId = contactId;

  // Apply tag and update fields via documented actions endpoint
  const actionsPath = `/contacts/${encodeURIComponent(contactId)}`;
  const actionsBody = {
    actions: [
      { action: 'set_field_value', field_name: 'receipt_number', value: receiptNumber },
      { action: 'set_field_value', field_name: 'amount', value: amount },
      { action: 'set_field_value', field_name: 'receipt_url', value: pdfUrl },
      { action: 'add_tag', tag_name: tagName },
    ],
  } as Record<string, unknown>;
  const actionsRes = await runRequest('POST', actionsPath, actionsBody);
  debug.steps.applyActions = {
    status: actionsRes.status,
    bodySnippet: (actionsRes.text || '').slice(0, 200),
    path: actionsPath,
    bodyError: actionsRes.bodyError ?? null,
  };
  if (actionsRes.bodyError && !debug.error) debug.error = typeof actionsRes.bodyError === 'string' ? actionsRes.bodyError : JSON.stringify(actionsRes.bodyError);

  if (!actionsRes.ok) {
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
