import { prisma } from '@/lib/prisma';
import { getKenyanPhoneVariants, normalizeKenyanPhone } from '@/lib/phone';
import { Prisma } from '@prisma/client';

const BASE_URL = (process.env.CHATRACE_BASE_URL || '').replace(/\/$/, '');
const API_TOKEN = process.env.CHATRACE_API_TOKEN;
const ACCOUNT_ID = process.env.CHATRACE_ACCOUNT_ID;
const CHATRACE_LOOKUP_CACHE_TTL_MS = 15 * 60_000;
const CHATRACE_LOOKUP_RATE_LIMIT_TTL_MS = 60_000;
const CHATRACE_LOOKUP_MAX_REQUESTS_PER_MINUTE = 40;
let chatraceLookupRateLimitedUntil = 0;
let chatraceLookupRateLimitLoggedAt = 0;
const chatraceLookupInFlight = new Map<string, Promise<ChatraceLookupResult>>();
const chatraceLookupRequestTimestamps: number[] = [];

export type ChatraceCustomFieldSummary = {
  name: string;
  value: string;
};

export type ChatraceRecentMessage = {
  text: string;
  at?: string;
  sender?: string;
};

export type ChatraceLookupResult = {
  found: boolean;
  normalizedPhone: string;
  contactId?: number;
  name?: string;
  phone?: string;
  channel?: string;
  lastInteractionAt?: string;
  tags?: string[];
  customFields?: ChatraceCustomFieldSummary[];
  lastMessagePreview?: string | null;
  profileUrl?: string | null;
  inboxUrl?: string | null;
  recentMessages?: ChatraceRecentMessage[];
  sourceError?: boolean;
  rateLimited?: boolean;
};

type ChatraceLookupCacheEntry = {
  expiresAt: number;
  value: ChatraceLookupResult;
};

const chatraceLookupCache = new Map<string, ChatraceLookupCacheEntry>();

type ChatraceLookupConfig = {
  baseUrl: string;
  accountId: string;
  token: string;
};

export type SendReceiptToChatraceInput = {
  phoneE164: string;
  customerName: string;
  receiptNumber: string;
  amount: string;
  currency: string;
  receiptLink: string;
  receiptUrl?: string; // final URL to be written into Chatrace `receipt_url`
  receiptId?: string;
  tagName?: string;
  skipDefaultTags?: boolean;
  items?: any[];
  paymentMethod?: string;
  attendant?: string;
  // extra custom fields to set with exact field names (e.g. formatted_amount)
  extraFields?: Record<string, string | number | null | undefined>;
  accountId?: string;
  forceTriggerTagReapply?: boolean;
};

function checkConfig(accountIdOverride?: string) {
  const missing: string[] = [];
  if (!BASE_URL) missing.push('CHATRACE_BASE_URL');
  if (!API_TOKEN) missing.push('CHATRACE_API_TOKEN');
  if (!(accountIdOverride?.trim() || ACCOUNT_ID)) missing.push('CHATRACE_ACCOUNT_ID');
  return missing;
}

function sanitizeChatraceResponse(value: unknown) {
  if (value == null) return null;
  if (typeof value === 'string') return value.slice(0, 300);
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value).slice(0, 300);
  }
}

