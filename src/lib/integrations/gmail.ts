"use server";

type GmailTokenResponse = {
  access_token: string;
  expires_in: number;
  scope?: string;
  token_type: string;
};

export type GmailListMessagesResponse = {
  messages?: { id: string; threadId?: string }[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

export type GmailHeader = { name: string; value: string };
export type GmailMessagePartBody = { size?: number; data?: string; attachmentId?: string };
export type GmailMessagePart = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: GmailMessagePartBody;
  parts?: GmailMessagePart[];
};

export type GmailMessage = {
  id: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailMessagePart & { headers?: GmailHeader[] };
};

const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";

export function decodeBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

export function getHeader(headers: GmailHeader[] | undefined, name: string): string | null {
  if (!headers?.length) return null;
  const target = name.trim().toLowerCase();
  const found = headers.find((h) => h.name?.trim().toLowerCase() === target);
  return found?.value ?? null;
}

export function extractEmailAddress(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const m = s.match(/<([^>]+@[^>]+)>/);
  if (m?.[1]) return m[1].trim().toLowerCase();
  const m2 = s.match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  return m2?.[1] ? m2[1].trim().toLowerCase() : null;
}

function walkParts(part: GmailMessagePart | undefined, out: GmailMessagePart[] = []): GmailMessagePart[] {
  if (!part) return out;
  out.push(part);
  if (part.parts?.length) {
    for (const child of part.parts) walkParts(child, out);
  }
  return out;
}

export function extractBodyParts(message: GmailMessage): { html: string | null; text: string | null } {
  const parts = walkParts(message.payload);
  let html: string | null = null;
  let text: string | null = null;

  for (const p of parts) {
    const mime = (p.mimeType ?? "").toLowerCase();
    const data = p.body?.data;
    if (!data) continue;
    const decoded = decodeBase64Url(data).toString("utf8");
    if (!html && mime.includes("text/html")) html = decoded;
    if (!text && mime.includes("text/plain")) text = decoded;
  }

  return { html, text };
}

export async function refreshGmailAccessToken(opts: {
  refreshToken: string;
  clientId?: string;
  clientSecret?: string;
}): Promise<{ accessToken: string; expiresIn: number; scope?: string }> {
  const clientId = (opts.clientId ?? process.env.GOOGLE_OAUTH_CLIENT_ID ?? "").trim();
  const clientSecret = (opts.clientSecret ?? process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "").trim();
  if (!clientId || !clientSecret) throw new Error("Missing GOOGLE_OAUTH_CLIENT_ID/GOOGLE_OAUTH_CLIENT_SECRET");

  const body = new URLSearchParams();
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("refresh_token", opts.refreshToken);
  body.set("grant_type", "refresh_token");

  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google token refresh failed (${res.status}): ${text || res.statusText}`);
  }
  const json = (await res.json()) as GmailTokenResponse;
  return { accessToken: json.access_token, expiresIn: json.expires_in, scope: json.scope };
}

export async function gmailListMessages(opts: {
  accessToken: string;
  q: string;
  maxResults?: number;
  pageToken?: string;
}): Promise<GmailListMessagesResponse> {
  const url = new URL(`${GMAIL_API_BASE}/users/me/messages`);
  url.searchParams.set("q", opts.q);
  url.searchParams.set("maxResults", String(opts.maxResults ?? 100));
  if (opts.pageToken) url.searchParams.set("pageToken", opts.pageToken);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${opts.accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gmail list failed (${res.status}): ${text || res.statusText}`);
  }
  return (await res.json()) as GmailListMessagesResponse;
}

export async function gmailGetMessage(opts: { accessToken: string; messageId: string }): Promise<GmailMessage> {
  const url = new URL(`${GMAIL_API_BASE}/users/me/messages/${encodeURIComponent(opts.messageId)}`);
  url.searchParams.set("format", "full");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${opts.accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gmail get failed (${res.status}): ${text || res.statusText}`);
  }
  return (await res.json()) as GmailMessage;
}

