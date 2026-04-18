import { randomUUID } from "crypto";
import { prisma } from '@/lib/prisma';

type ChatraceInternalConfig = {
  baseUrl: string;
  accountId: string;
  token: string;
  adminPhone: string;
  enabled: boolean;
};

function getEnv(): ChatraceInternalConfig {
  const baseUrl = process.env.CHATRACE_INTERNAL_BASE_URL || process.env.CHATRACE_BASE_URL || "https://api.chatrace.com";
  const accountId = process.env.CHATRACE_INTERNAL_ACCOUNT_ID || "";
  const token = process.env.CHATRACE_INTERNAL_API_TOKEN || "";
  const adminPhone = process.env.CHATRACE_INTERNAL_ADMIN_PHONE || process.env.ADMIN_PHONE || "";
  const enabled = process.env.CHATRACE_INTERNAL_ENABLED === "1";
  return { baseUrl, accountId, token, adminPhone, enabled };
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
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";
  // Chatrace internal contacts are keyed by numeric-only E.164 without '+'
  // (e.g. "2547..."). Keep this consistent to avoid duplicate contacts that
  // fail to send WhatsApp because the "real" WhatsApp-enabled contact is
  // stored under the digits-only phone.
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
  return digits;
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
  if (!env.enabled) {
    const out = { ok: true, debug: { ...debug, ok: true, skipped: "disabled" } };
    try {
      console.info("[internal][adminAlert] skipped: disabled", { rid, env: out.debug.env });
    } catch {}
    try {
      await persistInternalDebug(input.receiptNumber, rid, out.debug);
    } catch {}
    return out;
  }
  if (!env.baseUrl || !env.token) {
    const out = { ok: false, debug: { ...debug, error: "missing_internal_env" } };
    try {
      console.error("[internal][adminAlert] missing env", { rid, env: out.debug.env });
    } catch {}
    try {
      await persistInternalDebug(input.receiptNumber, rid, out.debug);
    } catch {}
    return out;
  }

  // Meta/WhatsApp template parameters cannot contain newlines/tabs or long runs
  // of spaces. Keep this sanitizer strict to prevent template send failures.
  const sanitizeMetaParam = (value: string, opts?: { list?: boolean; maxLen?: number }) => {
    const raw = (value ?? "").toString();
    const replaced = opts?.list
      ? raw.replace(/[\r\n\t]+/g, " | ")
      : raw.replace(/[\r\n\t]+/g, " ");
    // Collapse multi-space runs to a single space (also prevents >4 consecutive spaces).
    const collapsed = replaced.replace(/ {2,}/g, " ").trim();
    const maxLen = opts?.maxLen ?? 950;
    return collapsed.length > maxLen ? `${collapsed.slice(0, maxLen - 1)}…` : collapsed;
  };

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
  // Guard against misconfiguration where POD tags are accidentally set to the
  // normal admin tag. In that case we should still treat receipt_admin_alert as
  // a non-POD/internal-normal alert so required fields (e.g. payment_method,
  // total_sales_today) are populated correctly.
  try {
    if (podAdminTag === 'receipt_admin_alert' || podFollowupTag === 'receipt_admin_alert') {
      console.warn('[internal][adminAlert] POD tag env collides with receipt_admin_alert; treating as non-POD', {
        podAdminTag,
        podFollowupTag,
      });
    }
  } catch {
    // ignore logging failures
  }
  const isPodInternalTag =
    tagName !== 'receipt_admin_alert' && (tagName === podAdminTag || tagName === podFollowupTag);
  // Most deployments use a single internal Chatrace account. Fall back to the POD
  // internal account id (or 1802145) when CHATRACE_INTERNAL_ACCOUNT_ID is missing
  // so normal internal admin alerts keep working.
  const accountIdForRequest = (env.accountId || process.env.CHATRACE_INTERNAL_POD_ACCOUNT_ID || "1802145").toString().trim();
  if (!accountIdForRequest) return { ok: false, debug: { ...debug, error: "missing_internal_env" } };

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
  const toNumberOrZero = (value?: string | number) => {
    if (value == null) return 0;
    const n = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? Math.round(n) : 0;
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
  const safeAdminItemsRaw = itemsSummary.trim() || 'N/A';
  const safeAdminItems = sanitizeMetaParam(safeAdminItemsRaw, { list: true, maxLen: 800 });
  // Meta template parameters cannot be empty; empty strings can fail with
  // "(#131008) Required parameter is missing". Ensure required params have a
  // non-empty fallback even when upstream data is missing.
  const safeCustomerPhoneRaw = sanitizeMetaParam((input.customerPhone ?? '').toString(), { list: false, maxLen: 60 });
  const safeCustomerPhone = safeCustomerPhoneRaw || 'N/A';
  const safeFormattedAmountNum = toNumberOrZero(input.formattedAmount ?? input.amount);
  const safeFormattedAmount = toNumberStringOrZero(input.formattedAmount ?? input.amount);
  const safePaymentMethod = (input.paymentMethod ?? '').toString().trim() || 'N/A';
  const safeTotalSalesTodayNum = toNumberOrZero(input.totalSalesToday ?? 0);
  const safePodPendingCountNum = toNumberOrZero(input.podPendingCount ?? 0);
  const safePodPendingCount = toNumberStringOrZero(input.podPendingCount ?? 0);
  const safePodPendingTotalNum = toNumberOrZero(input.podPendingTotal ?? 0);
  const safePodPendingTotal = toNumberStringOrZero(input.podPendingTotal ?? 0);
  const safePodPendingListRaw = (input.podPendingList ?? '').toString().trim() || 'None';
  const safePodPendingList = sanitizeMetaParam(safePodPendingListRaw, { list: true, maxLen: 900 });

  // Internal validation for POD flows: if key fields are missing, do not apply the tag.
  if (isPodInternalTag) {
    const missing: string[] = [];
    if (!safeReceiptNumber) missing.push('receipt_number');
    if (!safeCustomerName) missing.push('customer_name');
    if (!safeCustomerPhone) missing.push('customer_phone');
    if (!safeCreatedBy) missing.push('created_by');
    if (!safeAdminItems) missing.push('admin_items');
    if (missing.length) throw new Error(`Missing required POD fields: ${missing.join(', ')}`);
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
    fieldActions.push({ action: "set_field_value", field_name: "formatted_amount", value: safeFormattedAmountNum });
    fieldActions.push({ action: "set_field_value", field_name: "created_by", value: safeCreatedBy });
    fieldActions.push({ action: "set_field_value", field_name: "admin_items", value: safeAdminItems });
    fieldActions.push({ action: "set_field_value", field_name: "pod_pending_count", value: safePodPendingCountNum });
    if (tagName === podAdminTag) {
      fieldActions.push({ action: "set_field_value", field_name: "pod_pending_total", value: safePodPendingTotalNum });
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
    fieldActions.push({ action: "set_field_value", field_name: "formatted_amount", value: safeFormattedAmountNum });
    fieldActions.push({ action: "set_field_value", field_name: "payment_method", value: safePaymentMethod });
    fieldActions.push({ action: "set_field_value", field_name: "created_by", value: safeCreatedBy });
    fieldActions.push({ action: "set_field_value", field_name: "admin_items", value: safeAdminItems });
    fieldActions.push({ action: "set_field_value", field_name: "total_sales_today", value: safeTotalSalesTodayNum });
    fieldActions.push({ action: "set_field_value", field_name: "pod_pending_count", value: safePodPendingCount });
    fieldActions.push({ action: "set_field_value", field_name: "pod_pending_total", value: safePodPendingTotal });
    fieldActions.push({ action: "set_field_value", field_name: "pod_pending_list", value: safePodPendingList });
  }

  const tagActions: any[] = [];
  if (forceRetrigger) tagActions.push({ action: "remove_tag", tag_name: tagName });
  tagActions.push({ action: "add_tag", tag_name: tagName });

  const toPhone = (input.toPhone || env.adminPhone || "").toString().trim();
  if (!toPhone) return { ok: false, debug: { ...debug, error: "missing_internal_recipient_phone" } };
  const url = `${env.baseUrl.replace(/\/$/, "")}${CONTACTS_PATH}`;
  const phoneNormalized = normalizeRecipientPhone(toPhone);
  const firstName =
    isPodInternalTag && tagName === podFollowupTag
      ? "POD Follow-up"
      : isPodInternalTag
        ? "POD Admin"
        : "Admin";

  // IMPORTANT: prove what's being sent to Chatrace for auditing (fields + tag)
  try {
    console.info('[internal][adminAlert] outbound', {
      phone: phoneNormalized,
      baseUrl: env.baseUrl,
      accountId: accountIdForRequest,
      fields: fieldActions.map((a: any) => a.field_name),
      tag: tagName,
      strict: isPodInternalTag,
    });
    if (isPodInternalTag) {
      const payloadPreview = {
        customer_name: safeCustomerName,
        customer_phone: safeCustomerPhone,
        receipt_number: safeReceiptNumber,
        formatted_amount: safeFormattedAmount,
        created_by: safeCreatedBy,
        admin_items: safeAdminItems,
        pod_pending_count: safePodPendingCount,
        pod_pending_total: tagName === podAdminTag ? safePodPendingTotal : undefined,
        pod_pending_list: tagName === podFollowupTag ? safePodPendingList : undefined,
      };
      if (tagName === podAdminTag) {
        // Keep exact log format requested for debugging.
        console.log("[POD INTERNAL ADMIN] tag=", tagName, "payload=", { phone: phoneNormalized, first_name: firstName, ...payloadPreview });
      } else if (tagName === podFollowupTag) {
        console.log("[POD INTERNAL FOLLOWUP] tag=", tagName, "payload=", { phone: phoneNormalized, first_name: firstName, ...payloadPreview });
      }
    }
  } catch (e) {
    console.warn('[internal][adminAlert] failed to log outbound_actions', String(e));
  }

  // Step 1: upsert contact and update fields
  const fieldsPayload = { phone: phoneNormalized, first_name: firstName, actions: fieldActions };
  // For POD admin alerts, log the full outbound payload for auditing
  if (isPodInternalTag && tagName === podAdminTag) {
    try {
      console.info('[internal][adminAlert] fieldsPayload full', { payload: JSON.parse(JSON.stringify(fieldsPayload)), accountId: accountIdForRequest, rid });
    } catch (e) {
      console.warn('[internal][adminAlert] failed to stringify fieldsPayload', String(e));
    }
  }
  const fieldsStep = await postJson(url, env.token, fieldsPayload, { rid, accountId: accountIdForRequest });
  debug.steps.fields = fieldsStep;
  if (fieldsStep.json && fieldsStep.json.success === false) {
    console.error('[internal][adminAlert] fields step returned success=false', { rid, tagName, body: fieldsStep.json });
  }
  try {
    // Log full response body and parsed JSON for POD admin alerts
    if (isPodInternalTag && tagName === podAdminTag) {
      console.info('[internal][adminAlert] fields step response', { status: fieldsStep.status, raw: fieldsStep.raw, json: fieldsStep.json });
    } else {
      console.log('[CHATRACE RESPONSE]', fieldsStep.status, fieldsStep.raw || '');
    }
  } catch {
    // ignore logging failures
  }

  // Step 2: apply tag after fields are set (trigger flow)
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const delayDefault = isPodInternalTag ? 1500 : 800;
  const delayRaw = process.env.CHATRACE_INTERNAL_TAG_DELAY_MS ? Number(process.env.CHATRACE_INTERNAL_TAG_DELAY_MS) : delayDefault;
  const delayMs = process.env.NODE_ENV === 'test' ? 0 : Number.isFinite(delayRaw) ? Math.max(0, Math.round(delayRaw)) : 800;
  await sleep(delayMs);
  const tagPayload = { phone: phoneNormalized, first_name: firstName, actions: tagActions };
  // For POD admin alerts, log the full tag payload before sending
  if (isPodInternalTag && tagName === podAdminTag) {
    try {
      console.info('[internal][adminAlert] tagPayload full', { payload: JSON.parse(JSON.stringify(tagPayload)), accountId: accountIdForRequest, rid });
    } catch (e) {
      console.warn('[internal][adminAlert] failed to stringify tagPayload', String(e));
    }
  }
  const tagStep = await postJson(url, env.token, tagPayload, { rid, accountId: accountIdForRequest });
  debug.steps.tag = tagStep;
  if (tagStep.json && tagStep.json.success === false) {
    console.error('[internal][adminAlert] tag step returned success=false', { rid, tagName, body: tagStep.json });
  }
  try {
    if (isPodInternalTag && tagName === podAdminTag) {
      console.info('[internal][adminAlert] tag step response', { status: tagStep.status, raw: tagStep.raw, json: tagStep.json });
    } else {
      console.log('[CHATRACE RESPONSE]', tagStep.status, tagStep.raw || '');
    }
  } catch {
    // ignore logging failures
  }

  // If Meta rejects the send due to missing template params, retry once after a longer delay.
  // This addresses eventual-consistency/race conditions where fields are set but not yet readable
  // by the flow runner at the moment the tag is applied.
  try {
    const raw = (tagStep.raw ?? '').toString();
    const isMetaMissingParam =
      raw.includes('#131008') ||
      raw.includes('131008') ||
      raw.toLowerCase().includes('required parameter is missing') ||
      raw.toLowerCase().includes('missing text value');
    if (isPodInternalTag && tagName === podAdminTag && isMetaMissingParam) {
      await sleep(process.env.NODE_ENV === 'test' ? 0 : 1500);
      const retryStep = await postJson(url, env.token, tagPayload, { rid, accountId: accountIdForRequest });
      (debug.steps as any).tagRetry = retryStep;
      console.info('[internal][adminAlert] tag retry response', { status: retryStep.status, raw: retryStep.raw, json: retryStep.json });
    }
  } catch (e) {
    console.warn('[internal][adminAlert] tag retry skipped/failed', String(e));
  }

  try {
    console.info('[internal][adminAlert] response', {
      fields: { status: fieldsStep.status, ok: fieldsStep.ok, snippet: fieldsStep.bodySnippet, json: fieldsStep.json ?? null },
      tag: { status: tagStep.status, ok: tagStep.ok, snippet: tagStep.bodySnippet, json: tagStep.json ?? null },
    });
  } catch (e) {
    console.warn('[internal][adminAlert] failed to log response', String(e));
  }

  const retryOk = Boolean((debug.steps as any).tagRetry?.ok);
  debug.ok = Boolean(fieldsStep.ok && (tagStep.ok || retryOk));
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
  totalReceipts: string | number;
  totalSales: string | number;
  totalProfit: string | number;
  totalMpesa: string | number;
  totalCash: string | number;
  totalItems?: string | number;
  awaitingPricingCount?: string | number;
  mpesaReceipts?: string | number;
  cashReceipts?: string | number;
  posReceipts?: string | number;
  posSales?: string | number;
  requestId?: string;
}) {
  const rid = input.requestId || randomUUID();
  const env = getEnv();
  const debug = makeDebug(rid, env);
  if (!env.enabled) return { ok: true, debug: { ...debug, ok: true, skipped: "disabled" } };
  if (!env.baseUrl || !env.token || !env.adminPhone) return { ok: false, debug: { ...debug, error: "missing_internal_env" } };

  const accountIdForRequest = (env.accountId || process.env.CHATRACE_INTERNAL_POD_ACCOUNT_ID || "1802145").toString().trim();
  if (!accountIdForRequest) return { ok: false, debug: { ...debug, error: "missing_internal_env" } };

  const sanitizeSummaryDate = (value: string | number | null | undefined, maxLen = 60) => {
    const raw = (value ?? "").toString();
    const collapsed = raw.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim();
    if (!collapsed) return "N/A";
    return collapsed.length > maxLen ? `${collapsed.slice(0, maxLen - 1)}…` : collapsed;
  };
  const sanitizeSummaryNumber = (value: string | number | null | undefined) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const raw = (value ?? "").toString().trim();
    if (!raw) return 0;
    const normalized = raw.replace(/[^0-9.-]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const tagName = "betech_ops_daily_summary_template";
  const safeDateLabel = sanitizeSummaryDate(input.dateLabel);
  const safeTotalReceipts = sanitizeSummaryNumber(input.totalReceipts);
  const safeTotalSales = sanitizeSummaryNumber(input.totalSales);
  const safeTotalProfit = sanitizeSummaryNumber(input.totalProfit);
  const safeTotalMpesa = sanitizeSummaryNumber(input.totalMpesa);
  const safeTotalCash = sanitizeSummaryNumber(input.totalCash);
  const safeTotalItems = sanitizeSummaryNumber(input.totalItems ?? 0);
  const safeAwaitingPricingCount = sanitizeSummaryNumber(input.awaitingPricingCount ?? 0);
  const safeMpesaReceipts = sanitizeSummaryNumber(input.mpesaReceipts ?? 0);
  const safeCashReceipts = sanitizeSummaryNumber(input.cashReceipts ?? 0);
  const safePosReceipts = sanitizeSummaryNumber(input.posReceipts ?? 0);
  const safePosSales = sanitizeSummaryNumber(input.posSales ?? 0);

  const phoneNormalized = normalizeRecipientPhone(env.adminPhone);
  const url = `${env.baseUrl.replace(/\/$/, "")}${CONTACTS_PATH}`;
  const fieldActions = [
    { action: "set_field_value", field_name: "summary_date", value: safeDateLabel },
    { action: "set_field_value", field_name: "summary_total_receipts", value: safeTotalReceipts },
    { action: "set_field_value", field_name: "summary_total_sales", value: safeTotalSales },
    { action: "set_field_value", field_name: "summary_total_profit", value: safeTotalProfit },
    { action: "set_field_value", field_name: "summary_total_mpesa", value: safeTotalMpesa },
    { action: "set_field_value", field_name: "summary_total_cash", value: safeTotalCash },
    { action: "set_field_value", field_name: "daily_summary_date", value: safeDateLabel },
    { action: "set_field_value", field_name: "daily_summary_total_receipts", value: safeTotalReceipts },
    { action: "set_field_value", field_name: "daily_summary_total_sales", value: safeTotalSales },
    { action: "set_field_value", field_name: "daily_summary_total_profit", value: safeTotalProfit },
    { action: "set_field_value", field_name: "daily_summary_total_mpesa", value: safeTotalMpesa },
    { action: "set_field_value", field_name: "daily_summary_total_cash", value: safeTotalCash },
    { action: "set_field_value", field_name: "daily_summary_total_items", value: safeTotalItems },
    { action: "set_field_value", field_name: "daily_summary_awaiting_pricing", value: safeAwaitingPricingCount },
    { action: "set_field_value", field_name: "daily_summary_mpesa_receipts", value: safeMpesaReceipts },
    { action: "set_field_value", field_name: "daily_summary_cash_receipts", value: safeCashReceipts },
    { action: "set_field_value", field_name: "daily_summary_pos_receipts", value: safePosReceipts },
    { action: "set_field_value", field_name: "daily_summary_pos_sales", value: safePosSales },
  ];
  const tagActions = [
    { action: "remove_tag", tag_name: tagName },
    { action: "add_tag", tag_name: tagName },
  ];

  console.info("[internal][dailySummary] outbound", {
    rid,
    phone: phoneNormalized,
    baseUrl: env.baseUrl,
    accountId: accountIdForRequest,
    tag: tagName,
    fieldNames: fieldActions.map((entry) => entry.field_name),
  });

  const fieldsPayload = {
    phone: phoneNormalized,
    first_name: "Admin",
    actions: fieldActions,
  };
  const fieldsStep = await postJson(url, env.token, fieldsPayload, { rid, accountId: accountIdForRequest });
  debug.steps.fields = fieldsStep;

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const delayRaw = process.env.CHATRACE_INTERNAL_TAG_DELAY_MS ? Number(process.env.CHATRACE_INTERNAL_TAG_DELAY_MS) : 800;
  const delayMs = process.env.NODE_ENV === "test" ? 0 : Number.isFinite(delayRaw) ? Math.max(0, Math.round(delayRaw)) : 800;
  await sleep(delayMs);

  const tagPayload = {
    phone: phoneNormalized,
    first_name: "Admin",
    actions: tagActions,
  };
  const tagStep = await postJson(url, env.token, tagPayload, { rid, accountId: accountIdForRequest });
  debug.steps.tag = tagStep;

  try {
    const raw = (tagStep.raw ?? "").toString();
    const isMetaMissingParam =
      raw.includes("#131008") ||
      raw.includes("131008") ||
      raw.toLowerCase().includes("required parameter is missing") ||
      raw.toLowerCase().includes("missing text value");
    if (isMetaMissingParam) {
      await sleep(process.env.NODE_ENV === "test" ? 0 : 1500);
      const retryStep = await postJson(url, env.token, tagPayload, { rid, accountId: accountIdForRequest });
      (debug.steps as any).tagRetry = retryStep;
    }
  } catch (error) {
    console.warn("[internal][dailySummary] tag retry skipped/failed", String(error));
  }

  const retryOk = Boolean((debug.steps as any).tagRetry?.ok);
  debug.ok = Boolean(fieldsStep.ok && (tagStep.ok || retryOk));
  return { ok: debug.ok, debug };
}
