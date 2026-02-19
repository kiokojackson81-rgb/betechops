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

function normalizeRecipientPhone(value: string) {
  const raw = (value ?? "").toString().trim();
  if (!raw) return "";
  if (raw.startsWith("+")) return raw;
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (digits.startsWith("254")) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+254${digits.slice(1)}`;
  return digits; // best-effort fallback
}

async function postJson(
  url: string,
  token: string,
  body: unknown,
  opts?: { rid?: string; accountId?: string },
): Promise<ChatraceStep> {
  const timeoutMs = 8_000;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = {
      "X-ACCESS-TOKEN": token,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    if (opts?.accountId) headers["X-ACCOUNT-ID"] = String(opts.accountId);
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers,
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
        rid: opts?.rid || null,
        url,
        status: res.status,
        bodySnippet: snippet(raw, 500),
      });
    }

    return { status: res.status, ok: res.ok, bodySnippet: snippet(raw), raw, json: parsed };
  } catch (e: any) {
    clearTimeout(id);
    const stack = e && e.stack ? e.stack : String(e);
    console.error('[chatrace][internal][http] exception', { rid: opts?.rid || null, url, stack });
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
  const podAdminTag = (process.env.CHATRACE_INTERNAL_POD_ADMIN_TAG || 'pod_receipt_admin_alert').toString().trim();
  const podFollowupTag = (process.env.CHATRACE_INTERNAL_POD_FOLLOWUP_TAG || 'pod_followup_alert').toString().trim();
  const isPodInternalTag = tagName === podAdminTag || tagName === podFollowupTag;

  // Some Chatrace instances configure these custom fields as "Number".
  // If so, sending non-numeric strings may result in blank values.
  const toDigitsOrEmpty = (value?: string) => {
    const raw = (value ?? '').toString().trim();
    if (!raw) return '';
    const digits = raw.replace(/[^0-9]/g, '');
    return digits;
  };
  const toNumberStringOrZero = (value?: string | number) => {
    if (value == null) return '0';
    const n = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? String(Math.round(n)) : '0';
  };
  const FORCE_RETRIGGER_TAGS = new Set([
    'pod_receipt_admin_alert',
    'pod_followup_alert',
    'followup_responsible_alert', // legacy
    // legacy/internal
    'receipt_admin_alert',
  ]);
  const forceRetrigger =
    process.env.CHATRACE_INTERNAL_FORCE_RETRIGGER_TAGS === '1' || FORCE_RETRIGGER_TAGS.has(tagName);

  const safeCustomerName = (input.customerName ?? '').toString().trim() || 'Customer';
  const safeReceiptNumber = (input.receiptNumber ?? '').toString().trim();
  const safeCreatedBy = (input.createdBy ?? '').toString().trim() || '(unknown)';
  const safeAdminItems = itemsSummary.trim() || 'Items: (not available)';
  const safeCustomerPhone = toDigitsOrEmpty((input.customerPhone ?? '').toString());
  const safeFormattedAmount = toNumberStringOrZero(input.formattedAmount ?? input.amount);
  const safePodPendingCount = toNumberStringOrZero(input.podPendingCount ?? 0);
  const safePodPendingTotal = toNumberStringOrZero(input.podPendingTotal ?? 0);
  const safePodPendingList = (input.podPendingList ?? '').toString().trim() || 'None';

  // Internal validation for POD flows: if key fields are missing, do not apply the tag.
  if (isPodInternalTag) {
    if (!safeReceiptNumber) throw new Error('Missing required POD fields: receipt_number');
    if (!safeCustomerName) throw new Error('Missing required POD fields: customer_name');
  }

  // Build actions in two phases:
  // 1) set_field_value actions (contact upsert + field updates)
  // 2) tag actions (remove/add tag) to trigger the flow after fields exist
  const fieldActions: any[] = [];

  if (isPodInternalTag) {
    // Strict field naming for POD templates (no aliases, no curly braces).
    fieldActions.push({ action: "set_field_value", field_name: "customer_name", value: safeCustomerName });
    fieldActions.push({ action: "set_field_value", field_name: "customer_phone", value: safeCustomerPhone });
    fieldActions.push({ action: "set_field_value", field_name: "receipt_number", value: safeReceiptNumber });
    fieldActions.push({ action: "set_field_value", field_name: "formatted_amount", value: safeFormattedAmount });
    fieldActions.push({ action: "set_field_value", field_name: "created_by", value: safeCreatedBy });
    fieldActions.push({ action: "set_field_value", field_name: "admin_items", value: safeAdminItems });
    fieldActions.push({ action: "set_field_value", field_name: "pod_pending_count", value: safePodPendingCount });
    if (tagName === podAdminTag) {
      fieldActions.push({ action: "set_field_value", field_name: "pod_pending_total", value: safePodPendingTotal });
    }
    if (tagName === podFollowupTag) {
      fieldActions.push({ action: "set_field_value", field_name: "pod_pending_list", value: safePodPendingList });
    }
  } else {
    // Legacy/internal field names (keep for backwards compatibility)
    fieldActions.push({ action: "set_field_value", field_name: "admin_receipt_number", value: input.receiptNumber });
    fieldActions.push({ action: "set_field_value", field_name: "admin_amount", value: input.amount });
    fieldActions.push({ action: "set_field_value", field_name: "admin_payment_method", value: input.paymentMethod });
    fieldActions.push({ action: "set_field_value", field_name: "admin_created_by", value: input.createdBy });
    fieldActions.push({ action: "set_field_value", field_name: "admin_items", value: itemsSummary });

    // Newer admin WhatsApp template field names (best-effort)
    fieldActions.push({ action: "set_field_value", field_name: "receipt_number", value: input.receiptNumber });
    fieldActions.push({ action: "set_field_value", field_name: "customer_name", value: safeCustomerName });
    fieldActions.push({ action: "set_field_value", field_name: "customer_phone", value: safeCustomerPhone });
    fieldActions.push({ action: "set_field_value", field_name: "formatted_amount", value: safeFormattedAmount });
    fieldActions.push({ action: "set_field_value", field_name: "created_by", value: safeCreatedBy });
    fieldActions.push({ action: "set_field_value", field_name: "admin_items", value: safeAdminItems });
    fieldActions.push({ action: "set_field_value", field_name: "pod_pending_count", value: safePodPendingCount });
    fieldActions.push({ action: "set_field_value", field_name: "pod_pending_total", value: safePodPendingTotal });
    fieldActions.push({ action: "set_field_value", field_name: "pod_pending_list", value: safePodPendingList });
  }

  const tagActions: any[] = [];
  if (forceRetrigger) tagActions.push({ action: "remove_tag", tag_name: tagName });
  tagActions.push({ action: "add_tag", tag_name: tagName });

  // IMPORTANT: prove what's being sent to Chatrace for auditing (fields + tag)
  try {
    const phone = input.toPhone || env.adminPhone;
    console.info('[internal][adminAlert] outbound', {
      phone,
      fields: fieldActions.map((a: any) => a.field_name),
      tag: tagName,
      strict: isPodInternalTag,
    });
    if (isPodInternalTag) {
      const label = tagName === podAdminTag ? '[Chatrace POD Admin]' : '[Chatrace POD FollowUp]';
      console.info(label, {
        phone,
        tag: tagName,
        customer_name: safeCustomerName,
        customer_phone: safeCustomerPhone,
        receipt_number: safeReceiptNumber,
        formatted_amount: safeFormattedAmount,
        created_by: safeCreatedBy,
        pod_pending_count: safePodPendingCount,
        pod_pending_total: tagName === podAdminTag ? safePodPendingTotal : undefined,
        pod_pending_list: tagName === podFollowupTag ? safePodPendingList : undefined,
      });
    }
  } catch (e) {
    console.warn('[internal][adminAlert] failed to log outbound_actions', String(e));
  }

  const toPhone = (input.toPhone || env.adminPhone || "").toString().trim();
  if (!toPhone) return { ok: false, debug: { ...debug, error: "missing_internal_recipient_phone" } };
  const url = `${env.baseUrl.replace(/\/$/, "")}${CONTACTS_PATH}`;
  const phoneNormalized = normalizeRecipientPhone(toPhone);

  // Step 1: upsert contact and update fields
  const fieldsPayload = { phone: phoneNormalized, actions: fieldActions };
  const fieldsStep = await postJson(url, env.token, fieldsPayload, { rid, accountId: env.accountId });
  debug.steps.fields = fieldsStep;
  if (fieldsStep.json && fieldsStep.json.success === false) {
    console.error('[internal][adminAlert] fields step returned success=false', { rid, tagName, body: fieldsStep.json });
  }

  // Step 2: apply tag after fields are set (trigger flow)
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const delayRaw = process.env.CHATRACE_INTERNAL_TAG_DELAY_MS ? Number(process.env.CHATRACE_INTERNAL_TAG_DELAY_MS) : 800;
  const delayMs = process.env.NODE_ENV === 'test' ? 0 : Number.isFinite(delayRaw) ? Math.max(0, Math.round(delayRaw)) : 800;
  await sleep(delayMs);
  const tagPayload = { phone: phoneNormalized, actions: tagActions };
  const tagStep = await postJson(url, env.token, tagPayload, { rid, accountId: env.accountId });
  debug.steps.tag = tagStep;
  if (tagStep.json && tagStep.json.success === false) {
    console.error('[internal][adminAlert] tag step returned success=false', { rid, tagName, body: tagStep.json });
  }

  try {
    console.info('[internal][adminAlert] response', {
      fields: { status: fieldsStep.status, ok: fieldsStep.ok, snippet: fieldsStep.bodySnippet, json: fieldsStep.json ?? null },
      tag: { status: tagStep.status, ok: tagStep.ok, snippet: tagStep.bodySnippet, json: tagStep.json ?? null },
    });
  } catch (e) {
    console.warn('[internal][adminAlert] failed to log response', String(e));
  }

  debug.ok = Boolean(fieldsStep.ok && tagStep.ok);
  // persist debug to DB for later inspection
  try {
    await persistInternalDebug(input.receiptNumber, rid, debug);
  } catch (e) {
    console.error('[internal][adminAlert] persist debug failed', String(e));
  }
  return { ok: debug.ok, debug };
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
