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

export async function pushReceiptToChatrace(input: SendReceiptToChatraceInput): Promise<void> {
  const { phoneE164, customerName, receiptNumber, amount, currency, pdfUrl } = input;
  if (!phoneE164) throw new Error("phoneE164 is required");
  if (!customerName) throw new Error("customerName is required");
  if (!receiptNumber) throw new Error("receiptNumber is required");
  if (!amount) throw new Error("amount is required");
  if (!currency) throw new Error("currency is required");
  if (!pdfUrl) throw new Error("pdfUrl is required");

  console.info(`[chatrace] send receipt ${receiptNumber} to ${phoneE164}`);
  let contact: any = await findContactByPhone(phoneE164);
  if (!contact) {
    const created = await createContact(phoneE164, customerName);
    contact = created?.contact ?? created?.data ?? created;
    if (!contact?.id) {
      throw new Error("Chatrace contact creation response missing id");
    }
  }
  const contactId = contact.id;
  await updateContactFields(contactId, {
    customer_name: customerName,
    order_placed: receiptNumber,
    amount,
    currency,
    pdf_url: pdfUrl,
  });
  await applyTag(contactId, "receipt_created");
}
