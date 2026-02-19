import { randomUUID } from "crypto";
import { prisma } from '@/lib/prisma';

type ChatraceInternalConfig = {
  baseUrl: string;
  accountId: string;
  token: string;
  adminPhone: string;
  enabled: boolean;
};

function getEnv(): ChatraceInternalConfig & { envOk: boolean } {
  const baseUrl = process.env.CHATRACE_INTERNAL_BASE_URL || "https://api.chatrace.com";
  const accountId = process.env.CHATRACE_INTERNAL_ACCOUNT_ID || "";
  const token = process.env.CHATRACE_INTERNAL_API_TOKEN || "";
  const adminPhone = process.env.CHATRACE_INTERNAL_ADMIN_PHONE || "";
  const enabled = process.env.CHATRACE_INTERNAL_ENABLED === "1";
  const envOk = Boolean(baseUrl && accountId && token && adminPhone);
  return { baseUrl, accountId, token, adminPhone, enabled, envOk };
}

function snippet(text: string, max = 220) {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

type ChatraceStep = { status: number; ok: boolean; bodySnippet: string; raw?: string; json?: any };

async function postJson(url: string, token: string, body: unknown, rid?: string): Promise<ChatraceStep> {
  const timeoutMs = 8_000;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "X-ACCESS-TOKEN": token,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    clearTimeout(id);
    const raw = await res.text().catch(() => "");
    let parsed: any = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }

    if (!res.ok) {
      console.error('[chatrace][internal][http] non-2xx', {
        rid: rid || null,
        url,
        status: res.status,
        bodySnippet: snippet(raw, 500),
      });
    }

    return { status: res.status, ok: res.ok, bodySnippet: snippet(raw), raw, json: parsed };
  } catch (e: any) {
    clearTimeout(id);
    const stack = e && e.stack ? e.stack : String(e);
    console.error('[chatrace][internal][http] exception', { rid: rid || null, url, stack });
    const err = String(e);
    return { status: 0, ok: false, bodySnippet: snippet(err), raw: err, json: null };
  }
}

function makeDebug(rid: string, env: ReturnType<typeof getEnv>) {
  return {
    ok: false,
    rid,
    enabled: env.enabled,
    env: {
      baseUrlPresent: Boolean(env.baseUrl),
      accountIdPresent: Boolean(env.accountId),
      tokenPresent: Boolean(env.token),
      adminPhonePresent: Boolean(env.adminPhone),
    },
    steps: {} as Record<string, ChatraceStep>,
  };
}

const CONTACTS_PATH = "/contacts";

