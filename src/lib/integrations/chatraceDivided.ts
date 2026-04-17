const DEFAULT_BASE_URL = "https://api.chatrace.com";

type ChatraceDividedConfig = {
  baseUrl: string;
  accountId: string;
  token: string;
};

export type ChatraceDividedResult = {
  ok: boolean;
  contactId: string | null;
  debug: {
    phone: string;
    accountId: string;
    fields: string[];
    tagsAdded: string[];
    tagsRemoved: string[];
    steps: {
      fields?: { ok: boolean; status: number; bodySnippet: string };
      tags?: { ok: boolean; status: number; bodySnippet: string };
    };
    json?: unknown;
    error?: string;
  };
};

function getConfig(): ChatraceDividedConfig {
  const baseUrl =
    (process.env.CHATRACE_DIVIDED_BASE_URL ||
      process.env.CHATRACE_INTERNAL_BASE_URL ||
      process.env.CHATRACE_BASE_URL ||
      DEFAULT_BASE_URL)
      .toString()
      .trim()
      .replace(/\/$/, "");
  const accountId =
    (process.env.CHATRACE_DIVIDED_ACCOUNT_ID ||
      process.env.CHATRACE_INTERNAL_ACCOUNT_ID ||
      "1802145")
      .toString()
      .trim();
  const token =
    (process.env.CHATRACE_DIVIDED_API_TOKEN ||
      process.env.CHATRACE_INTERNAL_API_TOKEN ||
      process.env.CHATRACE_API_TOKEN ||
      "")
      .toString()
      .trim();

  return { baseUrl, accountId, token };
}

function normalizeRecipientPhone(value: string) {
  const raw = (value || "").toString().trim();
  if (!raw) return "";
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
  return digits;
}

function sanitizeValue(value: string | number | null | undefined) {
  if (value == null) return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value) : 0;
  }
  return String(value).replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim();
}

async function postActions(
  config: ChatraceDividedConfig,
  phone: string,
  firstName: string,
  actions: Array<Record<string, unknown>>,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${config.baseUrl}/contacts`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-ACCESS-TOKEN": config.token,
        "X-ACCOUNT-ID": config.accountId,
      },
      body: JSON.stringify({
        phone,
        first_name: firstName,
        actions,
      }),
    });
    const text = await res.text().catch(() => "");
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return {
      ok: res.ok,
      status: res.status,
      text,
      json,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function syncDividedChatraceContact(input: {
  phone: string;
  firstName: string;
  fields: Record<string, string | number | null | undefined>;
  tagsToAdd?: string[];
  tagsToRemove?: string[];
}) : Promise<ChatraceDividedResult> {
  const config = getConfig();
  const phone = normalizeRecipientPhone(input.phone);
  const fields = Object.entries(input.fields);
  const tagsToAdd = (input.tagsToAdd ?? []).filter(Boolean);
  const tagsToRemove = (input.tagsToRemove ?? []).filter(Boolean);

  const debug: ChatraceDividedResult["debug"] = {
    phone,
    accountId: config.accountId,
    fields: fields.map(([key]) => key),
    tagsAdded: [...tagsToAdd],
    tagsRemoved: [...tagsToRemove],
    steps: {},
  };

  if (!phone) {
    return { ok: false, contactId: null, debug: { ...debug, error: "invalid_phone" } };
  }
  if (!config.baseUrl || !config.accountId || !config.token) {
    return { ok: false, contactId: null, debug: { ...debug, error: "missing_chatrace_config" } };
  }

  const fieldActions = fields.map(([fieldName, value]) => ({
    action: "set_field_value",
    field_name: fieldName,
    value: sanitizeValue(value),
  }));
  const fieldRes = await postActions(config, phone, input.firstName, fieldActions);
  debug.steps.fields = {
    ok: fieldRes.ok,
    status: fieldRes.status,
    bodySnippet: fieldRes.text.slice(0, 300),
  };
  debug.json = fieldRes.json;

  if (!fieldRes.ok) {
    return { ok: false, contactId: null, debug: { ...debug, error: "field_sync_failed" } };
  }

  const fieldJson = fieldRes.json as { data?: { id?: string }; id?: string } | null;
  const contactId = fieldJson?.data?.id ?? fieldJson?.id ?? null;

  if (tagsToAdd.length === 0 && tagsToRemove.length === 0) {
    return { ok: true, contactId, debug };
  }

  await new Promise((resolve) => setTimeout(resolve, 300));
  const tagActions = [
    ...tagsToRemove.map((tagName) => ({ action: "remove_tag", tag_name: tagName })),
    ...tagsToAdd.map((tagName) => ({ action: "add_tag", tag_name: tagName })),
  ];
  const tagRes = await postActions(config, phone, input.firstName, tagActions);
  debug.steps.tags = {
    ok: tagRes.ok,
    status: tagRes.status,
    bodySnippet: tagRes.text.slice(0, 300),
  };
  if (!tagRes.ok) {
    return { ok: false, contactId, debug: { ...debug, error: "tag_sync_failed" } };
  }

  return { ok: true, contactId, debug };
}
