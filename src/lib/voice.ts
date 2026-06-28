import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getKenyanPhoneVariants, normalizeKenyanPhone } from "@/lib/phone";
import { resolveVoiceCustomerLinkByPhone } from "@/lib/voiceCustomerContext";
import { publishVoiceLiveEvent } from "@/lib/voiceLiveEvents";
import { buildVoiceWebrtcIdentity } from "@/lib/voiceOperations";
import { isVoiceWebrtcClientReady } from "@/lib/voiceWebrtc/registry";

const NAIROBI_TIMEZONE = "Africa/Nairobi";

type VoicePayload = Record<string, string>;

type VoiceRouteTarget = {
  label: "BRENDAH" | "JENNIFER" | "ADMIN";
  phoneNumber: string;
  userId: string | null;
  presenceStatus: string;
  isAvailable: boolean;
  lastSeenAt: Date | null;
  webRtcIdentity: string | null;
  isWebrtcRegistered: boolean;
  dialValue: string;
  dialValues: string[];
  skipReasons: string[];
};

const VOICE_PRESENCE_ROUTING_WINDOW_MS = 90 * 1000;

function isVoiceWebrtcEnabled() {
  return String(process.env.NEXT_PUBLIC_VOICE_WEBRTC_ENABLED || "").trim().toLowerCase() === "true";
}

function getDefaultWebrtcClientName(label: VoiceRouteTarget["label"]) {
  if (label === "BRENDAH") return "brendah";
  if (label === "JENNIFER") return "jennifer";
  return "jackson";
}

