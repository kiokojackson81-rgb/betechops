const AT_SANDBOX_BASE = "https://api.sandbox.africastalking.com/version1";
const AT_PRODUCTION_BASE = "https://api.africastalking.com/version1";

function getAfricaTalkingConfig() {
  const username = String(process.env.AFRICASTALKING_USERNAME || "").trim();
  const apiKey = String(process.env.AFRICASTALKING_API_KEY || "").trim();
  if (!username || !apiKey) {
    throw new Error("Africa's Talking credentials are not configured.");
  }

  return {
    username,
    apiKey,
    baseUrl: username === "sandbox" ? AT_SANDBOX_BASE : AT_PRODUCTION_BASE,
  };
}

export async function sendOtpSms(phone: string, code: string) {
  const { username, apiKey, baseUrl } = getAfricaTalkingConfig();
  const message = `Betech verification code: ${code}. Valid for 5 minutes.`;

  const body = new URLSearchParams({
    username,
    to: phone,
    message,
  });

  const response = await fetch(`${baseUrl}/messaging`, {
    method: "POST",
    headers: {
      apiKey,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      payload?.SMSMessageData?.Message ||
      payload?.errorMessage ||
      payload?.message ||
      `SMS provider error (${response.status})`;
    throw new Error(detail);
  }

  const recipients = payload?.SMSMessageData?.Recipients;
  if (Array.isArray(recipients) && recipients[0]?.status && recipients[0].status !== "Success") {
    throw new Error(recipients[0]?.status || "Failed to send OTP SMS.");
  }

  return payload;
}

