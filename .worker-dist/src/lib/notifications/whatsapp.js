"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWhatsAppTextMessage = sendWhatsAppTextMessage;
exports.sendWhatsAppDocumentMessage = sendWhatsAppDocumentMessage;
exports.hasWhatsAppConfig = hasWhatsAppConfig;
const API_VERSION = process.env.WHATSAPP_API_VERSION || "v19.0";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
async function callWhatsAppApi(body) {
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
    const data = (await res.json().catch(() => ({})));
    if (!res.ok) {
        const err = data?.error;
        const message = err?.message || `WhatsApp API error (${res.status})`;
        const meta = err ? ` [${err.type ?? "Error"}:${err.code ?? ""}${err.error_subcode ? `/${err.error_subcode}` : ""}]` : "";
        throw new Error(`${message}${meta}`);
    }
    return data;
}
async function sendWhatsAppTextMessage(payload) {
    const { to, body, previewUrl = false } = payload;
    return callWhatsAppApi({
        to,
        type: "text",
        text: { body, preview_url: previewUrl },
    });
}
async function sendWhatsAppDocumentMessage(payload) {
    const { to, link, filename, caption } = payload;
    return callWhatsAppApi({
        to,
        type: "document",
        document: { link, filename, caption },
    });
}
function hasWhatsAppConfig() {
    return Boolean(PHONE_NUMBER_ID && ACCESS_TOKEN);
}
