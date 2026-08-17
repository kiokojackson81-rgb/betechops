import { safeString } from "@/lib/voice";
import { toSpeechText } from "@/lib/voiceSpeech";

export type VoiceRouteHop = {
  label: string;
  dialValue: string;
  targetUserId: string | null;
};

export type VoiceRoutePlan = {
  hops: VoiceRouteHop[];
  primaryTargetUserId: string | null;
  routeType: string | null;
  routeReason?: string | null;
  routedTo: string;
};

export const BETECH_WORKING_HOURS_WELCOME_MESSAGE = [
  "Welcome to Betech Solar Solutions.",
  "Please hold as we connect you to our customer service team.",
  "If you wish to speak to our technician, press 1.",
].join(" ");

export const BETECH_WORKING_HOURS_DIGITS_PROMPT =
  "Please hold while we connect your call.";
const BETECH_WORKING_HOURS_GET_DIGITS_FILLER = "\u200B";
const BETECH_WORKING_HOURS_DIGITS_TIMEOUT_SECONDS = 2;

export const BETECH_AFTER_HOURS_WELCOME_MESSAGE = [
  "Welcome to Betech Solar Solutions.",
].join(" ");

export function escapeVoiceXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function encodeRoutePlan(plan: VoiceRoutePlan) {
  return Buffer.from(JSON.stringify(plan), "utf8").toString("base64url");
}

export function decodeRoutePlan(serialized: string | null) {
  if (!serialized) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(serialized, "base64url").toString("utf8"),
    ) as Partial<VoiceRoutePlan>;
    if (!Array.isArray(parsed.hops) || !parsed.hops.length) return null;
    return {
      hops: parsed.hops
        .map((hop) => ({
          label: safeString(hop?.label),
          dialValue: safeString(hop?.dialValue),
          targetUserId: safeString(hop?.targetUserId || "") || null,
        }))
        .filter((hop) => hop.label && hop.dialValue),
      primaryTargetUserId: safeString(parsed.primaryTargetUserId || "") || null,
      routeType: safeString(parsed.routeType || "") || null,
      routeReason: safeString(parsed.routeReason || "") || null,
      routedTo: safeString(parsed.routedTo || ""),
    } satisfies VoiceRoutePlan;
  } catch {
    return null;
  }
}

export function buildRoutePlanRedirectUrl(
  requestUrl: URL,
  plan: VoiceRoutePlan,
  hopIndex: number,
) {
  const redirectUrl = new URL("/api/voice/callback", requestUrl.origin);
  redirectUrl.searchParams.set("hop", String(hopIndex));
  redirectUrl.searchParams.set("routePlan", encodeRoutePlan(plan));
  return redirectUrl.toString();
}

export function buildDialAttemptXml(input: {
  phoneNumber: string;
  redirectUrl?: string | null;
  preDialMessage?: string | null;
  maxDurationSeconds?: number;
}) {
  const sayPart = input.preDialMessage
    ? `<Say voice="woman">${escapeVoiceXml(toSpeechText(input.preDialMessage))}</Say>`
    : "";
  const maxDurationPart = input.maxDurationSeconds
    ? ` maxDuration="${input.maxDurationSeconds}"`
    : "";
  const redirectPart = input.redirectUrl
    ? `<Redirect>${escapeVoiceXml(input.redirectUrl)}</Redirect>`
    : "";
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response>${sayPart}<Dial record="true" phoneNumbers="${escapeVoiceXml(input.phoneNumber)}"${maxDurationPart} />${redirectPart}</Response>`
  );
}

export function buildWorkingHoursIvrXml(input: {
  callbackUrl: string;
  fallbackPhoneNumber?: string | null;
  fallbackRedirectUrl?: string | null;
}) {
  const fallbackDialPart = input.fallbackPhoneNumber
    ? `<Dial record="true" phoneNumbers="${escapeVoiceXml(input.fallbackPhoneNumber)}" />`
    : "";
  const fallbackRedirectPart = input.fallbackRedirectUrl
    ? `<Redirect>${escapeVoiceXml(input.fallbackRedirectUrl)}</Redirect>`
    : "";
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response>` +
    `<Say voice="woman">${escapeVoiceXml(toSpeechText(BETECH_WORKING_HOURS_WELCOME_MESSAGE))}</Say>` +
    `<GetDigits timeout="${BETECH_WORKING_HOURS_DIGITS_TIMEOUT_SECONDS}" numDigits="1" callbackUrl="${escapeVoiceXml(input.callbackUrl)}">` +
    `<Say voice="woman">${BETECH_WORKING_HOURS_GET_DIGITS_FILLER}</Say>` +
    `</GetDigits>` +
    fallbackDialPart +
    fallbackRedirectPart +
    `</Response>`
  );
}

export function buildVoiceRoutePlanFromPhoneNumbers(input: {
  labels?: string[];
  phoneNumbers: string[];
  targetUserIds?: Array<string | null>;
  routeType: string;
}) {
  const normalizedNumbers = input.phoneNumbers
    .map((number) => safeString(number))
    .filter(Boolean);
  return {
    hops: normalizedNumbers.map((dialValue, index) => ({
      label: input.labels?.[index] || `${input.routeType}_${index + 1}`,
      dialValue,
      targetUserId: input.targetUserIds?.[index] ?? null,
    })),
    primaryTargetUserId: null,
    routeType: input.routeType,
    routeReason: null,
    routedTo: normalizedNumbers.join(","),
  } satisfies VoiceRoutePlan;
}

export function getAdminPhoneNumbers() {
  const configured = safeString(process.env.BETECH_VOICE_ADMIN_NUMBER);
  if (!configured) return ["+254705663175"];
  return configured
    .split(",")
    .map((value) => safeString(value))
    .filter(Boolean);
}

export function getIvrDigits(payload: Record<string, string>) {
  return safeString(
    payload.dtmfDigits ||
      payload.DTMFDigits ||
      payload.digits ||
      payload.Digits ||
      payload.digit ||
      payload.Digit ||
      payload.value ||
      payload.Value,
  );
}