export async function pushReceiptToChatrace(input: SendReceiptToChatraceInput): Promise<{ ok: boolean; debug: any }> {
  const {
    phoneE164,
    customerName,
    receiptNumber,
    amount,
    currency,
    receiptLink,
    receiptUrl,
    receiptId,
    tagName,
    skipDefaultTags,
    accountId,
    forceTriggerTagReapply,
  } = input;
  const resolvedAccountId = accountId?.trim() || ACCOUNT_ID || '';
  const customerDisplayName = String(customerName || '').trim() || 'Customer';
  const customerFirstName =
    customerDisplayName
      .split(/\s+/)
      .map((part) => part.trim())
      .find(Boolean) || 'Customer';
  const receiptUrlTrimmed = receiptUrl?.trim();
  const debug: any = {
    ok: false,
    steps: {},
    contactId: null,
    phoneNormalized: phoneE164,
    receiptUrlPresent: !!receiptUrlTrimmed,
    receiptUrlLength: receiptUrlTrimmed?.length ?? 0,
    env: {
      baseUrlPresent: !!BASE_URL,
      accountIdPresent: !!resolvedAccountId,
      tokenPresent: !!API_TOKEN,
      baseUrl: BASE_URL,
      accountId: resolvedAccountId,
      headerKeys: [],
      skipDefaultTags: Boolean(skipDefaultTags),
    },
  };

  if (!phoneE164) throw new Error('phoneE164 is required');
  if (!customerName) throw new Error('customerName is required');
  if (!receiptNumber) throw new Error('receiptNumber is required');
  if (!amount) throw new Error('amount is required');
  if (!currency) throw new Error('currency is required');
  if (!receiptLink) throw new Error('receiptLink is required');

  const missingConfig = checkConfig(resolvedAccountId);
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
  if (resolvedAccountId) {
    headers['X-ACCOUNT-ID'] = resolvedAccountId;
  }
  const headerKeys = Object.keys(headers);
  debug.env.headerKeys = headerKeys;

  const pathWithBase = (path: string) => `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  async function runRequest(path: string, body: unknown, hdrs: Record<string, string> = headers) {
    const url = pathWithBase(path);
    const timeoutMs = 8_000;
    const controller = new AbortController();
    const init: RequestInit = {
      method: 'POST',
      signal: controller.signal as any,
      headers: {
        ...hdrs,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    };
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response | null = null;
    let text = '';
    let json: any = null;
    try {
      res = await fetch(url, init as any);
      clearTimeout(timer);
      text = await res.text().catch(() => '');
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      const bodySnippet = (text || '').slice(0, 500);
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
      console.info('[chatrace][http][debug]', { status: res.status, path, bodySnippet, json: json ?? null, rawHead: text ? (text.length > 500 ? text.slice(0, 500) : text) : null });
      if (!res.ok) {
        console.error('[chatrace][http] non-2xx response', { path, status: res.status, bodySnippet });
      }
      return { ok: res.ok, status: res.status, text, json, bodyError };
    } catch (e: any) {
      clearTimeout(timer);
      const errMessage = String(e);
      const stack = e && e.stack ? e.stack : null;
      console.error('[chatrace][http] failed', { method: 'POST', path, error: errMessage, stack });
      return { ok: false, status: 0, text: errMessage, json: null, bodyError: errMessage };
    }
  }

  const ensureHttps = /^https:\/\//i.test(receiptLink);
  if (!ensureHttps) {
    debug.pdfUrlWarning = 'receiptLink should be HTTPS and publicly reachable';
    console.warn('[chatrace] receiptLink does not look public HTTPS', { receiptLink });
  }

  const finalTag = (tagName?.trim() || '').toLowerCase();
  const receiptMode = receiptUrlTrimmed ? 'pdf' : 'link';

  const finalReceiptUrl = (receiptUrlTrimmed || receiptLink || '').trim();
  if (!finalReceiptUrl) {
    throw new Error('finalReceiptUrl is empty (receiptUrl + receiptLink both missing)');
  }

  const setFieldValue = (fieldName: string, value: any) => ({
    action: 'set_field_value',
    field_name: fieldName,
    value: (() => {
      if (value == null) return '';
      // Some Chatrace custom fields are configured as "Number". Preserve numeric
      // values to avoid them being blanked out by strict type validation.
      if (typeof value === 'number') {
        const n = Number.isFinite(value) ? value : 0;
        return Math.round(n);
      }
      const raw = String(value);
      // Chatrace/WhatsApp template params must not contain newlines/tabs
      // or excessive consecutive spaces. Replace newlines/tabs with a single
      // space and collapse multiple spaces to a single space.
      try {
        return raw.replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();
      } catch (e) {
        return raw;
      }
    })(),
  });
  // Build minimal required custom fields according to integration
  // requirements. We'll perform a two-step POST: first upsert/set fields,
  // then apply the trigger tag `receipt_created` so Chatrace Flows render
  // template variables from the persisted fields.
  const fieldActions: any[] = [];

  // Required custom fields (must match exactly)
  fieldActions.push(setFieldValue('receipt_url', finalReceiptUrl));
  // Common aliases used by older templates/flows
  fieldActions.push(setFieldValue('media_url', finalReceiptUrl));
  fieldActions.push(setFieldValue('receipt_pdf_url', finalReceiptUrl));
  fieldActions.push(setFieldValue('file_url', finalReceiptUrl));
  fieldActions.push(setFieldValue('customer_name', customerDisplayName));
  fieldActions.push(setFieldValue('customer_full_name', customerDisplayName));
  fieldActions.push(setFieldValue('customer_first_name', customerFirstName));
  // Some Chatrace flows map template var #1 to "contact.first_name". Chatrace
  // has a top-level "first_name" attribute (we set it in the /contacts body),
  // but we also set these custom-field aliases to prevent blank names when
  // flows/templates are misconfigured to read from a custom field instead.
  try {
    fieldActions.push(setFieldValue('contact.first_name', customerFirstName));
    fieldActions.push(setFieldValue('contact_first_name', customerFirstName));
    fieldActions.push(setFieldValue('first_name', customerFirstName));
  } catch {
    // best-effort only
  }
  fieldActions.push(setFieldValue('receipt_number', receiptNumber));
  fieldActions.push(setFieldValue('amount', amount));
  fieldActions.push(setFieldValue('currency', currency || 'KES'));

  // Format items_summary as plain text lines (1. name xqty — KES #)
  const formatCurrencyKesLocal = (v: number | string) => {
    try {
      const n = Number(v) || 0;
      return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(n);
    } catch {
      return `${Math.round(Number(v) || 0)} KES`;
    }
  };

  let itemsSummary = '';
  try {
    if (input.items && Array.isArray(input.items) && input.items.length) {
      const lines = input.items.map((it: any, idx: number) => {
        const title = String(it.title || it.productName || it.product?.name || it.productTitle || it.product_name || it.name || '').trim() || 'Item';
        const qty = Number.isFinite(Number(it.quantity ?? 1)) ? Number(it.quantity ?? 1) : 1;
        const unit = Number.isFinite(Number(it.unitPrice ?? it.sellingPrice ?? 0)) ? Number(it.unitPrice ?? it.sellingPrice ?? 0) : 0;
        const priceText = formatCurrencyKesLocal(unit * qty);
        return `${idx + 1}) ${title} x${qty} — ${priceText}`;
      });
      itemsSummary = lines.join('\n');
      // Truncate to ~700 chars to keep WhatsApp template safe
      const MAX_LEN = 700;
      if (itemsSummary.length > MAX_LEN) {
        itemsSummary = itemsSummary.slice(0, MAX_LEN - 1).trimEnd() + '…';
      }
    }
  } catch (e) {
    itemsSummary = '';
  }
  // Ensure we always set the field (fallback text when no items) so the template parameters never send empty
  const itemsSummarySafe = itemsSummary.trim().length ? itemsSummary : 'Items: (not available)';
  fieldActions.push(setFieldValue('items_summary', itemsSummarySafe));
  // Optionally include receipt_id as well
  if (receiptId) fieldActions.push(setFieldValue('receipt_id', receiptId));
  // Also write common alias fields so templates that use alternate names
  // (e.g. order_placed, order_number) still receive the value.
  try {
    fieldActions.push(setFieldValue('order_placed', receiptNumber));
    fieldActions.push(setFieldValue('order_number', receiptNumber));
    fieldActions.push(setFieldValue('receipt_no', receiptNumber));
    // Some flows expect items under a shorter key
    fieldActions.push(setFieldValue('items', itemsSummarySafe));
  } catch (e) {
    // noop — best-effort
  }

  // Add any extraFields provided by caller using exact field names
  try {
    if (input.extraFields && typeof input.extraFields === 'object') {
      for (const [k, v] of Object.entries(input.extraFields)) {
        fieldActions.push(setFieldValue(String(k), v == null ? '' : String(v)));
      }
    }
  } catch (e) {
    // ignore
  }

  // Build tag actions separately so they can be applied after fields persist
  const tagActions: any[] = [];

  // When callers want to set fields without triggering flows (e.g. SMS/email-only,
  // internal/admin alerts), they can pass skipDefaultTags=true. In that case we
  // only apply the explicit tagName (if provided).
  if (!skipDefaultTags) {
    // Default trigger tags that most Flows listen for
    tagActions.push({ action: 'add_tag', tag_name: 'receipt_created' });
    tagActions.push({
      action: 'add_tag',
      tag_name: receiptMode === 'pdf' ? 'receipt_created_pdf' : 'receipt_created_link',
    });
  }

  // Apply any custom tag provided (e.g. pod dispatch, admin alert).
  if (finalTag) {
    // Some flows are triggered by "Tag applied" rules. If the same tag already
    // exists on the contact, re-applying it may not retrigger the rule.
    // For these ephemeral/notification tags, we optionally force a re-trigger
    // by removing then adding the tag.
    const FORCE_RETRIGGER_TAGS = new Set([
      'pod_dispatch_speedaf',
      'betech_dispatch_pay_on_delivery',
      'post_purchase_review',
      'pod_receipt_admin_alert',
      'followup_responsible_alert',
      'quotation_ready',
      'quotation_follow_up',
      'project_installation_booked_customer',
      'project_completed_customer',
      'project_installation_booked_admin',
      'project_assigned_handler',
      // legacy/internal
      'receipt_admin_alert',
    ]);
    const forceRetrigger =
      Boolean(forceTriggerTagReapply) ||
      process.env.CHATRACE_FORCE_RETRIGGER_TAGS === '1' ||
      FORCE_RETRIGGER_TAGS.has(finalTag);

    // Avoid duplicating the default trigger when skipDefaultTags is false and caller
    // explicitly passes receipt_created.
    if (!(!skipDefaultTags && finalTag === 'receipt_created')) {
      if (forceRetrigger) {
        tagActions.push({ action: 'remove_tag', tag_name: finalTag });
      }
      tagActions.push({ action: 'add_tag', tag_name: finalTag });
    }
  }

  debug.payloadPreview = {
    phone: phoneE164,
    first_name: customerFirstName,
    customer_name: customerDisplayName,
    fieldActionsCount: fieldActions.length,
    tagActionsCount: tagActions.length,
    tag: finalTag || (skipDefaultTags ? null : 'receipt_created'),
    debugTag:
      finalTag ||
      (skipDefaultTags ? null : receiptMode === 'pdf' ? 'receipt_created_pdf' : 'receipt_created_link'),
    skipDefaultTags: Boolean(skipDefaultTags),
    hasReceiptUrl: !!finalReceiptUrl,
    receiptMode,
    finalReceiptUrlLength: finalReceiptUrl.length,
    itemsCount: Array.isArray(input.items) ? input.items.length : 0,
    paymentMethod: input.paymentMethod ?? null,
    attendant: input.attendant ?? null,
  };

  console.info('[chatrace] pushReceipt', {
    receiptNumber,
    phoneE164,
    baseUrl: BASE_URL,
    accountId: resolvedAccountId,
    headerKeys,
    receiptMode,
    receiptUrlTrimmedLength: receiptUrlTrimmed?.length ?? 0,
    finalReceiptUrlLength: finalReceiptUrl.length,
    finalReceiptUrlSnippet: finalReceiptUrl.slice(0, 120),
    tagToApply: finalTag || (skipDefaultTags ? '(no_tag)' : 'receipt_created'),
    debugTag: finalTag || (skipDefaultTags ? '(no_tag)' : receiptMode === 'pdf' ? 'receipt_created_pdf' : 'receipt_created_link'),
  });

  // summary log for monitoring integrations (phone, final receipt_url, tag, mode)
  console.info('[chatrace] pushSummary', {
    phone: phoneE164,
    receipt_url: finalReceiptUrl,
    tag: finalTag || (skipDefaultTags ? '(no_tag)' : 'receipt_created'),
    receiptMode,
  });

  const path = '/contacts';
  // Step 1: upsert contact and set fields
  // Persist the exact request bodies into debug for post-mortem
  debug.steps = debug.steps || {};
  debug.steps.create = debug.steps.create || {};
  debug.steps.create.request = { phone: phoneE164, first_name: customerFirstName, actions: fieldActions };
  const createRes = await runRequest(path, { phone: phoneE164, first_name: customerFirstName, actions: fieldActions }, headers);
  debug.steps.create = {
    status: createRes.status,
    bodySnippet: (createRes.text || '').slice(0, 200),
    path,
    bodyError: createRes.bodyError ?? null,
    ok: createRes.ok,
  };
  console.info('[PROJECT_WHATSAPP] operation', {
    accountId: resolvedAccountId,
    recipientPhone: phoneE164,
    operation: 'UPDATE_FIELDS',
    tagName: finalTag || null,
    httpStatus: createRes.status,
    sanitizedResponse: sanitizeChatraceResponse(createRes.json ?? createRes.text),
  });
  if (createRes.bodyError && !debug.error) {
    debug.error = typeof createRes.bodyError === 'string' ? createRes.bodyError : JSON.stringify(createRes.bodyError);
  }

  const bodyJson = createRes.json ?? {};
  // capture contact id and full response for debugging
  debug.contactId = bodyJson?.data?.id ?? bodyJson?.id ?? null;
  debug.responseJson = bodyJson;
  debug.steps.create.response = bodyJson;
  const success = Boolean(bodyJson?.success);
  console.info('[chatrace] create contact response', { receiptNumber, phoneE164, status: createRes.status, success });

  // If first step failed, persist debug and return
  if (!createRes.ok || !success) {
    debug.ok = false;
    if (!debug.error) debug.error = 'failed_to_create_or_update_contact';
    await persistDebug(receiptNumber, debug);
    return { ok: false, debug };
  }

  // If we are not applying any tags, we're done (fields are set, but no Flow is triggered).
  if (tagActions.length === 0) {
    debug.steps.tag = { skipped: true };
    debug.contactUpdated = true;
    debug.tagRemoved = false;
    debug.tagApplied = false;
    debug.providerStatus = 'SUCCESS';
    debug.ok = true;
    await persistDebug(receiptNumber, debug);
    return { ok: true, debug };
  }

  // Step 2: apply tags in a separate request to ensure fields are persisted.
  // Add a short delay to avoid Chatrace evaluating the Flow before fields are indexed.
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const baseDelayMsRaw = process.env.CHATRACE_TAG_DELAY_MS ? Number(process.env.CHATRACE_TAG_DELAY_MS) : 300;
  const baseDelayMs = Number.isFinite(baseDelayMsRaw) ? Math.max(0, Math.round(baseDelayMsRaw)) : 300;
  const isAdminAlert = finalTag === 'receipt_admin_alert';
  const delayMs =
    process.env.NODE_ENV === 'test' ? 0 : isAdminAlert ? Math.max(baseDelayMs, 1500) : baseDelayMs;
  await sleep(delayMs);
  const removalActions = tagActions.filter((action) => action?.action === 'remove_tag');
  const applyActions = tagActions.filter((action) => action?.action !== 'remove_tag');
  let removeTagRes: Awaited<ReturnType<typeof runRequest>> | null = null;
  let applyTagRes: Awaited<ReturnType<typeof runRequest>> | null = null;

  debug.steps.tag = debug.steps.tag || {};

  if (removalActions.length > 0) {
    debug.steps.tag.remove = { request: { phone: phoneE164, actions: removalActions } };
    removeTagRes = await runRequest(path, { phone: phoneE164, actions: removalActions }, headers);
    debug.steps.tag.remove = {
      ...debug.steps.tag.remove,
      status: removeTagRes.status,
      bodySnippet: (removeTagRes.text || '').slice(0, 200),
      ok: removeTagRes.ok,
      response: removeTagRes.json ?? null,
    };
    console.info('[PROJECT_WHATSAPP] operation', {
      accountId: resolvedAccountId,
      recipientPhone: phoneE164,
      operation: 'REMOVE_TAG',
      tagName: finalTag || null,
      httpStatus: removeTagRes.status,
      sanitizedResponse: sanitizeChatraceResponse(removeTagRes.json ?? removeTagRes.text),
    });
    await sleep(delayMs);
  }

  if (applyActions.length > 0) {
    debug.steps.tag.apply = { request: { phone: phoneE164, actions: applyActions } };
    applyTagRes = await runRequest(path, { phone: phoneE164, actions: applyActions }, headers);
    debug.steps.tag.apply = {
      ...debug.steps.tag.apply,
      status: applyTagRes.status,
      bodySnippet: (applyTagRes.text || '').slice(0, 200),
      ok: applyTagRes.ok,
      response: applyTagRes.json ?? null,
    };
    console.info('[PROJECT_WHATSAPP] operation', {
      accountId: resolvedAccountId,
      recipientPhone: phoneE164,
      operation: 'APPLY_TAG',
      tagName: finalTag || null,
      httpStatus: applyTagRes.status,
      sanitizedResponse: sanitizeChatraceResponse(applyTagRes.json ?? applyTagRes.text),
    });
  }

  const tagRes = applyTagRes ?? removeTagRes;
  debug.contactUpdated = true;
  debug.tagRemoved = Boolean(
    removeTagRes?.ok && removalActions.some((action: any) => action?.tag_name === finalTag),
  );
  debug.tagApplied = Boolean(
    applyTagRes?.ok && applyActions.some((action: any) => action?.action === 'add_tag' && action?.tag_name === finalTag),
  );
  let tagVerified = !finalTag;
  let verification: ChatraceLookupResult | null = null;
  if (finalTag && debug.tagApplied) {
    verification = await lookupChatraceContactByPhoneWithOptions(phoneE164, {
      accountId: resolvedAccountId,
      bypassCache: true,
    });
    const normalizedFinalTag = finalTag.trim().toLowerCase();
    tagVerified = Boolean(
      verification.found &&
      (verification.tags || []).some((tag) => tag.trim().toLowerCase() === normalizedFinalTag),
    );
    console.info('[PROJECT_WHATSAPP] operation', {
      accountId: resolvedAccountId,
      recipientPhone: phoneE164,
      operation: 'VERIFY_TAG',
      tagName: finalTag,
      httpStatus: verification.found ? 200 : 404,
      sanitizedResponse: {
        found: verification.found,
        contactId: verification.contactId ?? null,
        tags: verification.tags ?? [],
        rateLimited: verification.rateLimited ?? false,
        sourceError: verification.sourceError ?? false,
      },
    });
  }
  debug.tagVerified = tagVerified;
  debug.verification = verification
    ? {
        found: verification.found,
        contactId: verification.contactId ?? null,
        tags: verification.tags ?? [],
        rateLimited: verification.rateLimited ?? false,
        sourceError: verification.sourceError ?? false,
      }
    : null;
  debug.providerStatus = tagRes?.ok && tagVerified ? 'SUCCESS' : 'FAILED';
  debug.ok = Boolean(createRes.ok && (tagActions.length === 0 || (tagRes?.ok && tagVerified)));
  if (!debug.ok && !debug.error && finalTag && !tagVerified) {
    debug.error = `ChatRace tag was not attached: ${finalTag}`;
  }
  await persistDebug(receiptNumber, debug);
  return { ok: debug.ok, debug };
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

function getChatraceLookupConfig(accountIdOverride?: string): ChatraceLookupConfig {
  const baseUrl = (
    process.env.CHATRACE_INTERNAL_BASE_URL ||
    process.env.CHATRACE_BASE_URL ||
    "https://api.chatrace.com"
  ).replace(/\/$/, "");
  const accountId = accountIdOverride?.trim()
    || process.env.CHATRACE_INTERNAL_ACCOUNT_ID
    || process.env.CHATRACE_ACCOUNT_ID
    || "";
  const token =
    process.env.CHATRACE_INTERNAL_API_TOKEN ||
    process.env.CHATRACE_API_TOKEN ||
    "";

  return { baseUrl, accountId, token };
}

function buildChatraceLookupCacheKey(phone: string, accountId = '') {
  return `lookup:${accountId || 'default'}:${phone}`;
}

function readChatraceLookupCache(phone: string, accountId = '') {
  const key = buildChatraceLookupCacheKey(phone, accountId);
  const cached = chatraceLookupCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    chatraceLookupCache.delete(key);
    return null;
  }
  return cached.value;
}

function writeChatraceLookupCache(
  phone: string,
  value: ChatraceLookupResult,
  ttlMs = CHATRACE_LOOKUP_CACHE_TTL_MS,
  accountId = '',
) {
  chatraceLookupCache.set(buildChatraceLookupCacheKey(phone, accountId), {
    expiresAt: Date.now() + ttlMs,
    value,
  });
}

function clearChatraceLookupCache(phone: string, accountId = '') {
  chatraceLookupCache.delete(buildChatraceLookupCacheKey(phone, accountId));
}

export function buildChatraceLookupBaseResult(
  normalizedPhone: string,
  overrides?: Partial<ChatraceLookupResult>,
): ChatraceLookupResult {
  return {
    found: false,
    normalizedPhone,
    tags: [],
    customFields: [],
    lastMessagePreview: null,
    profileUrl: null,
    inboxUrl: null,
    recentMessages: [],
    sourceError: false,
    rateLimited: false,
    ...overrides,
  };
}

function pruneChatraceLookupRequestTimestamps(now = Date.now()) {
  while (chatraceLookupRequestTimestamps.length && now - chatraceLookupRequestTimestamps[0] >= 60_000) {
    chatraceLookupRequestTimestamps.shift();
  }
}

function reserveChatraceLookupRequestSlot() {
  const now = Date.now();
  pruneChatraceLookupRequestTimestamps(now);
  if (chatraceLookupRequestTimestamps.length >= CHATRACE_LOOKUP_MAX_REQUESTS_PER_MINUTE) {
    chatraceLookupRateLimitedUntil = Math.max(chatraceLookupRateLimitedUntil, now + CHATRACE_LOOKUP_RATE_LIMIT_TTL_MS);
    return false;
  }
  chatraceLookupRequestTimestamps.push(now);
  return true;
}

function snippet(text: string, max = 240) {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function toLookupString(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((entry) => toLookupString(entry))
      .filter(Boolean)
      .join(", ");
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return "";
}

function toTagList(value: unknown) {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .flatMap((entry) => {
            if (typeof entry === "string") return [entry.trim()];
            if (entry && typeof entry === "object") {
              const record = entry as Record<string, unknown>;
              return [record.name, record.tag, record.label].map((item) => toLookupString(item));
            }
            return [];
          })
          .filter(Boolean),
      ),
    );
  }

  const raw = toLookupString(value);
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(/[|,]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function toCustomFieldList(value: unknown): ChatraceCustomFieldSummary[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const name = toLookupString(record.name || record.field_name || record.label || record.key);
      const fieldValue = toLookupString(record.value ?? record.field_value ?? record.content);
      if (!name || !fieldValue) return null;
      return { name, value: fieldValue };
    })
    .filter((entry): entry is ChatraceCustomFieldSummary => Boolean(entry));
}

function extractMessagePreview(candidate: unknown, customFields: ChatraceCustomFieldSummary[]) {
  const direct = snippet(toLookupString(candidate));
  if (direct) return direct;

  const historyField = customFields.find((field) =>
    ["chat_history", "chat history", "last_message", "last message", "recent_messages"].includes(
      field.name.trim().toLowerCase(),
    ),
  );
  if (!historyField?.value) return null;

  const raw = historyField.value.trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.length) {
      const lastEntry = parsed[parsed.length - 1];
      if (lastEntry && typeof lastEntry === "object") {
        const message = toLookupString((lastEntry as Record<string, unknown>).message);
        if (message) return snippet(message);
      }
      return snippet(toLookupString(lastEntry));
    }
    if (parsed && typeof parsed === "object") {
      const message = toLookupString((parsed as Record<string, unknown>).message);
      if (message) return snippet(message);
    }
  } catch {
    return snippet(raw);
  }

  return snippet(raw);
}

function extractRecentMessages(candidate: unknown, customFields: ChatraceCustomFieldSummary[]): ChatraceRecentMessage[] {
  const candidates = [
    candidate,
    ...customFields
      .filter((field) =>
        [
          "chat_history",
          "chat history",
          "recent_messages",
          "recent messages",
          "messages",
          "message_history",
          "message history",
          "conversation_history",
          "conversation history",
          "last_message",
          "last message",
        ].includes(field.name.trim().toLowerCase()),
      )
      .map((field) => field.value),
  ];

  for (const item of candidates) {
    const raw = toLookupString(item).trim();
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as unknown;
      const asArray = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object"
          ? [parsed]
          : [];
      const mapped = asArray
        .map((entry) => {
          if (!entry) return null;
          if (typeof entry === "string") {
            const text = snippet(entry, 240);
            return text ? { text } : null;
          }
          if (typeof entry !== "object") return null;
          const record = entry as Record<string, unknown>;
          const text = snippet(
            toLookupString(record.message || record.text || record.body || record.content || record.preview),
            240,
          );
          if (!text) return null;
          return {
            text,
            at: toLookupString(record.at || record.time || record.timestamp || record.created_at) || undefined,
            sender: toLookupString(record.sender || record.from || record.role || record.author) || undefined,
          } satisfies ChatraceRecentMessage;
        })
        .filter((entry): entry is ChatraceRecentMessage => Boolean(entry));
      if (mapped.length) {
        return mapped.slice(-5).reverse();
      }
    } catch {
      const lines = raw
        .split(/\r?\n+/)
        .map((line) => snippet(line, 240))
        .filter(Boolean);
      if (lines.length) {
        return lines.slice(-5).reverse().map((text) => ({ text }));
      }
    }
  }

  return [];
}

function buildChatraceInboxUrl(baseUrl: string, accountId: string) {
  if (!accountId) return null;
  try {
    const base = new URL(baseUrl);
    const appHost = base.hostname === "api.chatrace.com" ? "chatrace.com" : base.hostname.replace(/^api\./, "");
    return `${base.protocol}//${appHost}/en/inbox?acc=${encodeURIComponent(accountId)}#`;
  } catch {
    return null;
  }
}

