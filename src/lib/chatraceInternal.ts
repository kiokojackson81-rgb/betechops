type ChatraceInternalConfig = {
  baseUrl: string;
  accountId: string;
  token: string;
  enabled: boolean;
  adminPhoneE164: string;
};

function getInternalConfig(): ChatraceInternalConfig {
  const enabled = process.env.CHATRACE_INTERNAL_ENABLED === "1";

  return {
    enabled,
    baseUrl: process.env.CHATRACE_INTERNAL_BASE_URL || "https://api.chatrace.com",
    accountId: process.env.CHATRACE_INTERNAL_ACCOUNT_ID || "",
    token: process.env.CHATRACE_INTERNAL_API_TOKEN || "",
    adminPhoneE164: process.env.CHATRACE_INTERNAL_ADMIN_PHONE || "",
  };
}

async function runInternalRequest(path: string, payload?: any) {
  const cfg = getInternalConfig();
  const url = `${cfg.baseUrl}${path}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-ACCESS-TOKEN": cfg.token,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const text = await res.text().catch(() => "");
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { ok: res.ok, status: res.status, text, json };
}

export async function pushOpsEventToChatraceInternal(input: {
  tagName: "ops_receipt_created" | "ops_daily_summary_8pm";
  fields: Record<string, string | number | null | undefined>;
}) {
  const cfg = getInternalConfig();

  const debug: any = {
    ok: false,
    enabled: cfg.enabled,
    env: {
      baseUrlPresent: !!cfg.baseUrl,
      accountIdPresent: !!cfg.accountId,
      tokenPresent: !!cfg.token,
      adminPhonePresent: !!cfg.adminPhoneE164,
    },
    steps: {},
  };

  if (!cfg.enabled) {
    return { ok: true, debug: { ...debug, skipped: "internal_disabled" } };
  }

  if (!cfg.token || !cfg.adminPhoneE164) {
    return {
      ok: false,
      debug: { ...debug, error: "Missing internal token or admin phone" },
    };
  }

  const actions = [
    { action: "add_tag", tag_name: input.tagName },
    ...Object.entries(input.fields).map(([field_name, value]) => ({
      action: "set_field_value",
      field_name,
      value: value == null ? "" : String(value),
    })),
  ];

  const payload = {
    phone: cfg.adminPhoneE164,
    first_name: "Betech Ops Admin",
    actions,
  };

  const res = await runInternalRequest("/contacts", payload);

  debug.steps.createOrUpdate = {
    status: res.status,
    ok: res.ok,
    bodySnippet: (res.text || "").slice(0, 300),
  };

  const success = Boolean(res.json?.success);
  debug.ok = Boolean(res.ok && success);

  return { ok: debug.ok, debug };
}
