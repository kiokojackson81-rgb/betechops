import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getKenyanPhoneVariants, normalizeKenyanPhone } from "@/lib/phone";

const NAIROBI_TIMEZONE = "Africa/Nairobi";

type VoicePayload = Record<string, string>;

type VoiceRouteTarget = {
  label: "BRENDAH" | "JENNIFER" | "ADMIN";
  phoneNumber: string;
  userId: string | null;
};

function formatNairobiParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: NAIROBI_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekday = String(values.weekday || "");
  const hour = Number(values.hour || "0");
  const minute = Number(values.minute || "0");
  return { weekday, hour, minute, totalMinutes: hour * 60 + minute };
}

export function isWithinVoiceWorkingHours(date = new Date()) {
  const { weekday, totalMinutes } = formatNairobiParts(date);
  if (weekday === "Sun") return false;
  if (weekday === "Sat") {
    return totalMinutes >= 9 * 60 && totalMinutes <= 15 * 60;
  }
  return totalMinutes >= 9 * 60 && totalMinutes <= 17 * 60 + 30;
}

function normalizeVoiceNumber(input: string | undefined) {
  return normalizeKenyanPhone(input || "");
}

function getConfiguredPhone(label: "BRENDAH" | "JENNIFER" | "ADMIN") {
  const envKey =
    label === "BRENDAH"
      ? "BETECH_VOICE_BRENDAH_NUMBER"
      : label === "JENNIFER"
        ? "BETECH_VOICE_JENNIFER_NUMBER"
        : "BETECH_VOICE_ADMIN_NUMBER";
  return normalizeVoiceNumber(process.env[envKey]);
}

async function resolveUserIdByPhone(phoneNumber: string) {
  const variants = getKenyanPhoneVariants(phoneNumber);
  if (!variants.length) return null;
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { phone: { in: variants } },
        { whatsappNumber: { in: variants } },
      ],
    },
    select: { id: true },
  });
  return user?.id ?? null;
}

async function buildVoiceTargets(): Promise<Record<VoiceRouteTarget["label"], VoiceRouteTarget>> {
  const brendahPhone = getConfiguredPhone("BRENDAH");
  const jenniferPhone = getConfiguredPhone("JENNIFER");
  const adminPhone = getConfiguredPhone("ADMIN");

  return {
    BRENDAH: {
      label: "BRENDAH",
      phoneNumber: brendahPhone,
      userId: brendahPhone ? await resolveUserIdByPhone(brendahPhone) : null,
    },
    JENNIFER: {
      label: "JENNIFER",
      phoneNumber: jenniferPhone,
      userId: jenniferPhone ? await resolveUserIdByPhone(jenniferPhone) : null,
    },
    ADMIN: {
      label: "ADMIN",
      phoneNumber: adminPhone,
      userId: adminPhone ? await resolveUserIdByPhone(adminPhone) : null,
    },
  };
}