async function runChatraceLookupRequest(path: string, config: ChatraceLookupConfig) {
  const url = `${config.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const controller = new AbortController();
  const timeoutMs = 8_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      "X-ACCESS-TOKEN": config.token,
      Accept: "application/json",
    };
    if (config.accountId) {
      headers["X-ACCOUNT-ID"] = config.accountId;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const raw = await response.text().catch(() => "");
    let json: any = null;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      json = null;
    }

    return { ok: response.ok, status: response.status, raw, json, config };
  } catch (error) {
    clearTimeout(timer);
    throw error;
  }
}

function pickChatraceContact(payload: any) {
  if (!payload) return null;
  if (Array.isArray(payload)) return payload[0] ?? null;
  if (Array.isArray(payload?.data)) return payload.data[0] ?? null;
  if (payload?.data && typeof payload.data === "object") return payload.data;
  if (payload?.contact && typeof payload.contact === "object") return payload.contact;
  if (payload?.id) return payload;
  return null;
}

function mapChatraceContactToLookup(input: {
  contact: Record<string, unknown>;
  normalizedPhone: string;
  config: ReturnType<typeof getChatraceLookupConfig>;
}): ChatraceLookupResult {
  const customFields = toCustomFieldList(input.contact.custom_fields);
  const contactId = Number(input.contact.id ?? 0) || null;
  const firstName = toLookupString(input.contact.first_name);
  const lastName = toLookupString(input.contact.last_name);
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const phone =
    toLookupString(input.contact.phone) ||
    customFields.find((field) => field.name.trim().toLowerCase() === "phone")?.value ||
    input.normalizedPhone;
  const tags = toTagList(input.contact.tags);
  const recentMessages = extractRecentMessages(
    input.contact.last_messages ||
      input.contact.recent_messages ||
      input.contact.messages ||
      input.contact.chat_history,
    customFields,
  );

  return {
    found: true,
    normalizedPhone: input.normalizedPhone,
    contactId: contactId ?? undefined,
    name: fullName || toLookupString(input.contact.name) || undefined,
    phone: phone || input.normalizedPhone,
    channel: toLookupString(input.contact.channel) || undefined,
    lastInteractionAt:
      toLookupString(input.contact.last_interaction) ||
      toLookupString(input.contact.last_interaction_at) ||
      undefined,
    tags,
    customFields,
    lastMessagePreview: extractMessagePreview(
      input.contact.last_message_preview ||
        input.contact.last_message ||
        input.contact.preview ||
        input.contact.last_message_text,
      customFields,
    ),
    profileUrl: toLookupString(input.contact.profile_url || input.contact.url || input.contact.link) || null,
    inboxUrl: buildChatraceInboxUrl(input.config.baseUrl, input.config.accountId),
    recentMessages,
  } satisfies ChatraceLookupResult;
}

export async function lookupChatraceContactByPhone(rawPhone: string | null | undefined): Promise<ChatraceLookupResult> {
  return lookupChatraceContactByPhoneWithOptions(rawPhone);
}

export async function lookupChatraceContactByPhoneWithOptions(
  rawPhone: string | null | undefined,
  options?: { accountId?: string; bypassCache?: boolean },
): Promise<ChatraceLookupResult> {
  const normalizedPhone = normalizeKenyanPhone(rawPhone ?? "");
  const baseResult = buildChatraceLookupBaseResult(normalizedPhone);
  const accountId = options?.accountId?.trim() || '';

  if (!normalizedPhone) {
    return baseResult;
  }

  if (chatraceLookupRateLimitedUntil > Date.now()) {
    const result = buildChatraceLookupBaseResult(normalizedPhone, { sourceError: true, rateLimited: true });
    writeChatraceLookupCache(normalizedPhone, result, chatraceLookupRateLimitedUntil - Date.now(), accountId);
    return result;
  }

  if (options?.bypassCache) {
    clearChatraceLookupCache(normalizedPhone, accountId);
  }

  const cached = options?.bypassCache ? null : readChatraceLookupCache(normalizedPhone, accountId);
  if (cached) {
    return cached;
  }

  const config = getChatraceLookupConfig(accountId);
  if (!config.baseUrl || !config.token) {
    const result = buildChatraceLookupBaseResult(normalizedPhone, { sourceError: true });
    writeChatraceLookupCache(normalizedPhone, result, CHATRACE_LOOKUP_CACHE_TTL_MS, accountId);
    return result;
  }

  const inFlightKey = `${accountId || 'default'}:${normalizedPhone}`;
  const inFlight = chatraceLookupInFlight.get(inFlightKey);
  if (inFlight) {
    return inFlight;
  }

  const candidates = Array.from(
    new Set(
      [
        normalizedPhone,
        ...getKenyanPhoneVariants(normalizedPhone),
        normalizedPhone.replace(/^\+/, ""),
      ].filter(Boolean),
    ),
  );

  const lookupPromise = (async () => {
    let foundContact: Record<string, unknown> | null = null;

    for (const candidate of candidates) {
      if (!reserveChatraceLookupRequestSlot()) {
        const result = buildChatraceLookupBaseResult(normalizedPhone, { sourceError: true, rateLimited: true });
        if (Date.now() - chatraceLookupRateLimitLoggedAt > CHATRACE_LOOKUP_RATE_LIMIT_TTL_MS) {
          chatraceLookupRateLimitLoggedAt = Date.now();
          console.error("[chatrace.lookup.global_rate_limited]", {
            phone: normalizedPhone,
            accountId: config.accountId,
            windowRequests: chatraceLookupRequestTimestamps.length,
          });
        }
        writeChatraceLookupCache(normalizedPhone, result, CHATRACE_LOOKUP_RATE_LIMIT_TTL_MS, accountId);
        return result;
      }
      const path = `/contacts/find_by_custom_field?field_id=phone&value=${encodeURIComponent(candidate)}`;
      const response = await runChatraceLookupRequest(path, config);
      if (!response.ok) {
        if (response.status === 429) {
          const result = buildChatraceLookupBaseResult(normalizedPhone, { sourceError: true, rateLimited: true });
          chatraceLookupRateLimitedUntil = Date.now() + CHATRACE_LOOKUP_RATE_LIMIT_TTL_MS;
          if (Date.now() - chatraceLookupRateLimitLoggedAt > CHATRACE_LOOKUP_RATE_LIMIT_TTL_MS) {
            chatraceLookupRateLimitLoggedAt = Date.now();
            console.error("[chatrace.lookup.rate_limited]", {
              phone: normalizedPhone,
              accountId: config.accountId,
              candidate,
              status: response.status,
              bodySnippet: snippet(response.raw, 400),
            });
          }
          writeChatraceLookupCache(normalizedPhone, result, CHATRACE_LOOKUP_RATE_LIMIT_TTL_MS, accountId);
          return result;
        }
        console.error("[chatrace.lookup.find.failed]", {
          phone: normalizedPhone,
          accountId: config.accountId,
          candidate,
          status: response.status,
          bodySnippet: snippet(response.raw, 400),
        });
        continue;
      }

      const contact = pickChatraceContact(response.json);
      if (!contact || typeof contact !== "object") continue;
      foundContact = contact as Record<string, unknown>;
      break;
    }

    if (!foundContact) {
      writeChatraceLookupCache(normalizedPhone, baseResult, CHATRACE_LOOKUP_CACHE_TTL_MS, accountId);
      return baseResult;
    }

    const contactId = Number(foundContact.id ?? 0) || null;
    if (contactId) {
      const detailResponse = await runChatraceLookupRequest(`/contacts/${contactId}`, config);
      if (detailResponse.ok) {
        const detailContact = pickChatraceContact(detailResponse.json);
        if (detailContact && typeof detailContact === "object") {
          foundContact = detailContact as Record<string, unknown>;
        }
      } else if (detailResponse.status === 429) {
        chatraceLookupRateLimitedUntil = Date.now() + CHATRACE_LOOKUP_RATE_LIMIT_TTL_MS;
        if (Date.now() - chatraceLookupRateLimitLoggedAt > CHATRACE_LOOKUP_RATE_LIMIT_TTL_MS) {
          chatraceLookupRateLimitLoggedAt = Date.now();
          console.error("[chatrace.lookup.contact.rate_limited]", {
            phone: normalizedPhone,
            accountId: config.accountId,
            contactId,
            status: detailResponse.status,
            bodySnippet: snippet(detailResponse.raw, 400),
          });
        }
        const result = mapChatraceContactToLookup({
          contact: foundContact,
          normalizedPhone,
          config,
        });
        result.rateLimited = true;
        result.sourceError = true;
        writeChatraceLookupCache(normalizedPhone, result, CHATRACE_LOOKUP_RATE_LIMIT_TTL_MS, accountId);
        return result;
      } else {
        console.error("[chatrace.lookup.contact.failed]", {
          phone: normalizedPhone,
          accountId: config.accountId,
          contactId,
          status: detailResponse.status,
          bodySnippet: snippet(detailResponse.raw, 400),
        });
      }
    }

    const result = mapChatraceContactToLookup({
      contact: foundContact,
      normalizedPhone,
      config,
    });
    writeChatraceLookupCache(normalizedPhone, result, CHATRACE_LOOKUP_CACHE_TTL_MS, accountId);
    return result;
  })().catch((error) => {
    console.error("[chatrace.lookup.failed]", {
      phone: normalizedPhone,
      accountId: config.accountId,
      error: error instanceof Error ? error.message : String(error),
    });
    const result = buildChatraceLookupBaseResult(normalizedPhone, { sourceError: true });
    writeChatraceLookupCache(normalizedPhone, result, CHATRACE_LOOKUP_CACHE_TTL_MS, accountId);
    return result;
  }).finally(() => {
    chatraceLookupInFlight.delete(inFlightKey);
  });

  chatraceLookupInFlight.set(inFlightKey, lookupPromise);
  return lookupPromise;
}
