const AT_SANDBOX_BASE = "https://api.sandbox.africastalking.com/version1";
const AT_PRODUCTION_BASE = "https://api.africastalking.com/version1";

export function getAfricaTalkingConfig() {
  const username = String(process.env.AFRICASTALKING_USERNAME || "").trim();
  const apiKey = String(process.env.AFRICASTALKING_API_KEY || "").trim();
  const senderId = String(
    process.env.AFRICASTALKING_SENDER_ID ||
      process.env.AFRICASTALKING_FROM ||
      process.env.AFRICASTALKING_SENDER ||
      "",
  ).trim();
  if (!username || !apiKey) {
    throw new Error("Africa's Talking credentials are not configured.");
  }

  return {
    username,
    apiKey,
    senderId,
    environment: username === "sandbox" ? "sandbox" : "production",
    baseUrl: username === "sandbox" ? AT_SANDBOX_BASE : AT_PRODUCTION_BASE,
  };
}

export async function sendOtpSms(phone: string, code: string) {
  const { username, apiKey, senderId, baseUrl, environment } = getAfricaTalkingConfig();
  const message = `Betech verification code: ${code}. Valid for 5 minutes.`;
  const requestUrl = `${baseUrl}/messaging`;

  const requestPayload = {
    username,
    to: phone,
    message,
    ...(senderId ? { from: senderId } : {}),
  };

  console.info("[africastalking] preparing OTP SMS request", {
    username,
    environment,
    senderId: senderId || null,
    hasApiKey: Boolean(apiKey),
    apiKeyLength: apiKey.length,
    requestUrl,
    requestPayload,
  });

  const body = new URLSearchParams(requestPayload);

  const response = await fetch(requestUrl, {
    method: "POST",
    headers: {
      apiKey,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  const rawBody = await response.text();
  let payload: unknown = null;
  try {
    payload = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    payload = rawBody || null;
  }

  console.info("[africastalking] OTP SMS response received", {
    username,
    environment,
    senderId: senderId || null,
    hasApiKey: Boolean(apiKey),
    apiKeyLength: apiKey.length,
    requestUrl,
    status: response.status,
    ok: response.ok,
    rawBody,
    payload,
  });

  if (!response.ok) {
    const payloadObject = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
    const detail =
      (payloadObject?.SMSMessageData as { Message?: string } | undefined)?.Message ||
      (payloadObject?.errorMessage as string | undefined) ||
      (payloadObject?.message as string | undefined) ||
      `SMS provider error (${response.status})`;
    console.error("[africastalking] OTP SMS request failed", {
      username,
      environment,
      senderId: senderId || null,
      hasApiKey: Boolean(apiKey),
      apiKeyLength: apiKey.length,
      requestUrl,
      status: response.status,
      rawBody,
      payload,
      detail,
    });
    throw new Error(detail);
  }

  const recipients =
    payload && typeof payload === "object"
      ? ((payload as { SMSMessageData?: { Recipients?: unknown } }).SMSMessageData?.Recipients as unknown)
      : undefined;

  if (Array.isArray(recipients) && recipients[0]?.status && recipients[0].status !== "Success") {
    console.error("[africastalking] OTP SMS rejected by provider", {
      username,
      environment,
      senderId: senderId || null,
      hasApiKey: Boolean(apiKey),
      apiKeyLength: apiKey.length,
      requestUrl,
      recipients,
      rawBody,
      payload,
    });
    throw new Error(recipients[0]?.status || "Failed to send OTP SMS.");
  }

  return payload;
}