export async function pushInternalReceiptAlert(input: {
  // Optional override: send to a different internal recipient (e.g. follow-up responsible).
  // Value must be numeric-only (E.164 without +), e.g. "2547...".
  toPhone?: string;
  // Tag to trigger a specific Flow.
  tagName?: string;
  receiptNumber: string;
  amount: string;
  paymentMethod: string;
  createdBy: string;
  itemsText: string;
  // Optional fields for newer admin templates (snake_case fields)
  customerName?: string;
  customerPhone?: string;
  formattedAmount?: string | number;
  itemsSummary?: string;
  itemsCount?: number;
  totalSalesToday?: string | number;
  podPendingCount?: string | number;
  podPendingTotal?: string | number;
  podPendingList?: string;
  receiptLink?: string; // kept for caller compatibility, ignored in payload
  receiptPdfUrl?: string | null; // kept for caller compatibility, ignored in payload
  requestId?: string;
}) {
  const rid = input.requestId || randomUUID();
  const env = getEnv();
  const debug = makeDebug(rid, env);
  if (!env.enabled) return { ok: true, debug: { ...debug, ok: true, skipped: "disabled" } };
  if (!env.envOk) return { ok: false, debug: { ...debug, error: "missing_internal_env" } };

  // If caller passed URLs, explicitly ignore them for internal alerts and log that fact
  if (input.receiptLink) {
    console.info('[internal][adminAlert] ignoring receiptLink (static button in WA template)', { receiptNumber: input.receiptNumber });
  }
  if ((input as any).receiptPdfUrl) {
    console.info('[internal][adminAlert] ignoring receiptPdfUrl for internal alert', { receiptNumber: input.receiptNumber });
  }

  const tagName = (input.tagName || "receipt_admin_alert").trim();
  const itemsSummary = (input.itemsSummary ?? input.itemsText ?? '').toString();

  // Some Chatrace instances configure these custom fields as "Number".
  // If so, sending non-numeric strings may result in blank values.
  const toDigitsOrEmpty = (value?: string) => {
    const raw = (value ?? '').toString().trim();
    if (!raw) return '';
    const digits = raw.replace(/[^0-9]/g, '');
    return digits;
  };
  const toNumberStringOrEmpty = (value?: string | number) => {
    if (value == null) return '';
    const n = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? String(Math.round(n)) : '';
  };
  const actions = [
    // Legacy/internal field names (keep for backwards compatibility)
    { action: "set_field_value", field_name: "admin_receipt_number", value: input.receiptNumber },
    { action: "set_field_value", field_name: "admin_amount", value: input.amount },
    { action: "set_field_value", field_name: "admin_payment_method", value: input.paymentMethod },
    { action: "set_field_value", field_name: "admin_created_by", value: input.createdBy },
    { action: "set_field_value", field_name: "admin_items", value: itemsSummary },

    // Newer admin WhatsApp template field names (must match Chatrace Flow mapping)
    { action: "set_field_value", field_name: "receipt_number", value: input.receiptNumber },
    { action: "set_field_value", field_name: "customer_name", value: input.customerName ?? "Customer" },
    { action: "set_field_value", field_name: "customer_phone", value: toDigitsOrEmpty(input.customerPhone) },
    // Keep both "amount"+"currency" and "formatted_amount" for template compatibility.
    { action: "set_field_value", field_name: "amount", value: toNumberStringOrEmpty(input.formattedAmount ?? input.amount) },
    { action: "set_field_value", field_name: "currency", value: "KES" },
    { action: "set_field_value", field_name: "formatted_amount", value: toNumberStringOrEmpty(input.formattedAmount ?? input.amount) },
    { action: "set_field_value", field_name: "payment_method", value: input.paymentMethod },
    { action: "set_field_value", field_name: "created_by", value: input.createdBy },
    // If items_summary is configured as Number, store item count and use admin_items for the text list.
    { action: "set_field_value", field_name: "items_summary", value: toNumberStringOrEmpty(input.itemsCount ?? '') },
    { action: "set_field_value", field_name: "total_sales_today", value: toNumberStringOrEmpty(input.totalSalesToday) },

    // POD stats used by admin/follow-up templates
    { action: "set_field_value", field_name: "pod_pending_count", value: toNumberStringOrEmpty(input.podPendingCount) },
    { action: "set_field_value", field_name: "pod_pending_total", value: toNumberStringOrEmpty(input.podPendingTotal) },
    { action: "set_field_value", field_name: "pod_pending_list", value: (input.podPendingList ?? "").toString() },

    { action: "add_tag", tag_name: tagName },
  ];

  // IMPORTANT: prove what's being sent to Chatrace for auditing (fields + tag)
  try {
    console.info('[internal][adminAlert] outbound', {
      phone: input.toPhone || env.adminPhone,
      fields: actions.filter((a: any) => a.action === 'set_field_value').map((a: any) => a.field_name),
      hasPdfUrl: Boolean((input as any).receiptPdfUrl),
      hasLink: Boolean((input as any).receiptLink),
      tag: tagName,
    });
  } catch (e) {
    console.warn('[internal][adminAlert] failed to log outbound_actions', String(e));
  }

  const toPhone = (input.toPhone || env.adminPhone || "").toString().trim();
  if (!toPhone) return { ok: false, debug: { ...debug, error: "missing_internal_recipient_phone" } };
  const payload = { phone: toPhone, actions };
  const url = `${env.baseUrl.replace(/\/$/, "")}${CONTACTS_PATH}`;
  const step = await postJson(url, env.token, payload, rid);
  try {
    console.info('[internal][adminAlert] response', {
      status: step.status,
      ok: step.ok,
      snippet: step.bodySnippet,
      json: step.json ?? null,
      rawHead: step.raw ? (step.raw.length > 500 ? step.raw.slice(0, 500) : step.raw) : null,
    });
  } catch (e) {
    console.warn('[internal][adminAlert] failed to log response', String(e));
  }
  debug.steps.createOrUpdate = step;
  debug.ok = step.ok;
  // persist debug to DB for later inspection
  try {
    await persistInternalDebug(input.receiptNumber, rid, debug);
  } catch (e) {
    console.error('[internal][adminAlert] persist debug failed', String(e));
  }
  return { ok: step.ok, debug };
}

async function persistInternalDebug(receiptNumber: string, rid: string, debug: any) {
  if (process.env.NODE_ENV === 'test') return;
  try {
    const receipt = await prisma.receipt.findFirst({
      where: { OR: [{ id: receiptNumber }, { order: { orderNumber: receiptNumber } }] },
    });
    if (!receipt) return;
    const baseData = typeof receipt.data === 'object' && receipt.data ? { ...(receipt.data as Record<string, unknown>) } : {};
    const existing = typeof baseData.chatrace === 'object' && baseData.chatrace ? { ...(baseData.chatrace as Record<string, unknown>) } : {};
    const next = { ...baseData, chatrace: { ...existing, internal: { ...(existing.internal || {}), [rid]: debug } } };
    await prisma.receipt.update({ where: { id: receipt.id }, data: { data: next as any } });
  } catch (e) {
    console.error('[chatrace][internal] failed to persist debug', e);
  }
}

export async function pushInternalDailySummary(input: {
  dateLabel: string;
  totalReceipts: string;
  totalSales: string;
  totalProfit: string;
  totalMpesa: string;
  totalCash: string;
  requestId?: string;
}) {
  const rid = input.requestId || randomUUID();
  const env = getEnv();
  const debug = makeDebug(rid, env);
  if (!env.enabled) return { ok: true, debug: { ...debug, ok: true, skipped: "disabled" } };
  if (!env.envOk) return { ok: false, debug: { ...debug, error: "missing_internal_env" } };

  const payload = {
    phone: env.adminPhone,
    actions: [
      { action: "set_field_value", field_name: "summary_date", value: input.dateLabel },
      { action: "set_field_value", field_name: "summary_total_receipts", value: input.totalReceipts },
      { action: "set_field_value", field_name: "summary_total_sales", value: input.totalSales },
      { action: "set_field_value", field_name: "summary_total_profit", value: input.totalProfit },
      { action: "set_field_value", field_name: "summary_total_mpesa", value: input.totalMpesa },
      { action: "set_field_value", field_name: "summary_total_cash", value: input.totalCash },
      { action: "add_tag", tag_name: "daily_receipt_summary" },
    ],
  };
  const url = `${env.baseUrl.replace(/\/$/, "")}${CONTACTS_PATH}`;
  const step = await postJson(url, env.token, payload);
  debug.steps.createOrUpdate = step;
  debug.ok = step.ok;
  return { ok: step.ok, debug };
}