export function safeString(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

export function safeNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(safeString(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function isVoiceCallActive(payload: VoicePayload) {
  const rawIsActive = safeString(payload.isActive).toLowerCase();
  if (["1", "true", "yes"].includes(rawIsActive)) return true;
  if (["0", "false", "no"].includes(rawIsActive)) return false;

  const sessionState = safeString(payload.callSessionState).toLowerCase();
  if (["completed", "ended", "terminated", "aborted", "failed"].includes(sessionState)) {
    return false;
  }

  const status = safeString(payload.status).toLowerCase();
  if (["completed", "aborted", "failed", "busy", "no answer", "no_answer"].includes(status)) {
    return false;
  }

  return false;
}

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

function normalizeCompareValue(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

async function resolveRoutingUsers() {
  const brendahPhone = getConfiguredPhone("BRENDAH");
  const jenniferPhone = getConfiguredPhone("JENNIFER");
  const adminPhone = getConfiguredPhone("ADMIN");

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { role: "ADMIN" },
        { phone: { in: [brendahPhone, jenniferPhone, adminPhone].filter(Boolean) } },
        { email: { contains: "brendah", mode: "insensitive" } },
        { email: { contains: "jen", mode: "insensitive" } },
        { email: { contains: "jackson", mode: "insensitive" } },
        { name: { contains: "Brendah", mode: "insensitive" } },
        { name: { contains: "Jennifer", mode: "insensitive" } },
        { name: { contains: "Jackson", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  const findUserId = (label: VoiceRouteTarget["label"], phoneNumber: string | null) => {
    const matched = users.find((user) => {
      const normalizedPhone = normalizeCompareValue(user.phone);
      const normalizedEmail = normalizeCompareValue(user.email);
      const normalizedName = normalizeCompareValue(user.name);
      if (phoneNumber && normalizedPhone === normalizeCompareValue(phoneNumber)) return true;
      if (label === "BRENDAH") {
        return normalizedEmail.includes("brendah") || normalizedName.includes("brendah");
      }
      if (label === "JENNIFER") {
        return normalizedEmail.includes("jen") || normalizedName.includes("jennifer") || normalizedName.includes("jeniffer");
      }
      return (
        normalizedEmail.includes("jackson") ||
        normalizedName.includes("jackson") ||
        normalizeCompareValue(user.role) === "admin"
      );
    });

    return matched?.id ?? null;
  };

  return {
    BRENDAH: findUserId("BRENDAH", brendahPhone),
    JENNIFER: findUserId("JENNIFER", jenniferPhone),
    ADMIN: findUserId("ADMIN", adminPhone),
  };
}

async function buildVoiceTargets(): Promise<Record<VoiceRouteTarget["label"], VoiceRouteTarget>> {
  const brendahPhone = getConfiguredPhone("BRENDAH");
  const jenniferPhone = getConfiguredPhone("JENNIFER");
  const adminPhone = getConfiguredPhone("ADMIN");
  const routingUsers = await resolveRoutingUsers();
  const brendahUserId = routingUsers.BRENDAH;
  const jenniferUserId = routingUsers.JENNIFER;
  const adminUserId = routingUsers.ADMIN;

  const userIds = [brendahUserId, jenniferUserId, adminUserId].filter((value): value is string => Boolean(value));
  const presences = userIds.length
    ? await prisma.voiceAgentPresence.findMany({
        where: { userId: { in: userIds } },
        select: {
          userId: true,
          status: true,
          lastSeenAt: true,
        },
      })
    : [];
  const presenceByUserId = new Map(presences.map((presence) => [presence.userId, presence]));
  const now = Date.now();

  const toTarget = (label: VoiceRouteTarget["label"], phoneNumber: string, userId: string | null): VoiceRouteTarget => {
    const presence = userId ? presenceByUserId.get(userId) : null;
    const webRtcRegistration = userId ? isVoiceWebrtcClientReady(userId) : null;
    const presenceStatus = safeString(presence?.status).toUpperCase() || "OFFLINE";
    const lastSeenAt = presence?.lastSeenAt ?? null;
    const skipReasons: string[] = [];
    if (!phoneNumber) skipReasons.push("missing_mobile_fallback");
    if (!userId) skipReasons.push("missing_routing_user");
    if (!presence) {
      skipReasons.push("missing_presence");
    } else {
      if (presenceStatus !== "AVAILABLE") {
        skipReasons.push(`status_${presenceStatus.toLowerCase()}`);
      }
      if (lastSeenAt && now - lastSeenAt.getTime() > VOICE_PRESENCE_ROUTING_WINDOW_MS) {
        skipReasons.push("stale_presence");
      }
      if (!lastSeenAt) {
        skipReasons.push("missing_last_seen");
      }
    }
    const isAvailable =
      presenceStatus === "AVAILABLE" &&
      Boolean(lastSeenAt) &&
      now - (lastSeenAt?.getTime() ?? 0) <= VOICE_PRESENCE_ROUTING_WINDOW_MS;
    const webRtcIdentity = webRtcRegistration?.identity ?? buildVoiceWebrtcIdentity(getDefaultWebrtcClientName(label)) ?? null;
    if (isVoiceWebrtcEnabled()) {
      if (!webRtcRegistration?.identity) skipReasons.push("missing_browser_identity");
      if (!webRtcRegistration) skipReasons.push("browser_not_registered");
    }
    const shouldUseWebrtc = isVoiceWebrtcEnabled() && Boolean(webRtcRegistration?.identity) && isAvailable;
    const dialValues = shouldUseWebrtc
      ? [String(webRtcRegistration?.identity || ""), phoneNumber].filter(Boolean)
      : [phoneNumber].filter(Boolean);

    const target = {
      label,
      phoneNumber,
      userId,
      presenceStatus,
      isAvailable,
      lastSeenAt,
      webRtcIdentity,
      isWebrtcRegistered: Boolean(webRtcRegistration?.identity),
      dialValue: dialValues[0] || phoneNumber,
      dialValues,
      skipReasons,
    };

    console.info("[voice.routing.target]", {
      label,
      phoneNumber,
      userId,
      presenceStatus,
      lastSeenAt: lastSeenAt?.toISOString() ?? null,
      isAvailable,
      isWebrtcRegistered: Boolean(webRtcRegistration?.identity),
      webRtcIdentity,
      dialValues,
      skipped: !isAvailable,
      skipReasons,
    });

    return target;
  };

  return {
    BRENDAH: toTarget("BRENDAH", brendahPhone, brendahUserId),
    JENNIFER: toTarget("JENNIFER", jenniferPhone, jenniferUserId),
    ADMIN: toTarget("ADMIN", adminPhone, adminUserId),
  };
}

type VoiceRouteSelection = {
  preferredTarget: VoiceRouteTarget | null;
  orderedTargets: VoiceRouteTarget[];
  routeReason: "after_hours" | "returning_customer" | "round_robin" | "admin_only";
};

async function findPreviousAgentTarget(
  callerNumber: string | null,
  agentTargets: VoiceRouteTarget[],
): Promise<VoiceRouteTarget | null> {
  if (!callerNumber) return null;
  const phoneVariants = getKenyanPhoneVariants(callerNumber);
  if (!phoneVariants.length) return null;

  const agentUserIds = agentTargets.map((target) => target.userId).filter((value): value is string => Boolean(value));
  if (!agentUserIds.length) return null;

  const lastCall = await prisma.voiceCall.findFirst({
    where: {
      direction: "INBOUND",
      callerNumber: { in: phoneVariants },
      assignedToId: { in: agentUserIds },
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      assignedToId: true,
    },
  });

  if (!lastCall?.assignedToId) return null;
  return agentTargets.find((target) => target.userId === lastCall.assignedToId) ?? null;
}

async function callerPrefersAdminFirst(
  callerNumber: string | null,
  agentTargets: VoiceRouteTarget[],
) {
  if (!callerNumber) return false;
  const phoneVariants = getKenyanPhoneVariants(callerNumber);
  if (!phoneVariants.length) return false;

  const agentUserIds = agentTargets.map((target) => target.userId).filter((value): value is string => Boolean(value));
  if (!agentUserIds.length) return false;

  const lastTechnicalRouting = await prisma.voiceCall.findFirst({
    where: {
      direction: "INBOUND",
      callerNumber: { in: phoneVariants },
      assignedToId: { in: agentUserIds },
      OR: [
        { routeType: "TECHNICAL_TEAM" },
        { menuOption: "1" },
      ],
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
    },
  });

  return Boolean(lastTechnicalRouting);
}

async function findRoundRobinTarget(agentTargets: VoiceRouteTarget[]) {
  const agentUserIds = agentTargets.map((target) => target.userId).filter((value): value is string => Boolean(value));
  if (!agentUserIds.length) return agentTargets[0] ?? null;

  const lastAssignedCall = await prisma.voiceCall.findFirst({
    where: {
      direction: "INBOUND",
      assignedToId: { in: agentUserIds },
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      assignedToId: true,
    },
  });

  if (!lastAssignedCall?.assignedToId) return agentTargets[0] ?? null;
  const lastIndex = agentTargets.findIndex((target) => target.userId === lastAssignedCall.assignedToId);
  if (lastIndex < 0) return agentTargets[0] ?? null;
  return agentTargets[(lastIndex + 1) % agentTargets.length] ?? agentTargets[0] ?? null;
}

function buildWorkingHoursSelection(input: {
  preferredTarget: VoiceRouteTarget | null;
  agentTargets: VoiceRouteTarget[];
  adminTarget: VoiceRouteTarget;
  routeReason: VoiceRouteSelection["routeReason"];
  preferAdminFirst?: boolean;
}): VoiceRouteSelection {
  const alternateTargets = input.agentTargets.filter(
    (target) => target.userId && target.userId !== input.preferredTarget?.userId,
  );
  const orderedTargets = (
    input.preferAdminFirst
      ? [
          ...(input.adminTarget.phoneNumber ? [input.adminTarget] : []),
          ...(input.preferredTarget?.phoneNumber ? [input.preferredTarget] : []),
          ...alternateTargets.filter((target) => Boolean(target.phoneNumber)),
        ]
      : [
          ...(input.preferredTarget?.phoneNumber ? [input.preferredTarget] : []),
          ...alternateTargets.filter((target) => Boolean(target.phoneNumber)),
          ...(input.adminTarget.phoneNumber ? [input.adminTarget] : []),
        ]
  ).filter((target, index, array) => array.findIndex((candidate) => candidate.label === target.label) === index);

  return {
    preferredTarget: input.preferredTarget,
    orderedTargets,
    routeReason: input.routeReason,
  };
}

export async function getVoiceRouteTargets(input?: Date | { date?: Date; callerNumber?: string | null }) {
  const date = input instanceof Date ? input : input?.date ?? new Date();
  const callerNumber = normalizeVoiceNumber(input instanceof Date ? "" : input?.callerNumber || "");
  const targets = await buildVoiceTargets();
  const allConfiguredTargets = [targets.BRENDAH, targets.JENNIFER, targets.ADMIN].filter((target) => target.phoneNumber);
  const agentTargets = [targets.BRENDAH, targets.JENNIFER].filter((target) => target.phoneNumber);
  const adminTarget = targets.ADMIN;

  if (!isWithinVoiceWorkingHours(date)) {
    const fallbackTargets = [adminTarget].filter((target) => target.phoneNumber && target.isAvailable);
    const orderedTargets = fallbackTargets.length ? fallbackTargets : [adminTarget].filter((target) => target.phoneNumber);
    return {
      routeType: "AFTER_HOURS",
      orderedTargets,
      primaryTarget: orderedTargets[0] ?? null,
      availableTargets: orderedTargets.filter((target) => target.isAvailable),
      unavailableTargets: allConfiguredTargets.filter((target) => !orderedTargets.includes(target)),
      hasAvailableTarget: orderedTargets.some((target) => target.isAvailable),
      hasRoutableTarget: orderedTargets.length > 0,
      usedMobileFallback: false,
      routeReason: "after_hours" as const,
    };
  }

  const previousAgentTarget = await findPreviousAgentTarget(callerNumber, agentTargets);
  const preferAdminFirst = await callerPrefersAdminFirst(callerNumber, agentTargets);
  const roundRobinTarget = previousAgentTarget ? null : await findRoundRobinTarget(agentTargets);
  const selection = previousAgentTarget
    ? buildWorkingHoursSelection({
        preferredTarget: previousAgentTarget,
        agentTargets,
        adminTarget,
        routeReason: "returning_customer",
        preferAdminFirst,
      })
    : buildWorkingHoursSelection({
        preferredTarget: roundRobinTarget,
        agentTargets,
        adminTarget,
        routeReason: "round_robin",
        preferAdminFirst: false,
      });

  const workingTargets = [targets.BRENDAH, targets.JENNIFER, targets.ADMIN];
  const orderedTargets = selection.orderedTargets.length
    ? selection.orderedTargets
    : [adminTarget].filter((target) => target.phoneNumber);
  const availableTargets = workingTargets.filter((target) => target.phoneNumber && target.isAvailable);
  const hasRoutableTarget = orderedTargets.length > 0;
  const primaryTarget =
    selection.preferredTarget?.userId
      ? selection.preferredTarget
      : orderedTargets[0] ?? null;

  if (!availableTargets.length || orderedTargets[0]?.label === "ADMIN") {
    console.warn("[voice.routing.fallback]", {
      routeType: "WORKING_HOURS",
      reason: selection.routeReason,
      callerNumber,
      previousAgent: previousAgentTarget?.label ?? null,
      preferAdminFirst,
      roundRobinTarget: roundRobinTarget?.label ?? null,
      primaryTarget: primaryTarget?.label ?? null,
      orderedTargets: orderedTargets.map((target) => target.label),
      candidates: workingTargets.map((target) => ({
        label: target.label,
        phoneNumber: target.phoneNumber,
        userId: target.userId,
        presenceStatus: target.presenceStatus,
        isAvailable: target.isAvailable,
        skipReasons: target.skipReasons,
        dialValues: target.dialValues,
      })),
    });
  }

  return {
    routeType: "WORKING_HOURS",
    orderedTargets,
    primaryTarget,
    availableTargets,
    unavailableTargets: workingTargets.filter((target) => target.phoneNumber && !target.isAvailable),
    hasAvailableTarget: availableTargets.length > 0,
    hasRoutableTarget,
    usedMobileFallback: Boolean(orderedTargets.length) && orderedTargets[orderedTargets.length - 1]?.label === "ADMIN",
    routeReason: selection.routeReason,
  };
}

async function resolveAnsweredAgentAssignment(destinationNumber: string | null) {
  const normalizedDestination = normalizeVoiceNumber(destinationNumber || "");
  if (!normalizedDestination) return null;

  const routingUsers = await resolveRoutingUsers();
  const brendahPhone = getConfiguredPhone("BRENDAH");
  const jenniferPhone = getConfiguredPhone("JENNIFER");

  if (normalizedDestination === brendahPhone && routingUsers.BRENDAH) return routingUsers.BRENDAH;
  if (normalizedDestination === jenniferPhone && routingUsers.JENNIFER) return routingUsers.JENNIFER;
  return null;
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

export function buildVoiceMessageXmlResponse(message: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${escapeXml(message)}</Say></Response>`;
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
  const contentType = safeString(request.headers.get("content-type")).toLowerCase();

  if (contentType.includes("application/json")) {
    const json = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const payload: VoicePayload = {};
    for (const [key, value] of Object.entries(json)) {
      payload[key] = safeString(value);
    }
    return payload;
  }

  const payload: VoicePayload = {};
  try {
    const formData = await request.formData();
    for (const [key, value] of formData.entries()) {
      payload[key] = typeof value === "string" ? value : value.name;
    }
    return payload;
  } catch {
    const rawBody = await request.text().catch(() => "");
    const params = new URLSearchParams(rawBody);
    for (const [key, value] of params.entries()) {
      payload[key] = value;
    }
    return payload;
  }
}

export function normalizeVoiceStatus(payload: VoicePayload) {
  return (
    payload.status ||
    payload.callSessionState ||
    payload.callStatus ||
    payload.state ||
    (isVoiceCallActive(payload) ? "in_progress" : "completed")
  );
}

export function inferVoiceCompletionStatus(
  payload: VoicePayload,
  options?: {
    treatZeroDurationSuccessAsNoAnswer?: boolean;
  },
) {
  const hangupCause = safeString(payload.lastBridgeHangupCause || payload.bridgeHangupCause || payload.hangupCause).toUpperCase();
  if (hangupCause === "USER_BUSY" || hangupCause === "BUSY") return "busy";
  if (hangupCause === "NO_ANSWER" || hangupCause === "NO ANSWER") return "no_answer";

  const normalizedStatus = safeString(payload.status).toLowerCase();
  const normalizedSessionState = safeString(payload.callSessionState).toLowerCase();
  const duration = parseInteger(payload.durationInSeconds || payload.duration) ?? 0;
  const direction = safeString(payload.direction || "INBOUND").toUpperCase() || "INBOUND";
  const treatZeroDurationSuccessAsNoAnswer = options?.treatZeroDurationSuccessAsNoAnswer !== false;
  const isProviderTerminalSuccess =
    ["success", "successful", "completed", "complete"].includes(normalizedStatus) ||
    ["completed", "complete"].includes(normalizedSessionState);

  if (isProviderTerminalSuccess && treatZeroDurationSuccessAsNoAnswer && duration <= 0) {
    return "no_answer";
  }

  if (isProviderTerminalSuccess && direction === "INBOUND" && duration > 0) {
    return "answered";
  }

  return normalizeVoiceStatus(payload);
}

function parseMoney(value: string | undefined) {
  if (!value) return null;
  const parsed = safeNumber(value, Number.NaN);
  if (!Number.isFinite(parsed)) return null;
  return new Prisma.Decimal(parsed.toFixed(2));
}

function parseInteger(value: string | undefined) {
  if (!value) return null;
  const parsed = safeNumber(value, Number.NaN);
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
  const sessionId = safeString(payload.sessionId || payload.SessionId);
  if (!sessionId) {
    throw new Error("missing_session_id");
  }

  const callerNumber = normalizeVoiceNumber(payload.callerNumber || payload.caller || payload.from);
  const destinationNumber = normalizeVoiceNumber(payload.destinationNumber || payload.to || payload.calledNumber);
  const status = normalizeVoiceStatus(payload);
  const isActive = isVoiceCallActive(payload);
  const customerLink = callerNumber ? await resolveVoiceCustomerLinkByPhone(callerNumber) : null;
  const customerId = customerLink?.matchedCustomer?.id ?? null;
  const answeredAgentAssignment = input?.assignedToId == null ? await resolveAnsweredAgentAssignment(destinationNumber) : null;

  const voiceCall = await prisma.voiceCall.upsert({
    where: { sessionId },
    create: {
      sessionId,
      direction: safeString(payload.direction || "INBOUND").toUpperCase() || "INBOUND",
      callerNumber: callerNumber || safeString(payload.callerNumber || payload.caller || "unknown") || "unknown",
      destinationNumber: destinationNumber || null,
      isActive,
      status,
      routedTo: input?.routedTo ?? null,
      routeType: input?.routeType ?? null,
      assignedToId: input?.assignedToId ?? answeredAgentAssignment ?? null,
      customerId,
      startedAt: parseDate(payload.startTime) ?? new Date(),
      endedAt: parseDate(payload.endTime),
      durationInSeconds: parseInteger(payload.durationInSeconds || payload.duration),
      currencyCode: safeString(payload.currencyCode) || null,
      amount: parseMoney(payload.amount ?? "0"),
      recordingUrl: safeString(payload.recordingUrl) || null,
      menuOption: safeString(payload.menuOption) || null,
      notes: safeString(payload.notes) || null,
      rawPayloadJson: payload,
    },
    update: {
      direction: safeString(payload.direction || "INBOUND").toUpperCase() || "INBOUND",
      callerNumber: callerNumber || safeString(payload.callerNumber || payload.caller || "unknown") || "unknown",
      destinationNumber: destinationNumber || null,
      isActive,
      status,
      routedTo: input?.routedTo ?? undefined,
      routeType: input?.routeType ?? undefined,
      assignedToId: input?.assignedToId ?? answeredAgentAssignment ?? undefined,
      customerId: customerId ?? undefined,
      endedAt: parseDate(payload.endTime) ?? undefined,
      durationInSeconds: parseInteger(payload.durationInSeconds || payload.duration) ?? undefined,
      currencyCode: safeString(payload.currencyCode) || undefined,
      amount: parseMoney(payload.amount) ?? undefined,
      recordingUrl: safeString(payload.recordingUrl) || undefined,
      menuOption: safeString(payload.menuOption) || undefined,
      notes: safeString(payload.notes) || undefined,
      rawPayloadJson: payload,
    },
  });

  publishVoiceLiveEvent({
    type: voiceCall.recordingUrl ? "recording" : "call",
    reason: "voice_call_upserted",
    callId: voiceCall.id,
    sessionId: voiceCall.sessionId,
    userId: voiceCall.assignedToId,
  });

  return voiceCall;
}

export async function createVoiceEventFromPayload(payload: VoicePayload, voiceCallId?: string | null) {
  const sessionId = safeString(payload.sessionId || payload.SessionId);
  if (!sessionId) {
    throw new Error("missing_session_id");
  }

  const event = await prisma.voiceEvent.create({
    data: {
      voiceCallId: voiceCallId ?? null,
      sessionId,
      eventType: safeString(payload.eventType || payload.status || payload.callStatus || payload.callSessionState || "unknown"),
      payloadJson: payload,
    },
  });

  publishVoiceLiveEvent({
    type: "call",
    reason: `voice_event_${event.eventType}`,
    callId: voiceCallId ?? null,
    sessionId,
  });

  return event;
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
  const customerLink = phone ? await resolveVoiceCustomerLinkByPhone(phone) : null;
  const customerId = customerLink?.matchedCustomer?.id ?? null;
  const callerName = customerLink?.matchedCustomer?.name ?? null;
  const existing = await prisma.voiceLead.findFirst({
    where: { phone, status: { in: ["open", "pending_follow_up"] } },
    orderBy: { updatedAt: "desc" },
  });

  if (existing) {
    const lead = await prisma.voiceLead.update({
      where: { id: existing.id },
      data: {
        name: callerName ?? existing.name,
        source: "VOICE_MISSED_CALL",
        status: "pending_follow_up",
        assignedToId: call.assignedToId ?? existing.assignedToId,
        customerId: customerId ?? existing.customerId,
        lastCallAt: call.startedAt ?? new Date(),
      },
    });
    publishVoiceLiveEvent({
      type: "queue",
      reason: "voice_lead_updated",
      userId: lead.assignedToId,
    });
    return lead;
  }

  const lead = await prisma.voiceLead.create({
    data: {
      phone,
      name: callerName,
      source: "VOICE_MISSED_CALL",
      status: "pending_follow_up",
      assignedToId: call.assignedToId ?? null,
      customerId,
      lastCallAt: call.startedAt ?? new Date(),
    },
  });
  publishVoiceLiveEvent({
    type: "queue",
    reason: "voice_lead_created",
    userId: lead.assignedToId,
  });
  return lead;
}

export async function ensureVoiceLeadForCaller(call: {
  callerNumber: string;
  startedAt?: Date | null;
  assignedToId?: string | null;
  customerId?: string | null;
}) {
  if (!call.callerNumber) return null;

  const phone = normalizeVoiceNumber(call.callerNumber) || call.callerNumber;
  const customerLink = call.customerId ? null : await resolveVoiceCustomerLinkByPhone(phone);
  const customerId = call.customerId ?? customerLink?.matchedCustomer?.id ?? null;
  if (customerId) return null;

  const existing = await prisma.voiceLead.findFirst({
    where: { phone },
    orderBy: { updatedAt: "desc" },
  });

  if (existing) {
    const lead = await prisma.voiceLead.update({
      where: { id: existing.id },
      data: {
        name: existing.name ?? customerLink?.matchedCustomer?.name ?? null,
        assignedToId: call.assignedToId ?? existing.assignedToId,
        lastCallAt: call.startedAt ?? new Date(),
        status:
          existing.status === "closed" || existing.status === "resolved"
            ? "open"
            : existing.status,
      },
    });
    publishVoiceLiveEvent({
      type: "queue",
      reason: "voice_inbound_lead_updated",
      userId: lead.assignedToId,
    });
    return lead;
  }

  const lead = await prisma.voiceLead.create({
    data: {
      phone,
      name: customerLink?.matchedCustomer?.name ?? null,
      source: "VOICE_INBOUND_CALL",
      status: "open",
      assignedToId: call.assignedToId ?? null,
      customerId: null,
      lastCallAt: call.startedAt ?? new Date(),
    },
  });
  publishVoiceLiveEvent({
    type: "queue",
    reason: "voice_inbound_lead_created",
    userId: lead.assignedToId,
  });
  return lead;
}
