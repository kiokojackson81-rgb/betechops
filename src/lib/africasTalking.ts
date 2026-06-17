import { detectKenyanMobileNetwork } from "@/lib/phone";

const AT_SANDBOX_BASE = "https://api.sandbox.africastalking.com/version1";
const AT_PRODUCTION_BASE = "https://api.africastalking.com/version1";

type AfricaTalkingPayload = {
  username: string;
  to: string;
  message: string;
  from?: string;
};

const AT_SUCCESS_STATUS_CODES = new Set([100, 101, 102]);

export function getAfricaTalkingConfig() {
  const username = String(process.env.AFRICASTALKING_USERNAME || "").trim();
  const apiKey = String(process.env.AFRICASTALKING_API_KEY || "").trim();
  const senderId = String(
    process.env.AFRICASTALKING_SENDER_ID ||
      process.env.AFRICASTALKING_FROM ||
      process.env.AFRICASTALKING_SENDER ||
      "",
  ).trim();
  const environment = username === "sandbox" ? "sandbox" : "production";

  if (!username || !apiKey) {
    throw new Error("Africa's Talking credentials are not configured.");
  }

  if (!senderId) {
    console.warn("[africastalking] sender ID is missing", {
      username,
      environment,
    });
  }

  if (environment === "production" && !senderId) {
    throw new Error("Africa's Talking sender ID is required in production.");
  }

  return {
    username,
    apiKey,
    senderId,
    environment,
    baseUrl: environment === "sandbox" ? AT_SANDBOX_BASE : AT_PRODUCTION_BASE,
  };
}

function getAfricaTalkingAlternateConfig(primary: ReturnType<typeof getAfricaTalkingConfig>) {
  const username = String(
    process.env.AFRICASTALKING_ALT_USERNAME ||
      process.env.AFRICASTALKING_NON_SAFARICOM_USERNAME ||
      primary.username ||
      "",
  ).trim();
  const apiKey = String(
    process.env.AFRICASTALKING_ALT_API_KEY ||
      process.env.AFRICASTALKING_NON_SAFARICOM_API_KEY ||
      primary.apiKey ||
      "",
  ).trim();
  const senderId = String(
    process.env.AFRICASTALKING_ALT_SENDER_ID ||
      process.env.AFRICASTALKING_NON_SAFARICOM_SENDER_ID ||
      process.env.AFRICASTALKING_ALT_FROM ||
      process.env.AFRICASTALKING_NON_SAFARICOM_FROM ||
      "",
  ).trim();

  return {
    username,
    apiKey,
    senderId,
    environment: primary.environment,
    baseUrl: primary.baseUrl,
  };
}

function resolveSmsProfile(phone: string) {
  const primary = getAfricaTalkingConfig();
  const network = detectKenyanMobileNetwork(phone);
  const alternate = getAfricaTalkingAlternateConfig(primary);
  const useAlternate =
    network !== "safaricom" &&
    Boolean(alternate.senderId || (alternate.username && alternate.username !== primary.username));

  const selected = useAlternate ? alternate : primary;

  if (selected.environment === "production" && !selected.senderId) {
    throw new Error(
      useAlternate
        ? "Africa's Talking alternate sender ID is required for non-Safaricom SMS in production."
        : "Africa's Talking sender ID is required in production.",
    );
  }

  return {
    ...selected,
    network,
    profile: useAlternate ? "alternate" : "primary",
  };
}

export async function sendTransactionalSms(phone: string, message: string) {
  const { username, apiKey, senderId, baseUrl, environment, network, profile } = resolveSmsProfile(phone);
  const requestUrl = `${baseUrl}/messaging`;

  const requestPayload: AfricaTalkingPayload = {
    username,
    to: phone,
    message,
    ...(senderId ? { from: senderId } : {}),
  };

  console.log("AT SMS", {
    username,
    senderId,
    network,
    profile,
    phone,
    messageLength: message.length,
  });

  console.info("[africastalking] preparing transactional SMS request", {
    username,
    environment,
    senderId: senderId || null,
    network,
    profile,
    requestUrl,
    requestPayload,
  });

  const body = new URLSearchParams(requestPayload);
  const serializedPayload = body.toString();

  const response = await fetch(requestUrl, {
    method: "POST",
    headers: {
      apiKey,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: serializedPayload,
    cache: "no-store",
  });

  const rawBody = await response.text();
  let payload: unknown = null;
  try {
    payload = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    payload = rawBody || null;
  }

  const recipients =
    payload && typeof payload === "object"
      ? ((payload as { SMSMessageData?: { Recipients?: unknown } }).SMSMessageData?.Recipients as unknown)
      : undefined;
  const providerMessage =
    payload && typeof payload === "object"
      ? ((payload as { SMSMessageData?: { Message?: unknown } }).SMSMessageData?.Message as string | undefined)
      : undefined;

  console.info("[africastalking] transactional SMS response received", {
    username,
    environment,
    senderId: senderId || null,
    network,
    profile,
    serializedPayload,
    requestUrl,
    status: response.status,
    ok: response.ok,
    rawBody,
    payload,
    recipients,
  });

  if (!response.ok) {
    const payloadObject = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
    const detail =
      (payloadObject?.SMSMessageData as { Message?: string } | undefined)?.Message ||
      (payloadObject?.errorMessage as string | undefined) ||
      (payloadObject?.message as string | undefined) ||
      `SMS provider error (${response.status})`;
    console.error("[africastalking] transactional SMS request failed", {
      username,
      environment,
      senderId: senderId || null,
      network,
      profile,
      serializedPayload,
      requestUrl,
      status: response.status,
      rawBody,
      payload,
      detail,
    });
    throw new Error(detail);
  }

  if (!Array.isArray(recipients) || recipients.length === 0) {
    const detail = providerMessage || "SMS provider returned no recipients.";
    console.error("[africastalking] transactional SMS rejected by provider", {
      username,
      environment,
      senderId: senderId || null,
      network,
      profile,
      serializedPayload,
      requestUrl,
      recipients,
      rawBody,
      payload,
      detail,
    });
    throw new Error(detail);
  }

  const failedRecipient = recipients.find((recipient) => {
    if (!recipient || typeof recipient !== "object") {
      return true;
    }

    const statusCode = (recipient as { statusCode?: unknown }).statusCode;
    return typeof statusCode !== "number" || !AT_SUCCESS_STATUS_CODES.has(statusCode);
  }) as
    | { status?: string; statusCode?: number; number?: string; messageId?: string }
    | undefined;

  if (failedRecipient) {
    const detail =
      failedRecipient.status ||
      providerMessage ||
      `SMS provider rejected recipient${failedRecipient.number ? ` ${failedRecipient.number}` : ""}.`;
    console.error("[africastalking] transactional SMS rejected by provider", {
      username,
      environment,
      senderId: senderId || null,
      network,
      profile,
      serializedPayload,
      requestUrl,
      recipients,
      rawBody,
      payload,
      detail,
    });
    throw new Error(detail);
  }

  return payload;
}

export async function sendOtpSms(phone: string, code: string) {
  const message = `Betech verification code: ${code}. Valid for 5 minutes.`;
  return sendTransactionalSms(phone, message);
}