export async function getVoiceRouteTargets(date = new Date()) {
  const targets = await buildVoiceTargets();
  const adminOnly = [targets.ADMIN].filter((target) => target.phoneNumber);
  if (!isWithinVoiceWorkingHours(date)) {
    return {
      routeType: "AFTER_HOURS",
      orderedTargets: adminOnly,
      primaryTarget: adminOnly[0] ?? null,
    };
  }

  const latestWorkingCall = await prisma.voiceCall.findFirst({
    where: {
      routeType: "WORKING_HOURS",
      direction: "INBOUND",
      routedTo: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: { routedTo: true },
  });

  const latestPrimary = String(latestWorkingCall?.routedTo || "").split(",")[0]?.trim();
  const startWithJennifer = latestPrimary === targets.BRENDAH.phoneNumber;
  const workingTargets = startWithJennifer
    ? [targets.JENNIFER, targets.BRENDAH, targets.ADMIN]
    : [targets.BRENDAH, targets.JENNIFER, targets.ADMIN];

  const orderedTargets = workingTargets.filter((target) => target.phoneNumber);
  return {
    routeType: "WORKING_HOURS",
    orderedTargets,
    primaryTarget: orderedTargets[0] ?? null,
  };
}

export function buildVoiceXmlResponse(input: {
  phoneNumbers: string[];
  preDialMessage?: string | null;
}) {
  const phoneNumbers = input.phoneNumbers.filter(Boolean).join(",");
  const sayPart = input.preDialMessage
    ? `<Say>${escapeXml(input.preDialMessage)}</Say>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${sayPart}<Dial record="true" sequential="true" phoneNumbers="${escapeXml(phoneNumbers)}" /></Response>`;
}

export function buildEmptyVoiceXmlResponse() {
  return `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function parseVoicePayloadFromRequest(request: Request) {
  const formData = await request.formData();
  const payload: VoicePayload = {};
  for (const [key, value] of formData.entries()) {
    payload[key] = typeof value === "string" ? value : value.name;
  }
  return payload;
}

export function normalizeVoiceStatus(payload: VoicePayload) {
  return (
    payload.status ||
    payload.callStatus ||
    payload.state ||
    (payload.isActive === "1" || payload.isActive?.toLowerCase() === "true" ? "in_progress" : "completed")
  );
}

function parseMoney(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(parsed)) return null;
  return new Prisma.Decimal(parsed.toFixed(2));
}

function parseInteger(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function parseDate(value: string | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function upsertVoiceCallFromPayload(payload: VoicePayload, input?: {
  routeType?: string | null;
  routedTo?: string | null;
  assignedToId?: string | null;
}) {
  const sessionId = String(payload.sessionId || payload.SessionId || "").trim();
  if (!sessionId) {
    throw new Error("missing_session_id");
  }

  const callerNumber = normalizeVoiceNumber(payload.callerNumber || payload.caller || payload.from);
  const destinationNumber = normalizeVoiceNumber(payload.destinationNumber || payload.to || payload.calledNumber);
  const status = normalizeVoiceStatus(payload);
  const isActive = ["1", "true", "yes"].includes(String(payload.isActive || "").toLowerCase());
  const customerId = callerNumber ? await resolveUserIdByPhone(callerNumber) : null;

  return prisma.voiceCall.upsert({
    where: { sessionId },
    create: {
      sessionId,
      direction: String(payload.direction || "INBOUND").toUpperCase(),
      callerNumber: callerNumber || String(payload.callerNumber || payload.caller || "unknown"),
      destinationNumber: destinationNumber || null,
      isActive,
      status,
      routedTo: input?.routedTo ?? null,
      routeType: input?.routeType ?? null,
      assignedToId: input?.assignedToId ?? null,
      customerId,
      startedAt: parseDate(payload.startTime) ?? new Date(),
      endedAt: parseDate(payload.endTime),
      durationInSeconds: parseInteger(payload.durationInSeconds || payload.duration),
      currencyCode: payload.currencyCode || null,
      amount: parseMoney(payload.amount),
      recordingUrl: payload.recordingUrl || null,
      menuOption: payload.menuOption || null,
      notes: payload.notes || null,
      rawPayloadJson: payload,
    },
    update: {
      direction: String(payload.direction || "INBOUND").toUpperCase(),
      callerNumber: callerNumber || String(payload.callerNumber || payload.caller || "unknown"),
      destinationNumber: destinationNumber || null,
      isActive,
      status,
      routedTo: input?.routedTo ?? undefined,
      routeType: input?.routeType ?? undefined,
      assignedToId: input?.assignedToId ?? undefined,
      customerId: customerId ?? undefined,
      endedAt: parseDate(payload.endTime) ?? undefined,
      durationInSeconds: parseInteger(payload.durationInSeconds || payload.duration) ?? undefined,
      currencyCode: payload.currencyCode || undefined,
      amount: parseMoney(payload.amount) ?? undefined,
      recordingUrl: payload.recordingUrl || undefined,
      menuOption: payload.menuOption || undefined,
      notes: payload.notes || undefined,
      rawPayloadJson: payload,
    },
  });
}

export async function createVoiceEventFromPayload(payload: VoicePayload, voiceCallId?: string | null) {
  const sessionId = String(payload.sessionId || payload.SessionId || "").trim();
  if (!sessionId) {
    throw new Error("missing_session_id");
  }

  return prisma.voiceEvent.create({
    data: {
      voiceCallId: voiceCallId ?? null,
      sessionId,
      eventType: String(payload.eventType || payload.status || payload.callStatus || "unknown"),
      payloadJson: payload,
    },
  });
}

function shouldCreateMissedLead(status: string) {
  const normalized = String(status || "").trim().toLowerCase();
  return [
    "missed",
    "no_answer",
    "no answer",
    "busy",
    "failed",
    "unanswered",
    "not_answered",
    "not answered",
  ].includes(normalized);
}

export async function createOrUpdateMissedVoiceLead(call: {
  callerNumber: string;
  status: string;
  startedAt?: Date | null;
  assignedToId?: string | null;
}) {
  if (!shouldCreateMissedLead(call.status) || !call.callerNumber) return null;

  const phone = normalizeVoiceNumber(call.callerNumber) || call.callerNumber;
  const customerId = phone ? await resolveUserIdByPhone(phone) : null;
  const existing = await prisma.voiceLead.findFirst({
    where: { phone, status: { in: ["open", "pending_follow_up"] } },
    orderBy: { updatedAt: "desc" },
  });

  if (existing) {
    return prisma.voiceLead.update({
      where: { id: existing.id },
      data: {
        source: "VOICE_MISSED_CALL",
        status: "pending_follow_up",
        assignedToId: call.assignedToId ?? existing.assignedToId,
        customerId: customerId ?? existing.customerId,
        lastCallAt: call.startedAt ?? new Date(),
      },
    });
  }

  return prisma.voiceLead.create({
    data: {
      phone,
      source: "VOICE_MISSED_CALL",
      status: "pending_follow_up",
      assignedToId: call.assignedToId ?? null,
      customerId,
      lastCallAt: call.startedAt ?? new Date(),
    },
  });
}
