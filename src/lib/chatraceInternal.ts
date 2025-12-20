import { randomUUID } from "crypto";

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

type ChatraceStep = { status: number; ok: boolean; bodySnippet: string };

async function postJson(url: string, token: string, body: unknown): Promise<ChatraceStep> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-ACCESS-TOKEN": token,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text().catch(() => "");
  return { status: res.status, ok: res.ok, bodySnippet: snippet(raw) };
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
  receiptNumber: string;
  amount: string;
  paymentMethod: string;
  createdBy: string;
  itemsText: string;
  receiptLink: string;
  receiptPdfUrl?: string | null;
  requestId?: string;
}) {
  const rid = input.requestId || randomUUID();
  const env = getEnv();
  const debug = makeDebug(rid, env);
  if (!env.enabled) return { ok: true, debug: { ...debug, ok: true, skipped: "disabled" } };
  if (!env.envOk) return { ok: false, debug: { ...debug, error: "missing_internal_env" } };

  const actions = [
    { action: "set_field_value", field_name: "admin_receipt_number", value: input.receiptNumber },
    { action: "set_field_value", field_name: "admin_amount", value: input.amount },
    { action: "set_field_value", field_name: "admin_payment_method", value: input.paymentMethod },
    { action: "set_field_value", field_name: "admin_created_by", value: input.createdBy },
    { action: "set_field_value", field_name: "admin_items", value: input.itemsText },
    { action: "set_field_value", field_name: "admin_receipt_link", value: input.receiptLink },
    ...(input.receiptPdfUrl
      ? [{ action: "set_field_value", field_name: "admin_receipt_pdf", value: input.receiptPdfUrl }]
      : []),
    { action: "add_tag", tag_name: "receipt_admin_alert" },
  ];

  const payload = {
    phone: env.adminPhone,
    actions,
  };
  const url = `${env.baseUrl.replace(/\/$/, "")}${CONTACTS_PATH}`;
  const step = await postJson(url, env.token, payload);
  debug.steps.createOrUpdate = step;
  debug.ok = step.ok;
  return { ok: step.ok, debug };
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
