const API_VERSION = process.env.WHATSAPP_API_VERSION || "v19.0";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

type WhatsAppBasePayload = {
  to: string;
};

export type WhatsAppTextPayload = WhatsAppBasePayload & {
  body: string;
  previewUrl?: boolean;
};

export type WhatsAppDocumentPayload = WhatsAppBasePayload & {
  link: string;
  filename?: string;
  caption?: string;
};

type WhatsAppApiError = {
  error?: { message?: string; code?: number; type?: string; error_subcode?: number; details?: string };
};

async function callWhatsAppApi(body: Record<string, unknown>) {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    throw new Error("WhatsApp Business configuration is missing");
  }
  const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      ...body,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as WhatsAppApiError | Record<string, unknown>;
  if (!res.ok) {
    const err = (data as WhatsAppApiError)?.error;
    const message = err?.message || `WhatsApp API error (${res.status})`;
    const meta = err ? ` [${err.type ?? "Error"}:${err.code ?? ""}${err.error_subcode ? `/${err.error_subcode}` : ""}]` : "";
    throw new Error(`${message}${meta}`);
  }
  return data;
}

export async function sendWhatsAppTextMessage(payload: WhatsAppTextPayload) {
  const { to, body, previewUrl = false } = payload;
  return callWhatsAppApi({
    to,
    type: "text",
    text: { body, preview_url: previewUrl },
  });
}

export async function sendWhatsAppDocumentMessage(payload: WhatsAppDocumentPayload) {
  const { to, link, filename, caption } = payload;
  return callWhatsAppApi({
    to,
    type: "document",
    document: { link, filename, caption },
  });
}

export function hasWhatsAppConfig() {
  return Boolean(PHONE_NUMBER_ID && ACCESS_TOKEN);
}
