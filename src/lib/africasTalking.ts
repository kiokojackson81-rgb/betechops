const AT_SANDBOX_BASE = "https://api.sandbox.africastalking.com/version1";
const AT_PRODUCTION_BASE = "https://api.africastalking.com/version1";

type AfricaTalkingPayload = {
  username: string;
  to: string;
  message: string;
  from?: string;
};

const AT_SUCCESS_STATUS_CODES = new Set([100, 101, 102]);

type SendSmsOptions = {
  allowSenderFallback?: boolean;
};

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

async function performSmsRequest(args: {
  username: string;
  apiKey: string;
  senderId: string;
  baseUrl: string;
  environment: string;
  phone: string;
  message: string;
  useSenderId: boolean;
}) {
  const { username, apiKey, senderId, baseUrl, environment, phone, message, useSenderId } = args;
  const requestUrl = `${baseUrl}/messaging`;

  const requestPayload: AfricaTalkingPayload = {
    username,
    to: phone,
    message,
    ...(useSenderId && senderId ? { from: senderId } : {}),
  };

  console.log("AT SMS", {
    username,
    senderId: useSenderId ? senderId : null,
    phone,
    messageLength: message.length,
  });

  console.info("[africastalking] preparing transactional SMS request", {
    username,
    environment,
    senderId: useSenderId && senderId ? senderId : null,
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
    senderId: useSenderId && senderId ? senderId : null,
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
      senderId: useSenderId && senderId ? senderId : null,
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
      senderId: useSenderId && senderId ? senderId : null,
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
      senderId: useSenderId && senderId ? senderId : null,
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

export async function sendTransactionalSms(phone: string, message: string, options: SendSmsOptions = {}) {
  const { username, apiKey, senderId, baseUrl, environment } = getAfricaTalkingConfig();

  try {
    return await performSmsRequest({
      username,
      apiKey,
      senderId,
      baseUrl,
      environment,
      phone,
      message,
      useSenderId: Boolean(senderId),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const canRetryWithoutSender =
      options.allowSenderFallback !== false &&
      environment === "production" &&
      Boolean(senderId) &&
      detail === "InvalidSenderId";

    if (!canRetryWithoutSender) {
      throw error;
    }

    console.warn("[africastalking] retrying transactional SMS without sender ID after provider rejection", {
      username,
      environment,
      senderId,
      phone,
      detail,
    });

    return performSmsRequest({
      username,
      apiKey,
      senderId,
      baseUrl,
      environment,
      phone,
      message,
      useSenderId: false,
    });
  }
}

export async function sendOtpSms(phone: string, code: string) {
  const message = `Betech verification code: ${code}. Valid for 5 minutes.`;
  return sendTransactionalSms(phone, message, { allowSenderFallback: true });
}
