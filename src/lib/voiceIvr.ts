import { safeString } from "@/lib/voice";

export const VOICE_HOP_MAX_DURATION_SECONDS = 15;

export type VoiceRouteHop = {
  label: string;
  dialValue: string;
};

export type VoiceRoutePlan = {
  hops: VoiceRouteHop[];
  primaryTargetUserId: string | null;
  routeType: string | null;
  routedTo: string;
};

export const BETECH_WORKING_HOURS_WELCOME_MESSAGE = [
  "Welcome to Betech Solar Solutions. Please hold while we connect your call to our customer service team.",
  "We specialize in solar system installation, solar water pumping solutions, solar water heating systems, solar panels, hybrid inverters, lithium and gel batteries, and complete solar accessories.",
  "Visit our showroom at Pramukh Plaza, Third Floor, Shop Number 3, at the junction of Munyu Road and Sheikh Karume Road, Nairobi CBD.",
  "You can also explore our products at www.betech.co.ke or view our recent installations on TikTok by searching Solar Projects.",
  "If you wish to speak to our technical team, press 1.",
].join(" ");

export const BETECH_WORKING_HOURS_DIGITS_PROMPT =
  "Press 1 to speak to our technical team. Otherwise, please hold as we connect your call to our customer service team.";

export const BETECH_CONNECTING_PROMPT = "Please hold as we connect your call.";

export const BETECH_AFTER_HOURS_WELCOME_MESSAGE = [
  "Welcome to Betech Solar Solutions.",
  "We specialize in solar system installation, solar water pumping solutions, solar water heating systems, solar panels, hybrid inverters, lithium and gel batteries, and complete solar accessories.",
  "Visit our showroom at Pramukh Plaza, Third Floor, Shop Number 3, at the junction of Munyu Road and Sheikh Karume Road, Nairobi CBD.",
  "You can also explore our products at www.betech.co.ke or view our recent installations on TikTok by searching Solar Projects.",
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
    const parsed = JSON.parse(Buffer.from(serialized, "base64url").toString("utf8")) as Partial<VoiceRoutePlan>;
    if (!Array.isArray(parsed.hops) || !parsed.hops.length) return null;
    return {
      hops: parsed.hops
        .map((hop) => ({
          label: safeString(hop?.label),
          dialValue: safeString(hop?.dialValue),
        }))
        .filter((hop) => hop.label && hop.dialValue),
      primaryTargetUserId: safeString(parsed.primaryTargetUserId || "") || null,
      routeType: safeString(parsed.routeType || "") || null,
      routedTo: safeString(parsed.routedTo || ""),
    } satisfies VoiceRoutePlan;
  } catch {
    return null;
  }
}

export function buildRoutePlanRedirectUrl(requestUrl: URL, plan: VoiceRoutePlan, hopIndex: number) {
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
  const sayPart = input.preDialMessage ? `<Say voice="woman">${escapeVoiceXml(input.preDialMessage)}</Say>` : "";
  const maxDurationPart = input.maxDurationSeconds ? ` maxDuration="${input.maxDurationSeconds}"` : "";
  const redirectPart = input.redirectUrl ? `<Redirect>${escapeVoiceXml(input.redirectUrl)}</Redirect>` : "";
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response>${sayPart}<Dial record="true" phoneNumbers="${escapeVoiceXml(input.phoneNumber)}"${maxDurationPart} />${redirectPart}</Response>`
  );
}

export function buildWorkingHoursIvrXml(callbackUrl: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response>` +
    `<Say voice="woman">${escapeVoiceXml(BETECH_WORKING_HOURS_WELCOME_MESSAGE)}</Say>` +
    `<GetDigits timeout="5" numDigits="1" callbackUrl="${escapeVoiceXml(callbackUrl)}">` +
    `<Say voice="woman">${escapeVoiceXml(BETECH_WORKING_HOURS_DIGITS_PROMPT)}</Say>` +
    `</GetDigits>` +
    `</Response>`;
}

export function buildVoiceRoutePlanFromPhoneNumbers(input: {
  labels?: string[];
  phoneNumbers: string[];
  routeType: string;
}) {
  const normalizedNumbers = input.phoneNumbers.map((number) => safeString(number)).filter(Boolean);
  return {
    hops: normalizedNumbers.map((dialValue, index) => ({
      label: input.labels?.[index] || `${input.routeType}_${index + 1}`,
      dialValue,
    })),
    primaryTargetUserId: null,
    routeType: input.routeType,
    routedTo: normalizedNumbers.join(","),
  } satisfies VoiceRoutePlan;
}

export function getTechnicalTeamPhoneNumbers() {
  const configured = safeString(process.env.BETECH_VOICE_TECH_TEAM_NUMBERS || process.env.BETECH_VOICE_TECH_TEAM_NUMBER);
  if (!configured) return ["+254722151083"];
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
