import { auth } from "@/lib/auth";
import { getKenyanPhoneVariants, normalizeKenyanPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { getVoiceCustomerContext } from "@/lib/voiceCustomerContext";
import { publishVoiceLiveEvent } from "@/lib/voiceLiveEvents";
import { getVoiceWebrtcRegistryEntry } from "@/lib/voiceWebrtc/registry";

export const VOICE_ALLOWED_ATTENDANT_CATEGORIES = ["DIRECT_SALES_OPS", "MARKETING_OPS"] as const;
export const VOICE_PRESENCE_STATUSES = ["AVAILABLE", "AWAY", "BUSY", "BREAK", "OFFLINE"] as const;
const VOICE_PRESENCE_STALE_MS = 90 * 1000;
const VOICE_PRESENCE_WRITE_DEBOUNCE_MS = 20 * 1000;

type VoicePresenceStatus = (typeof VOICE_PRESENCE_STATUSES)[number];

type ViewerOptions = {
  impersonateId?: string | null;
};

export type VoiceViewer = {
  actorUserId: string;
  actorRole: string | null;
  actorEmail: string | null;
  targetUserId: string;
  targetRole: string | null;
  targetAttendantCategory: string | null;
  isAdmin: boolean;
  impersonateId: string | null;
};

export function isVoiceOperationsSchemaMissingError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string };
  if (maybeError.code !== "P2021") return false;
  const message = String(maybeError.message || "");
  return (
    message.includes("VoiceAgentPresence") ||
    message.includes("VoiceCallNote") ||
    message.includes("VoiceFollowUp") ||
    message.includes("VoiceAgentRoutingPreference") ||
    message.includes("VoiceRoutingConfig")
  );
}

export type VoiceLiveSnapshotInput = {
  viewer: VoiceViewer;
  selectedCallId?: string | null;
  selectedPhone?: string | null;
  scope?: "all" | "mine";
};

export function canAccessVoiceDesk(role: string | null | undefined, attendantCategory: string | null | undefined) {
  return (
    role === "ADMIN" ||
    role === "SUPERVISOR" ||
    VOICE_ALLOWED_ATTENDANT_CATEGORIES.includes(
      String(attendantCategory || "") as (typeof VOICE_ALLOWED_ATTENDANT_CATEGORIES)[number],
    )
  );
}

function normalizeStatus(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function isCallActiveStatus(status: string | null | undefined) {
  return ["queued", "ringing", "initiated", "dialing", "in_progress", "answered", "processing"].includes(
    normalizeStatus(status),
  );
}

function isWaitingStatus(status: string | null | undefined) {
  return ["queued", "ringing", "initiated", "dialing", "new", "pending"].includes(normalizeStatus(status));
}

function isAnsweredStatus(status: string | null | undefined) {
  return ["answered", "connected", "transferred"].includes(normalizeStatus(status));
}

function isMissedStatus(status: string | null | undefined) {
  return [
    "missed",
    "no_answer",
    "no answer",
    "busy",
    "failed",
    "unanswered",
    "not_answered",
    "not answered",
    "aborted",
    "cancelled",
    "disconnected",
  ].includes(normalizeStatus(status));
}

function isAgentAvailableForRouting(status: string | null | undefined, lastSeenAt: Date | null | undefined) {
  if (String(status || "").trim().toUpperCase() !== "AVAILABLE") return false;
  if (!lastSeenAt) return false;
  return Date.now() - lastSeenAt.getTime() <= VOICE_PRESENCE_STALE_MS;
}

function formatStatusLabel(status: string | null | undefined) {
  return String(status || "unknown").replace(/_/g, " ");
}

function getStatusTrackingKeys(phone: string | null | undefined) {
  const normalizedPhone = normalizeKenyanPhone(phone || "");
  const variants = phone ? getKenyanPhoneVariants(phone) : [];
  return Array.from(new Set([normalizedPhone, phone, ...variants].filter(Boolean) as string[]));
}

function getFollowUpReviewStatus(
  baseStatus: string | null | undefined,
  items: Array<{ status?: string | null; updatedAt?: Date | null }>,
) {
  if (!isMissedStatus(baseStatus)) return null;
  const latestItem = [...items]
    .filter((item) => item?.status)
    .sort((left, right) => (right.updatedAt?.getTime() ?? 0) - (left.updatedAt?.getTime() ?? 0))[0];

  const normalizedStatus = normalizeStatus(latestItem?.status);
  if (normalizedStatus === "contacted") return "contacted";
  if (normalizedStatus === "resolved" || normalizedStatus === "closed") return "resolved";
  return null;
}

const VOICE_DISPOSITION_CODES = ["SALE", "QUOTE", "SUPPORT", "WRONG_NUMBER", "FOLLOW_UP_NEEDED"] as const;

function extractDisposition(note: string | null | undefined) {
  const match = String(note || "").trim().match(/^Disposition:\s*([A-Z_]+)/i);
  const code = String(match?.[1] || "").trim().toUpperCase();
  if (!VOICE_DISPOSITION_CODES.includes(code as (typeof VOICE_DISPOSITION_CODES)[number])) return null;
  return code as (typeof VOICE_DISPOSITION_CODES)[number];
}

function getCallQueueReasonLabel(call: {
  routeType?: string | null;
  menuOption?: string | null;
  rawPayloadJson?: unknown;
  assignedToId?: string | null;
}) {
  const payload = call.rawPayloadJson && typeof call.rawPayloadJson === "object"
    ? (call.rawPayloadJson as Record<string, unknown>)
    : null;
  const routeReason = normalizeStatus(String(payload?.routeReason || ""));
  const routeType = String(call.routeType || "").trim().toUpperCase();

  if (String(call.menuOption || "").trim() === "1" || routeType === "TECHNICAL_TEAM") {
    return "Technical option";
  }
  if (routeType === "AFTER_HOURS") {
    return "Admin fallback";
  }
  if (routeReason === "returning_customer") {
    return "Returning customer";
  }
  if (routeReason === "assigned_owner") {
    return "Assigned owner";
  }
  if (routeReason === "round_robin") {
    return "New caller";
  }
  if (routeReason === "admin_only" || routeReason === "after_hours") {
    return "Admin fallback";
  }
  return "Live queue";
}

function getQueueReasonLabelForLead(source: string | null | undefined, title?: string | null) {
  const normalizedSource = String(source || "").trim().toUpperCase();
  if (normalizedSource === "VOICE_MISSED_CALL") return "Missed call callback";
  if (String(title || "").toLowerCase().includes("call back")) return "Callback task";
  return "Follow-up queue";
}

function getRingSeconds(input: {
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  durationInSeconds?: number | null;
  isActive?: boolean | null;
}) {
  const start = getCallStartedAt(input);
  const end = input.endedAt ?? (input.isActive ? new Date() : null);
  if (!end) return 0;
  const totalSeconds = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
  return Math.max(0, totalSeconds - Number(input.durationInSeconds ?? 0));
}

function getCallbackOverdueSeconds(item: {
  dueAt?: string | null;
  status?: string | null;
}) {
  if (!item.dueAt) return 0;
  if (["resolved", "closed", "contacted"].includes(normalizeStatus(item.status))) return 0;
  const due = new Date(item.dueAt).getTime();
  if (Number.isNaN(due)) return 0;
  return Math.max(0, Math.floor((Date.now() - due) / 1000));
}

function buildHopAudit(events: Array<{ id: string; eventType: string; createdAt: Date; payloadJson: unknown }>) {
  return events
    .filter((event) => event.eventType === "ROUTE_HOP_STARTED" || event.eventType === "ROUTE_HOP_COMPLETED")
    .map((event) => {
      const payload = event.payloadJson && typeof event.payloadJson === "object"
        ? (event.payloadJson as Record<string, unknown>)
        : {};
      const status = event.eventType === "ROUTE_HOP_STARTED"
        ? "RANG"
        : formatStatusLabel(String(payload.status || payload.callSessionState || "completed")).toUpperCase();
      return {
        id: event.id,
        title: String(payload.hopLabel || payload.dialValue || "Route hop"),
        status,
        detail: String(payload.dialValue || ""),
        at: event.createdAt.toISOString(),
      };
    });
}

function normalizeCallDisplayStatus(input: {
  status: string | null | undefined;
  durationInSeconds?: number | null;
  isActive?: boolean | null;
}) {
  const normalized = normalizeStatus(input.status);
  const durationInSeconds = Number(input.durationInSeconds ?? 0);
  const isActive = Boolean(input.isActive);

  if (isActive || isCallActiveStatus(normalized)) {
    if (["answered", "in_progress", "processing", "connected"].includes(normalized)) {
      return "ANSWERED";
    }
    if (["initiated", "dialing"].includes(normalized)) {
      return "DIALING";
    }
    return "RINGING";
  }

  if (["busy", "user_busy"].includes(normalized)) return "BUSY";
  if (["transferred"].includes(normalized)) return "TRANSFERRED";
  if (["failed", "error"].includes(normalized)) return "FAILED";
  if (["aborted", "cancelled", "canceled"].includes(normalized)) {
    return durationInSeconds > 0 ? "DISCONNECTED" : "CANCELLED";
  }
  if (["missed", "no_answer", "no answer", "unanswered", "not_answered", "not answered"].includes(normalized)) {
    return "MISSED";
  }
  if (["answered", "connected", "in_progress"].includes(normalized)) return "ANSWERED";
  if (["completed", "success", "successful", "complete"].includes(normalized)) {
    return durationInSeconds > 0 ? "ANSWERED" : "MISSED";
  }
  if (durationInSeconds > 0) return "ANSWERED";
  return normalized ? normalized.toUpperCase() : "UNKNOWN";
}

function inferVoiceProviderOutcomeFromPayload(
  payload: Record<string, string>,
  options?: {
    treatZeroDurationSuccessAsNoAnswer?: boolean;
    treatInboundSuccessWithoutBridgeAsNoAnswer?: boolean;
  },
) {
  const hangupCause = String(payload.lastBridgeHangupCause || payload.bridgeHangupCause || payload.hangupCause || "")
    .trim()
    .toUpperCase();
  if (hangupCause === "USER_BUSY" || hangupCause === "BUSY") return "busy";
  if (hangupCause === "NO_ANSWER" || hangupCause === "NO ANSWER") return "no_answer";

  const normalizedStatus = String(payload.status || "").trim().toLowerCase();
  const normalizedSessionState = String(payload.callSessionState || "").trim().toLowerCase();
  if (["answered", "connected", "in_progress", "transferred"].includes(normalizedStatus)) {
    return normalizedStatus;
  }
  const duration = Number(payload.durationInSeconds || payload.duration || 0) || 0;
  const direction = String(payload.direction || "INBOUND").trim().toUpperCase() || "INBOUND";
  const treatZeroDurationSuccessAsNoAnswer = options?.treatZeroDurationSuccessAsNoAnswer !== false;
  const treatInboundSuccessWithoutBridgeAsNoAnswer = options?.treatInboundSuccessWithoutBridgeAsNoAnswer === true;
  const isProviderTerminalSuccess =
    ["success", "successful", "completed", "complete"].includes(normalizedStatus) ||
    ["completed", "complete"].includes(normalizedSessionState);
  const bridgeStatus = String(
    payload.dialCallStatus ||
      payload.lastBridgeDialStatus ||
      payload.bridgeStatus ||
      payload.lastBridgeStatus ||
      payload.bridgeCallStatus ||
      "",
  )
    .trim()
    .toLowerCase();
  const bridgeDuration =
    Number(
      payload.bridgeDurationInSeconds ||
        payload.lastBridgeDurationInSeconds ||
        payload.talkDurationInSeconds ||
        payload.conversationDurationInSeconds ||
        0,
    ) || 0;
  const dialDuration =
    Number(
      payload.dialDurationInSeconds ||
        payload.dialDuration ||
        payload.dialCallDurationInSeconds ||
        0,
    ) || 0;
  const hasBridgeEvidence =
    bridgeDuration > 0 ||
    dialDuration > 0 ||
    Boolean(String(payload.recordingUrl || "").trim()) ||
    Boolean(String(payload.dialDestinationNumber || payload.lastDialDestinationNumber || "").trim()) ||
    ["answered", "connected", "completed", "complete", "success", "successful", "transferred", "bridged"].includes(
      bridgeStatus,
    ) ||
    Boolean(hangupCause && !["USER_BUSY", "BUSY", "NO_ANSWER", "NO ANSWER"].includes(hangupCause));

  if (isProviderTerminalSuccess && treatZeroDurationSuccessAsNoAnswer && duration <= 0) {
    return "no_answer";
  }

  if (isProviderTerminalSuccess && direction === "INBOUND" && duration > 0) {
    if (treatInboundSuccessWithoutBridgeAsNoAnswer && !hasBridgeEvidence) {
      return "no_answer";
    }
    return "answered";
  }

  return String(
    payload.status ||
      payload.callSessionState ||
      payload.callStatus ||
      payload.state ||
      "completed",
  ).trim();
}

function resolveVoiceProviderOutcome(call: {
  status: string | null | undefined;
  durationInSeconds?: number | null;
  isActive?: boolean | null;
  routeType?: string | null;
  routedTo?: string | null;
  rawPayloadJson?: unknown;
}) {
  const payload =
    call.rawPayloadJson && typeof call.rawPayloadJson === "object"
      ? Object.fromEntries(
          Object.entries(call.rawPayloadJson as Record<string, unknown>).map(([key, value]) => [key, String(value ?? "")]),
        )
      : null;
  const isRoutedInboundCall = Boolean(String(call.routeType || "").trim() || String(call.routedTo || "").trim());
  const providerStatus =
    payload
      ? inferVoiceProviderOutcomeFromPayload(payload, {
          treatZeroDurationSuccessAsNoAnswer: isRoutedInboundCall,
          treatInboundSuccessWithoutBridgeAsNoAnswer: isRoutedInboundCall,
        })
      : String(call.status || "");
  const displayStatus = normalizeCallDisplayStatus({
    status: providerStatus || call.status,
    durationInSeconds: call.durationInSeconds,
    isActive: call.isActive,
  });
  return {
    providerStatus,
    displayStatus,
  };
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function getCallStartedAt(call: { startedAt: Date | null; createdAt: Date }) {
  return call.startedAt ?? call.createdAt;
}

function getWaitingSeconds(call: { startedAt: Date | null; createdAt: Date; isActive: boolean }) {
  if (!call.isActive) return 0;
  const anchor = getCallStartedAt(call);
  return Math.max(0, Math.floor((Date.now() - anchor.getTime()) / 1000));
}

function buildPhoneSearchHref(phone: string, impersonateId?: string | null) {
  const url = new URL("https://voice.local/admin/customers");
  url.pathname = "/admin/customers";
  url.searchParams.set("q", phone);
  if (impersonateId) url.searchParams.set("impersonateId", impersonateId);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function buildReceiptHref(receiptId: string | null | undefined, impersonateId?: string | null) {
  const url = new URL("https://voice.local/marketing/receipts");
  url.pathname = "/marketing/receipts";
  url.searchParams.set("tab", "pos");
  if (receiptId) url.searchParams.set("receiptId", receiptId);
  if (impersonateId) url.searchParams.set("impersonateId", impersonateId);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function buildQuoteHref(quoteId: string | null | undefined, impersonateId?: string | null) {
  const url = new URL("https://voice.local/marketing/receipts");
  url.pathname = "/marketing/receipts";
  url.searchParams.set("tab", "quotations");
  if (quoteId) url.searchParams.set("quoteId", quoteId);
  if (impersonateId) url.searchParams.set("impersonateId", impersonateId);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function buildCreateReceiptHref(impersonateId?: string | null) {
  const url = new URL("https://voice.local/receipts");
  url.pathname = "/receipts";
  url.searchParams.set("view", "create");
  if (impersonateId) url.searchParams.set("impersonateId", impersonateId);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function buildVoiceHref(path: string, impersonateId?: string | null) {
  const url = new URL(`https://voice.local${path}`);
  if (impersonateId) url.searchParams.set("impersonateId", impersonateId);
  return `${url.pathname}${url.searchParams.toString() ? `?${url.searchParams.toString()}` : ""}`;
}

function getVoiceInternalNumberSet() {
  return new Set(
    [
      process.env.BETECH_VOICE_BRENDAH_NUMBER,
      process.env.BETECH_VOICE_JENNIFER_NUMBER,
      process.env.BETECH_VOICE_ADMIN_NUMBER,
      process.env.ADMIN_PHONE,
    ]
      .map((value) => normalizeKenyanPhone(String(value || "").trim()))
      .filter(Boolean),
  );
}

function getExternalVoicePhoneForCall(call: {
  callerNumber?: string | null;
  destinationNumber?: string | null;
}) {
  const internalNumbers = getVoiceInternalNumberSet();
  const candidates = [call.callerNumber, call.destinationNumber]
    .map((value) => normalizeKenyanPhone(String(value || "").trim()))
    .filter(Boolean)
    .filter((value) => !internalNumbers.has(value));
  return candidates[0] ?? null;
}

async function persistVoicePhoneAssignment(input: {
  phone: string;
  assignedToId: string;
  customerId?: string | null;
  lastCallAt?: Date | null;
}) {
  const phoneVariants = getKenyanPhoneVariants(input.phone);
  if (!phoneVariants.length) return null;

  await prisma.voiceFollowUp.updateMany({
    where: {
      phone: { in: phoneVariants },
      status: { in: ["pending", "contacted", "open", "pending_follow_up"] },
    },
    data: { assignedToId: input.assignedToId },
  });

  const existingLeads = await prisma.voiceLead.findMany({
    where: { phone: { in: phoneVariants } },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      customerId: true,
      lastCallAt: true,
    },
  });

  if (existingLeads.length) {
    await prisma.voiceLead.updateMany({
      where: { id: { in: existingLeads.map((lead) => lead.id) } },
      data: {
        assignedToId: input.assignedToId,
        ...(input.customerId ? { customerId: input.customerId } : {}),
        ...(input.lastCallAt ? { lastCallAt: input.lastCallAt } : {}),
      },
    });

    const freshestLead = existingLeads[0];
    return prisma.voiceLead.findUnique({
      where: { id: freshestLead.id },
    });
  }

  return prisma.voiceLead.create({
    data: {
      phone: input.phone,
      source: "VOICE_INBOUND_CALL",
      status: "contacted",
      assignedToId: input.assignedToId,
      customerId: input.customerId ?? null,
      lastCallAt: input.lastCallAt ?? new Date(),
    },
  });
}

async function propagateVoiceCallAssignmentByPhone(input: {
  phone: string;
  assignedToId: string;
}) {
  const phoneVariants = getKenyanPhoneVariants(input.phone);
  if (!phoneVariants.length) return;

  await prisma.voiceCall.updateMany({
    where: {
      OR: [
        { callerNumber: { in: phoneVariants } },
        { destinationNumber: { in: phoneVariants } },
      ],
    },
    data: {
      assignedToId: input.assignedToId,
    },
  });
}

function getManualReassignmentPhone(call: {
  callerNumber?: string | null;
  destinationNumber?: string | null;
}) {
  const externalPhone = getExternalVoicePhoneForCall(call);
  if (externalPhone) return externalPhone;
  return (
    normalizeKenyanPhone(String(call.callerNumber || "").trim()) ||
    normalizeKenyanPhone(String(call.destinationNumber || "").trim()) ||
    null
  );
}

type RoutingAgentDefinition = {
  key: "BRENDAH" | "JENNIFER" | "ADMIN";
  displayName: string;
  roleLabel: string;
  phone: string | null;
  webRtcClientName: string;
  match: (agent: {
    name: string | null;
    email: string | null;
    role: string | null;
    attendantCategory: string | null;
    phone?: string | null;
  }) => boolean;
};

function normalizeCompareValue(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function buildRoutingAgentDefinitions(): RoutingAgentDefinition[] {
  const brendahPhone = process.env.BETECH_VOICE_BRENDAH_NUMBER ?? null;
  const jenniferPhone = process.env.BETECH_VOICE_JENNIFER_NUMBER ?? null;
  const adminPhone = process.env.BETECH_VOICE_ADMIN_NUMBER ?? null;

  return [
    {
      key: "BRENDAH",
      displayName: "Brendah Owino",
      roleLabel: "Marketing / Sales Agent",
      phone: brendahPhone,
      webRtcClientName: "brendah",
      match: (agent) =>
        normalizeCompareValue(agent.email).includes("brendah") ||
        normalizeCompareValue(agent.name).includes("brendah") ||
        normalizeCompareValue(agent.phone) === normalizeCompareValue(brendahPhone),
    },
    {
      key: "JENNIFER",
      displayName: "Jennifer",
      roleLabel: "Direct Sales Agent",
      phone: jenniferPhone,
      webRtcClientName: "jennifer",
      match: (agent) =>
        normalizeCompareValue(agent.email).includes("jen") ||
        normalizeCompareValue(agent.name).includes("jen") ||
        normalizeCompareValue(agent.phone) === normalizeCompareValue(jenniferPhone),
    },
    {
      key: "ADMIN",
      displayName: "Jackson Kioko",
      roleLabel: "Admin / Fallback Line",
      phone: adminPhone,
      webRtcClientName: "jackson",
      match: (agent) =>
        normalizeCompareValue(agent.email).includes("jackson") ||
        normalizeCompareValue(agent.name).includes("jackson") ||
        normalizeCompareValue(agent.phone) === normalizeCompareValue(adminPhone) ||
        normalizeCompareValue(agent.role) === "admin",
    },
  ];
}

export function sanitizeVoiceWebrtcClientName(value: string | null | undefined) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.replace(/-/g, "").slice(0, 32);
}

export function resolveVoiceWebrtcClientName(input: {
  userId?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  attendantCategory?: string | null;
  phone?: string | null;
}) {
  const routeMatch = buildRoutingAgentDefinitions().find((definition) =>
    definition.match({
      name: input.name ?? null,
      email: input.email ?? null,
      role: input.role ?? null,
      attendantCategory: input.attendantCategory ?? null,
      phone: input.phone ?? null,
    }),
  );
  if (routeMatch?.webRtcClientName) return routeMatch.webRtcClientName;

  const emailLocalPart = sanitizeVoiceWebrtcClientName(String(input.email || "").split("@")[0] || "");
  if (emailLocalPart) return emailLocalPart;

  const nameSlug = sanitizeVoiceWebrtcClientName(input.name);
  if (nameSlug) return nameSlug;

  const userSlug = sanitizeVoiceWebrtcClientName(input.userId);
  if (userSlug) return userSlug;

  return "voiceuser";
}

export function buildVoiceWebrtcIdentity(clientName: string, username = process.env.AFRICASTALKING_USERNAME) {
  const normalizedUsername = String(username || "").trim();
  const normalizedClientName = sanitizeVoiceWebrtcClientName(clientName);
  if (!normalizedUsername || !normalizedClientName) return null;
  return `${normalizedUsername}.${normalizedClientName}`;
}

function getCategoryLabel(category: string | null | undefined, role: string | null | undefined) {
  const normalizedCategory = String(category || "").trim().toUpperCase();
  if (normalizedCategory === "MARKETING_OPS") return "Marketing / Sales Agent";
  if (normalizedCategory === "DIRECT_SALES_OPS") return "Direct Sales Agent";
  if (String(role || "").trim().toUpperCase() === "ADMIN") return "Admin / Fallback Line";
  return String(category || role || "Voice Agent").replace(/_/g, " ");
}

function getVoiceRoutingLabel(phone: string | null | undefined) {
  const normalized = normalizeCompareValue(phone);
  const routeMatch = buildRoutingAgentDefinitions().find(
    (definition) => definition.phone && normalizeCompareValue(definition.phone) === normalized,
  );
  if (routeMatch) {
    return `${routeMatch.displayName} / ${routeMatch.phone}`;
  }
  return phone || "-";
}

function effectivePresenceStatus(status: string | null | undefined) {
  const normalized = String(status || "OFFLINE").trim().toUpperCase();
  return normalized === "AVAILABLE" ? "AVAILABLE" : "OFFLINE";
}

export async function resolveVoiceViewer(options?: ViewerOptions): Promise<VoiceViewer | null> {
  const session = await auth();
  const user = session?.user as {
    id?: string | null;
    email?: string | null;
    role?: string | null;
    attendantCategory?: string | null;
  } | undefined;

  if (!session || !user?.id) return null;
  if (!canAccessVoiceDesk(user.role, user.attendantCategory)) return null;

  const isAdmin = user.role === "ADMIN";
  const impersonateId = isAdmin ? String(options?.impersonateId || "").trim() || null : null;

  if (impersonateId) {
    const target = await prisma.user.findUnique({
      where: { id: impersonateId },
      select: {
        id: true,
        role: true,
        attendantCategory: true,
      },
    });

    if (target && canAccessVoiceDesk(target.role, target.attendantCategory)) {
      return {
        actorUserId: user.id,
        actorRole: user.role ?? null,
        actorEmail: user.email?.toLowerCase() ?? null,
        targetUserId: target.id,
        targetRole: target.role,
        targetAttendantCategory: target.attendantCategory ?? null,
        isAdmin,
        impersonateId,
      };
    }
  }

  return {
    actorUserId: user.id,
    actorRole: user.role ?? null,
    actorEmail: user.email?.toLowerCase() ?? null,
    targetUserId: user.id,
    targetRole: user.role ?? null,
    targetAttendantCategory: user.attendantCategory ?? null,
    isAdmin,
    impersonateId,
  };
}

async function listVoiceAgents() {
  return prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { role: "ADMIN" },
        { attendantCategory: { in: [...VOICE_ALLOWED_ATTENDANT_CATEGORIES] } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      attendantCategory: true,
      voicePresence: {
        select: {
          id: true,
          status: true,
          lastSeenAt: true,
          currentCallId: true,
          dismissedPopupCallId: true,
          dismissedPopupAt: true,
          updatedAt: true,
        },
      },
      voiceRoutingPreference: {
        select: {
          routingEnabled: true,
          allowAfterHoursCalls: true,
          updatedAt: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
}

async function listVoiceRoutingCandidates() {
  return prisma.user.findMany({
    where: {
      isActive: true,
      phone: { not: null },
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      attendantCategory: true,
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
}

async function getVoiceRoutingConfig() {
  return prisma.voiceRoutingConfig.findUnique({
    where: { key: "default" },
    include: {
      overflowUser: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  });
}

function buildCallWhere(viewer: VoiceViewer, scope: "all" | "mine" = "all") {
  if (viewer.isAdmin && scope !== "mine") return {};
  return { assignedToId: viewer.targetUserId };
}

function buildFollowUpWhere(viewer: VoiceViewer, scope: "all" | "mine" = "all") {
  if (viewer.isAdmin && scope !== "mine") {
    return { status: { in: ["pending", "contacted"] } };
  }
  return {
    assignedToId: viewer.targetUserId,
    status: { in: ["pending", "contacted"] },
  };
}

function buildLeadWhere(viewer: VoiceViewer, scope: "all" | "mine" = "all") {
  if (viewer.isAdmin && scope !== "mine") {
    return { status: { in: ["open", "pending_follow_up"] } };
  }
  return {
    assignedToId: viewer.targetUserId,
    status: { in: ["open", "pending_follow_up"] },
  };
}

function serializeCustomerContextSummary(context: Awaited<ReturnType<typeof getVoiceCustomerContext>>) {
  return {
    normalizedPhone: context.normalizedPhone,
    chatrace: context.chatrace,
    matchedCustomerId: context.matchedCustomer?.id ?? null,
    customerName: context.summary.customerName,
    email: context.summary.email,
    location: context.summary.location,
    assignedAgent: context.assignedAgent,
    lastPurchaseAt: toIso(context.summary.lastPurchaseAt),
    totalPurchasesValue: context.summary.totalPurchasesValue,
    openQuotations: context.summary.openQuotations,
    pendingWebOrders: context.summary.pendingWebOrders,
    pendingPod: context.summary.pendingPod,
    linkedRecords: {
      receipts: context.recentReceipts.length,
      webOrders: context.recentWebOrders.length,
      quotations: context.recentQuotations.length,
      agentOrders: context.recentAgentOrders.length,
      recentCalls: context.recentCalls.length,
      leads: context.followUps.length,
      taskFollowUps: context.taskFollowUps.length,
      notes: context.recentNotes.length,
    },
    latestReceiptId: context.recentReceipts[0]?.id ?? null,
    latestQuotationId: context.recentQuotations[0]?.id ?? null,
    recentTimeline: context.timeline.slice(0, 8).map((item) => ({
      ...item,
      at: item.at.toISOString(),
    })),
    recentNotes: context.recentNotes.map((note) => ({
      ...note,
      createdAt: note.createdAt.toISOString(),
    })),
    taskFollowUps: context.taskFollowUps.map((task) => ({
      ...task,
      dueAt: toIso(task.dueAt),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    })),
  };
}

function serializePresenceRow(
  agent: Awaited<ReturnType<typeof listVoiceAgents>>[number],
  activeCallCount: number,
  waitingCallCount: number,
) {
  const routingDefinition = buildRoutingAgentDefinitions().find((definition) => definition.match(agent));
  const phone = routingDefinition?.phone ?? agent.phone ?? null;
  const displayName = routingDefinition?.displayName ?? agent.name ?? agent.email ?? "Unnamed agent";
  const displayRoleLabel = routingDefinition?.roleLabel ?? getCategoryLabel(agent.attendantCategory, agent.role);
  const webRtcClientName =
    routingDefinition?.webRtcClientName ??
    resolveVoiceWebrtcClientName({
      userId: agent.id,
      name: agent.name,
      email: agent.email,
      role: agent.role,
      attendantCategory: agent.attendantCategory,
      phone: agent.phone,
    });
  const webRtcIdentity = buildVoiceWebrtcIdentity(webRtcClientName) ?? null;
  const webRtcRegistry = getVoiceWebrtcRegistryEntry(agent.id);

  const effectiveStatus = effectivePresenceStatus(agent.voicePresence?.status);
  const routingEnabled = agent.voiceRoutingPreference?.routingEnabled ?? true;
  const allowAfterHoursCalls = agent.voiceRoutingPreference?.allowAfterHoursCalls ?? false;

  return {
    id: agent.id,
    name: agent.name,
    email: agent.email,
    phone,
    role: agent.role,
    attendantCategory: agent.attendantCategory,
    displayName,
    displayRoleLabel,
    isRoutingAgent: Boolean(routingDefinition),
    routingPriority:
      routingDefinition?.key === "BRENDAH"
        ? 1
        : routingDefinition?.key === "JENNIFER"
          ? 2
          : routingDefinition?.key === "ADMIN"
            ? 3
            : 99,
    status: effectiveStatus,
    lastSeenAt: toIso(agent.voicePresence?.lastSeenAt),
    updatedAt: toIso(agent.voicePresence?.updatedAt),
    currentCallId: agent.voicePresence?.currentCallId ?? null,
    dismissedPopupCallId: agent.voicePresence?.dismissedPopupCallId ?? null,
    dismissedPopupAt: toIso(agent.voicePresence?.dismissedPopupAt),
    routingEnabled,
    allowAfterHoursCalls,
    routingPreferenceUpdatedAt: toIso(agent.voiceRoutingPreference?.updatedAt),
    activeCallCount,
    waitingCallCount,
    isAvailableForRouting: routingEnabled && isAgentAvailableForRouting(effectiveStatus, agent.voicePresence?.lastSeenAt),
    webRtcClientName,
    webRtcIdentity,
    isWebrtcRegistered: Boolean(webRtcRegistry),
    webRtcState: webRtcRegistry?.state ?? "offline",
  };
}

export async function getVoiceLiveSnapshot(input: VoiceLiveSnapshotInput) {
  const { viewer } = input;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const scope = input.scope === "mine" ? "mine" : "all";

  const callWhere = buildCallWhere(viewer, scope);
  const followUpWhere = buildFollowUpWhere(viewer, scope);
  const leadWhere = buildLeadWhere(viewer, scope);

  const [
    callsTodayCount,
    activeCallsRaw,
    recentCallsRaw,
    followUpsRaw,
    voiceLeadsRaw,
    voiceAgentsRaw,
    callCostAggregate,
    avgTalkAggregate,
    newVoiceLeadsCount,
    voiceRoutingConfigRaw,
    routingCandidatesRaw,
  ] = await Promise.all([
    prisma.voiceCall.count({
      where: {
        ...callWhere,
        createdAt: { gte: todayStart },
      },
    }),
    prisma.voiceCall.findMany({
      where: {
        ...callWhere,
        OR: [{ isActive: true }, { status: { in: ["queued", "ringing", "initiated", "dialing", "in_progress", "answered"] } }],
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
    prisma.voiceCall.findMany({
      where: callWhere,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 16,
    }),
    prisma.voiceFollowUp.findMany({
      where: followUpWhere,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        voiceCall: {
          select: {
            id: true,
            callerNumber: true,
            assignedToId: true,
            customerId: true,
          },
        },
      },
      orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
      take: 16,
    }),
    prisma.voiceLead.findMany({
      where: leadWhere,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 16,
    }),
    listVoiceAgents(),
    prisma.voiceCall.aggregate({
      where: {
        ...callWhere,
        createdAt: { gte: todayStart },
      },
      _sum: {
        amount: true,
      },
    }),
    prisma.voiceCall.aggregate({
      where: {
        ...callWhere,
        createdAt: { gte: todayStart },
        durationInSeconds: { not: null },
        status: { in: ["completed", "COMPLETED", "answered", "ANSWERED", "in_progress", "IN_PROGRESS"] },
      },
      _avg: {
        durationInSeconds: true,
      },
    }),
    prisma.voiceLead.count({
      where: {
        ...leadWhere,
        createdAt: { gte: todayStart },
      },
    }),
    viewer.isAdmin ? getVoiceRoutingConfig() : Promise.resolve(null),
    viewer.isAdmin ? listVoiceRoutingCandidates() : Promise.resolve([]),
  ]);

  const contextCache = new Map<string, Promise<Awaited<ReturnType<typeof getVoiceCustomerContext>>>>();
  const getContextForPhone = (phone: string, includeChatrace = false) => {
    const key = `${includeChatrace ? "live" : "local"}:${phone}`;
    if (!contextCache.has(key)) {
      contextCache.set(key, getVoiceCustomerContext(phone, { take: 5, includeChatrace }));
    }
    return contextCache.get(key)!;
  };

  const recentCallIds = recentCallsRaw.map((call) => call.id);
  const recentCallPhones = Array.from(
    new Set(recentCallsRaw.flatMap((call) => getStatusTrackingKeys(call.callerNumber))),
  );
  const [recentCallFollowUpsRaw, recentCallLeadsRaw] = await Promise.all([
    recentCallIds.length || recentCallPhones.length
      ? prisma.voiceFollowUp.findMany({
          where: {
            OR: [
              recentCallIds.length ? { voiceCallId: { in: recentCallIds } } : undefined,
              recentCallPhones.length ? { phone: { in: recentCallPhones } } : undefined,
            ].filter(Boolean) as Array<Record<string, unknown>>,
          },
          select: {
            voiceCallId: true,
            phone: true,
            status: true,
            updatedAt: true,
          },
        })
      : Promise.resolve([]),
    recentCallPhones.length
      ? prisma.voiceLead.findMany({
          where: {
            phone: { in: recentCallPhones },
            status: { in: ["contacted", "closed"] },
          },
          select: {
            phone: true,
            status: true,
            updatedAt: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const followUpsByCallId = new Map<string, typeof recentCallFollowUpsRaw>();
  const reviewItemsByPhone = new Map<
    string,
    Array<{ status: string; updatedAt: Date; voiceCallId?: string | null; phone?: string | null }>
  >();

  for (const item of recentCallFollowUpsRaw) {
    if (item.voiceCallId) {
      followUpsByCallId.set(item.voiceCallId, [...(followUpsByCallId.get(item.voiceCallId) || []), item]);
    }
    for (const key of getStatusTrackingKeys(item.phone)) {
      reviewItemsByPhone.set(key, [...(reviewItemsByPhone.get(key) || []), item]);
    }
  }

  for (const item of recentCallLeadsRaw) {
    for (const key of getStatusTrackingKeys(item.phone)) {
      reviewItemsByPhone.set(key, [...(reviewItemsByPhone.get(key) || []), item]);
    }
  }

  const activeCalls = await Promise.all(
    activeCallsRaw.map(async (call) => {
      const context = await getContextForPhone(call.callerNumber, false);
      const contextSummary = serializeCustomerContextSummary(context);
      const lastActivity = contextSummary.recentTimeline[0] ?? null;
      const { displayStatus, providerStatus } = resolveVoiceProviderOutcome(call);
      return {
        id: call.id,
        sessionId: call.sessionId,
        callerNumber: call.callerNumber,
        direction: call.direction,
        status: displayStatus,
        statusLabel: formatStatusLabel(displayStatus),
        providerStatus,
        providerStatusLabel: formatStatusLabel(providerStatus),
        isActive: call.isActive || isCallActiveStatus(call.status),
        routedTo: call.routedTo,
        routeType: call.routeType,
        assignedToId: call.assignedToId,
        assignedToName: call.assignedTo?.name ?? null,
        assignedToEmail: call.assignedTo?.email ?? null,
        startedAt: toIso(call.startedAt),
        createdAt: call.createdAt.toISOString(),
        endedAt: toIso(call.endedAt),
        durationInSeconds: call.durationInSeconds ?? 0,
        waitingSeconds: getWaitingSeconds(call),
        amount: Number(call.amount ?? 0),
        currencyCode: call.currencyCode ?? "KES",
        recordingUrl: call.recordingUrl,
        queueReasonLabel: getCallQueueReasonLabel(call),
        sla: {
          ringSeconds: getRingSeconds(call),
          talkSeconds: Number(call.durationInSeconds ?? 0),
          firstResponseSeconds: getRingSeconds(call),
        },
        customer: contextSummary,
        linkedSummaryText: `${contextSummary.linkedRecords.receipts} receipts · ${contextSummary.linkedRecords.webOrders} web orders · ${contextSummary.linkedRecords.quotations} quotes`,
        lastActivityTitle: lastActivity?.title ?? null,
        lastActivityAt: lastActivity?.at ?? null,
        routedToDisplay: getVoiceRoutingLabel(call.routedTo),
        links: {
          customer: buildPhoneSearchHref(contextSummary.normalizedPhone || call.callerNumber, viewer.impersonateId),
          receipt: buildReceiptHref(contextSummary.latestReceiptId, viewer.impersonateId),
          quote: buildQuoteHref(contextSummary.latestQuotationId, viewer.impersonateId),
          createReceipt: buildCreateReceiptHref(viewer.impersonateId),
          agentOrders: buildVoiceHref("/marketing/agent-orders", viewer.impersonateId),
          callBack: `tel:${call.callerNumber}`,
        },
      };
    }),
  );

  const recentCalls = await Promise.all(
    recentCallsRaw.map(async (call) => {
      const context = await getContextForPhone(call.callerNumber, false);
      const contextSummary = serializeCustomerContextSummary(context);
      const lastActivity = contextSummary.recentTimeline[0] ?? null;
      const { displayStatus, providerStatus } = resolveVoiceProviderOutcome(call);
      const reviewStatus = getFollowUpReviewStatus(displayStatus, [
        ...(followUpsByCallId.get(call.id) || []),
        ...getStatusTrackingKeys(call.callerNumber).flatMap((key) => reviewItemsByPhone.get(key) || []),
      ]);
      const effectiveStatus = reviewStatus || displayStatus;
      return {
        id: call.id,
        sessionId: call.sessionId,
        callerNumber: call.callerNumber,
        direction: call.direction,
        status: effectiveStatus,
        statusLabel: formatStatusLabel(effectiveStatus),
        providerStatus,
        providerStatusLabel: formatStatusLabel(providerStatus),
        isActive: call.isActive || isCallActiveStatus(call.status),
        routedTo: call.routedTo,
        routeType: call.routeType,
        assignedToId: call.assignedToId,
        assignedToName: call.assignedTo?.name ?? null,
        assignedToEmail: call.assignedTo?.email ?? null,
        startedAt: toIso(call.startedAt),
        createdAt: call.createdAt.toISOString(),
        endedAt: toIso(call.endedAt),
        durationInSeconds: call.durationInSeconds ?? 0,
        waitingSeconds: getWaitingSeconds(call),
        amount: Number(call.amount ?? 0),
        currencyCode: call.currencyCode ?? "KES",
        recordingUrl: call.recordingUrl,
        queueReasonLabel: getCallQueueReasonLabel(call),
        sla: {
          ringSeconds: getRingSeconds(call),
          talkSeconds: Number(call.durationInSeconds ?? 0),
          firstResponseSeconds: getRingSeconds(call),
        },
        customer: contextSummary,
        linkedSummaryText: `${contextSummary.linkedRecords.receipts} receipts · ${contextSummary.linkedRecords.webOrders} web orders · ${contextSummary.linkedRecords.quotations} quotes`,
        lastActivityTitle: lastActivity?.title ?? null,
        lastActivityAt: lastActivity?.at ?? null,
        routedToDisplay: getVoiceRoutingLabel(call.routedTo),
        links: {
          customer: buildPhoneSearchHref(contextSummary.normalizedPhone || call.callerNumber, viewer.impersonateId),
          receipt: buildReceiptHref(contextSummary.latestReceiptId, viewer.impersonateId),
          quote: buildQuoteHref(contextSummary.latestQuotationId, viewer.impersonateId),
          createReceipt: buildCreateReceiptHref(viewer.impersonateId),
          agentOrders: buildVoiceHref("/marketing/agent-orders", viewer.impersonateId),
          callBack: `tel:${call.callerNumber}`,
        },
      };
    }),
  );

  const followUps = await Promise.all(
    followUpsRaw.map(async (task) => {
      const context = await getContextForPhone(task.phone, false);
      const contextSummary = serializeCustomerContextSummary(context);
      return {
        id: task.id,
        type: "task" as const,
        phone: task.phone,
        title: task.title,
        status: task.status,
        statusLabel: formatStatusLabel(task.status),
        notes: task.notes,
        dueAt: toIso(task.dueAt),
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        queueReasonLabel: getQueueReasonLabelForLead("VOICE_FOLLOW_UP", task.title),
        callbackOverdueSeconds: getCallbackOverdueSeconds({
          dueAt: toIso(task.dueAt),
          status: task.status,
        }),
        assignedToId: task.assignedToId,
        assignedToName: task.assignedTo?.name ?? null,
        assignedToEmail: task.assignedTo?.email ?? null,
        voiceCallId: task.voiceCallId,
        voiceLeadId: task.voiceLeadId,
        customer: contextSummary,
        links: {
          customer: buildPhoneSearchHref(contextSummary.normalizedPhone || task.phone, viewer.impersonateId),
          quote: buildQuoteHref(contextSummary.latestQuotationId, viewer.impersonateId),
          receipt: buildReceiptHref(contextSummary.latestReceiptId, viewer.impersonateId),
          callBack: `tel:${task.phone}`,
        },
        assignedAgentLabel: task.assignedTo?.name ?? task.assignedTo?.email ?? contextSummary.assignedAgent?.name ?? "Unassigned",
      };
    }),
  );

  const taskLeadPhoneSet = new Set(followUps.map((task) => task.phone));
  const missedLeads = await Promise.all(
    voiceLeadsRaw
      .filter((lead) => !taskLeadPhoneSet.has(lead.phone))
      .map(async (lead) => {
        const context = await getContextForPhone(lead.phone, false);
        const contextSummary = serializeCustomerContextSummary(context);
        return {
          id: lead.id,
          type: "lead" as const,
          phone: lead.phone,
          title: lead.name || "Voice lead",
          status: lead.status,
          statusLabel: formatStatusLabel(lead.status),
          notes: null,
          dueAt: null,
          createdAt: lead.createdAt.toISOString(),
          updatedAt: lead.updatedAt.toISOString(),
          queueReasonLabel: getQueueReasonLabelForLead(lead.source, lead.name),
          callbackOverdueSeconds: 0,
          assignedToId: lead.assignedToId,
          assignedToName: lead.assignedTo?.name ?? null,
          assignedToEmail: lead.assignedTo?.email ?? null,
          voiceCallId: null,
          voiceLeadId: lead.id,
          customer: contextSummary,
        links: {
          customer: buildPhoneSearchHref(contextSummary.normalizedPhone || lead.phone, viewer.impersonateId),
          quote: buildQuoteHref(contextSummary.latestQuotationId, viewer.impersonateId),
          receipt: buildReceiptHref(contextSummary.latestReceiptId, viewer.impersonateId),
          callBack: `tel:${lead.phone}`,
        },
        assignedAgentLabel: lead.assignedTo?.name ?? lead.assignedTo?.email ?? contextSummary.assignedAgent?.name ?? "Unassigned",
      };
    }),
  );

  const activeCallIdsByAgent = new Map<string, number>();
  const waitingCallIdsByAgent = new Map<string, number>();
  for (const call of activeCalls) {
    if (!call.assignedToId) continue;
    activeCallIdsByAgent.set(call.assignedToId, (activeCallIdsByAgent.get(call.assignedToId) ?? 0) + 1);
    if (isWaitingStatus(call.status)) {
      waitingCallIdsByAgent.set(call.assignedToId, (waitingCallIdsByAgent.get(call.assignedToId) ?? 0) + 1);
    }
  }

  const agents = voiceAgentsRaw
    .map((agent) =>
      serializePresenceRow(
        agent,
        activeCallIdsByAgent.get(agent.id) ?? 0,
        waitingCallIdsByAgent.get(agent.id) ?? 0,
      ),
    )
    .filter((agent) => (viewer.isAdmin ? agent.isRoutingAgent : true))
    .sort((left, right) => left.routingPriority - right.routingPriority || left.displayName.localeCompare(right.displayName));

  const activeCallsCount = activeCalls.filter((call) => call.isActive).length;
  const waitingCallsCount = activeCalls.filter((call) => isWaitingStatus(call.status)).length;
  const answeredCallsCount = recentCalls.filter((call) => isAnsweredStatus(call.status)).length;
  const missedCallsCount =
    followUps.filter((task) => isMissedStatus(task.status) || task.status === "pending").length +
    missedLeads.filter((lead) => isMissedStatus(lead.status) || lead.status === "pending_follow_up" || lead.status === "open").length;
  const longestWaitingSeconds = activeCalls.reduce((max, call) => Math.max(max, call.waitingSeconds || 0), 0);
  const callbackOverdueCount = followUps.filter((task) => Number(task.callbackOverdueSeconds || 0) > 0).length;
  const transferRate =
    recentCalls.length > 0
      ? recentCalls.filter((call) => normalizeStatus(call.status) === "transferred").length / recentCalls.length
      : 0;
  const answerRate = recentCalls.length > 0 ? answeredCallsCount / recentCalls.length : 0;
  const callbackCompletionRate =
    followUps.length > 0
      ? followUps.filter((task) => ["resolved", "closed", "contacted"].includes(normalizeStatus(task.status))).length / followUps.length
      : 0;
  const missedByAgent = Object.values(
    [...followUps, ...missedLeads].reduce<Record<string, { agent: string; count: number }>>((accumulator, item) => {
      const agent =
        String(item.assignedToName || item.assignedToEmail || item.assignedAgentLabel || "Unassigned").trim() || "Unassigned";
      if (!accumulator[agent]) accumulator[agent] = { agent, count: 0 };
      accumulator[agent].count += 1;
      return accumulator;
    }, {}),
  ).sort((left, right) => right.count - left.count);
  const availableAgentsCount = agents.filter((agent) => agent.isAvailableForRouting).length;
  const routingCandidates = routingCandidatesRaw.map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    email: candidate.email,
    phone: candidate.phone,
    role: candidate.role,
    attendantCategory: candidate.attendantCategory,
    label:
      String(candidate.name || "").trim() ||
      String(candidate.email || "").trim() ||
      String(candidate.phone || "").trim() ||
      "Unnamed user",
  }));

  const selectedCall =
    (input.selectedCallId ? activeCalls.find((call) => call.id === input.selectedCallId) || recentCalls.find((call) => call.id === input.selectedCallId) : null) ||
    (input.selectedPhone ? activeCalls.find((call) => call.callerNumber === input.selectedPhone) || recentCalls.find((call) => call.callerNumber === input.selectedPhone) : null) ||
    activeCalls[0] ||
    recentCalls[0] ||
    null;

  const normalizedSelectedPhone = normalizeKenyanPhone(input.selectedPhone || "");
  const selectedPhoneVariants = normalizedSelectedPhone ? getKenyanPhoneVariants(normalizedSelectedPhone) : [];
  const fallbackSelectedCall =
    !selectedCall && selectedPhoneVariants.length
      ? await prisma.voiceCall.findFirst({
          where: {
            ...callWhere,
            OR: [
              { callerNumber: { in: selectedPhoneVariants } },
              { destinationNumber: { in: selectedPhoneVariants } },
            ],
          },
          include: {
            assignedTo: { select: { id: true, name: true, email: true } },
          },
          orderBy: [{ createdAt: "desc" }],
        })
      : null;

  const effectiveSelectedCall = selectedCall || fallbackSelectedCall;
  const selectedPhone = normalizedSelectedPhone || selectedCall?.callerNumber || fallbackSelectedCall?.callerNumber || followUps[0]?.phone || missedLeads[0]?.phone || null;
  const selectedContext = selectedPhone ? serializeCustomerContextSummary(await getContextForPhone(selectedPhone, true)) : null;
  const selectedCallDetail = effectiveSelectedCall
    ? await prisma.voiceCall.findUnique({
        where: { id: effectiveSelectedCall.id },
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
          events: {
            orderBy: [{ createdAt: "asc" }],
            take: 24,
          },
          callNotes: {
            include: {
              author: { select: { id: true, name: true, email: true } },
            },
            orderBy: [{ createdAt: "desc" }],
            take: 12,
          },
          followUps: {
            include: {
              assignedTo: { select: { id: true, name: true, email: true } },
            },
            orderBy: [{ updatedAt: "desc" }],
            take: 12,
          },
        },
      })
    : null;

  return {
    generatedAt: new Date().toISOString(),
    viewer: {
      actorUserId: viewer.actorUserId,
      actorRole: viewer.actorRole,
      actorEmail: viewer.actorEmail,
      targetUserId: viewer.targetUserId,
      targetRole: viewer.targetRole,
      targetAttendantCategory: viewer.targetAttendantCategory,
      isAdmin: viewer.isAdmin,
      impersonateId: viewer.impersonateId,
      scope,
      popupDismissedCallId: agents.find((agent) => agent.id === viewer.targetUserId)?.dismissedPopupCallId ?? null,
    },
    routingConfig: {
      overflowUserId: voiceRoutingConfigRaw?.overflowUserId ?? null,
      overflowPhone: voiceRoutingConfigRaw?.overflowPhone ?? null,
      overflowUserLabel:
        voiceRoutingConfigRaw?.overflowUser?.name ||
        voiceRoutingConfigRaw?.overflowUser?.email ||
        voiceRoutingConfigRaw?.overflowUser?.phone ||
        null,
      updatedAt: toIso(voiceRoutingConfigRaw?.updatedAt),
    },
    routingCandidates,
    summary: viewer.isAdmin
      ? {
          callsToday: callsTodayCount,
          activeCalls: activeCallsCount,
          waitingCalls: waitingCallsCount,
          answeredCalls: answeredCallsCount,
          missedCalls: missedCallsCount,
          averageTalkTimeSeconds: Math.round(Number(avgTalkAggregate._avg.durationInSeconds ?? 0)),
          callCostToday: Number(callCostAggregate._sum.amount ?? 0),
          newVoiceLeads: newVoiceLeadsCount,
          wallboard: {
            liveQueue: waitingCallsCount + followUps.length + missedLeads.length,
            longestWaitingSeconds,
            availableAgents: availableAgentsCount,
            answeredToday: answeredCallsCount,
            missedToday: missedCallsCount,
          },
          supervisor: {
            answerRate,
            transferRate,
            callbackCompletionRate,
            callbackOverdueCount,
            missedByAgent,
          },
        }
      : {
          myCallsToday: callsTodayCount,
          myActiveCalls: activeCallsCount,
          myMissedCalls: missedCallsCount,
          myFollowUps: followUps.length + missedLeads.length,
          myAnsweredCalls: answeredCallsCount,
        },
    activeCalls,
    waitingCalls: activeCalls.filter((call) => isWaitingStatus(call.status)),
    callQueue: [...followUps, ...missedLeads].sort((left, right) => {
      const leftAt = new Date(left.dueAt || left.updatedAt).getTime();
      const rightAt = new Date(right.dueAt || right.updatedAt).getTime();
      return leftAt - rightAt;
    }),
    recentCalls,
    recentRecordings: recentCalls.filter((call) => Boolean(call.recordingUrl)).slice(0, 8),
    followUps,
    missedLeads,
    agents,
    selectedCallId: effectiveSelectedCall?.id ?? null,
    selectedPhone,
    selectedContext,
    selectedCallDetail: selectedCallDetail
      ? {
          ...(function () {
            const { displayStatus, providerStatus } = resolveVoiceProviderOutcome(selectedCallDetail);
            const reviewStatus = getFollowUpReviewStatus(displayStatus, selectedCallDetail.followUps);
            const effectiveStatus = reviewStatus || displayStatus;
            return {
              status: effectiveStatus,
              statusLabel: formatStatusLabel(effectiveStatus),
              providerStatus,
              providerStatusLabel: formatStatusLabel(providerStatus),
            };
          })(),
          id: selectedCallDetail.id,
          sessionId: selectedCallDetail.sessionId,
          callerNumber: selectedCallDetail.callerNumber,
          direction: selectedCallDetail.direction,
          queueReasonLabel: getCallQueueReasonLabel(selectedCallDetail),
          routedTo: selectedCallDetail.routedTo,
          assignedToName: selectedCallDetail.assignedTo?.name ?? null,
          assignedToEmail: selectedCallDetail.assignedTo?.email ?? null,
          recordingUrl: selectedCallDetail.recordingUrl,
          durationInSeconds: selectedCallDetail.durationInSeconds ?? 0,
          amount: Number(selectedCallDetail.amount ?? 0),
          currencyCode: selectedCallDetail.currencyCode ?? "KES",
          startedAt: toIso(selectedCallDetail.startedAt),
          endedAt: toIso(selectedCallDetail.endedAt),
          sla: {
            firstResponseSeconds: getRingSeconds(selectedCallDetail),
            ringSeconds: getRingSeconds(selectedCallDetail),
            talkSeconds: Number(selectedCallDetail.durationInSeconds ?? 0),
          },
          hopAudit: buildHopAudit(selectedCallDetail.events),
          disposition:
            selectedCallDetail.callNotes
              .map((note) => extractDisposition(note.note))
              .find(Boolean) ?? null,
          timeline: [
            ...selectedCallDetail.events.map((event) => ({
              id: `event-${event.id}`,
              type: "EVENT",
              title: event.eventType.replace(/_/g, " "),
              detail: event.payloadJson && typeof event.payloadJson === "object"
                ? String((event.payloadJson as Record<string, unknown>).status || (event.payloadJson as Record<string, unknown>).callSessionState || "")
                : "",
              at: event.createdAt.toISOString(),
            })),
            ...selectedCallDetail.followUps.map((task) => ({
              id: `followup-${task.id}`,
              type: "FOLLOW_UP",
              title: task.title,
              detail: `${task.status.replace(/_/g, " ")}${task.assignedTo?.name ? ` · ${task.assignedTo.name}` : ""}`,
              at: task.updatedAt.toISOString(),
            })),
            ...selectedCallDetail.callNotes.map((note) => ({
              id: `note-${note.id}`,
              type: "NOTE",
              title: `Note${note.author?.name ? ` · ${note.author.name}` : ""}`,
              detail: note.note,
              at: note.createdAt.toISOString(),
            })),
          ].sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime()),
          notes: selectedCallDetail.callNotes.map((note) => ({
            id: note.id,
            note: note.note,
            createdAt: note.createdAt.toISOString(),
            authorName: note.author?.name ?? null,
            authorEmail: note.author?.email ?? null,
          })),
          followUps: selectedCallDetail.followUps.map((task) => ({
            id: task.id,
            title: task.title,
            status: task.status,
            dueAt: toIso(task.dueAt),
            notes: task.notes,
            assignedToName: task.assignedTo?.name ?? null,
            assignedToEmail: task.assignedTo?.email ?? null,
          })),
        }
      : null,
  };
}

export async function listVoiceCallsSnapshot(input: VoiceLiveSnapshotInput) {
  const snapshot = await getVoiceLiveSnapshot(input);
  return {
    generatedAt: snapshot.generatedAt,
    activeCalls: snapshot.activeCalls,
    recentCalls: snapshot.recentCalls,
    waitingCalls: snapshot.waitingCalls,
  };
}

export type VoiceLiveSnapshot = Awaited<ReturnType<typeof getVoiceLiveSnapshot>>;
export type VoiceCallsSnapshot = Awaited<ReturnType<typeof listVoiceCallsSnapshot>>;

export async function updateVoicePresence(input: {
  userId: string;
  status?: string | null;
  currentCallId?: string | null;
}) {
  const normalizedStatus = input.status == null ? null : String(input.status || "").trim().toUpperCase();
  if (normalizedStatus && !VOICE_PRESENCE_STATUSES.includes(normalizedStatus as VoicePresenceStatus)) {
    throw new Error("invalid_presence_status");
  }

  const existingPresence = await prisma.voiceAgentPresence.findUnique({
    where: { userId: input.userId },
  });
  const now = new Date();
  const normalizedCurrentCallId = input.currentCallId ?? null;

  if (existingPresence) {
    const statusMatches = (normalizedStatus ?? existingPresence.status) === existingPresence.status;
    const callMatches = normalizedCurrentCallId === existingPresence.currentCallId;
    const lastSeenAgeMs = now.getTime() - existingPresence.lastSeenAt.getTime();

    if (statusMatches && callMatches && lastSeenAgeMs < VOICE_PRESENCE_WRITE_DEBOUNCE_MS) {
      return existingPresence;
    }
  }

  const presence = await prisma.voiceAgentPresence.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      status: normalizedStatus || "OFFLINE",
      currentCallId: normalizedCurrentCallId,
      lastSeenAt: now,
    },
    update: {
      status: normalizedStatus ?? undefined,
      currentCallId: normalizedCurrentCallId,
      lastSeenAt: now,
    },
  });
  publishVoiceLiveEvent({
    type: "presence",
    reason: "presence_updated",
    userId: presence.userId,
    callId: presence.currentCallId,
  });
  return presence;
}

export async function updateVoicePopupDismissal(input: {
  userId: string;
  dismissedPopupCallId?: string | null;
}) {
  const dismissedPopupCallId = String(input.dismissedPopupCallId || "").trim() || null;
  const presence = await prisma.voiceAgentPresence.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      status: "OFFLINE",
      lastSeenAt: new Date(),
      dismissedPopupCallId,
      dismissedPopupAt: dismissedPopupCallId ? new Date() : null,
    },
    update: {
      dismissedPopupCallId,
      dismissedPopupAt: dismissedPopupCallId ? new Date() : null,
      lastSeenAt: new Date(),
    },
  });

  publishVoiceLiveEvent({
    type: "presence",
    reason: "voice_popup_dismissal_updated",
    userId: presence.userId,
    callId: presence.dismissedPopupCallId ?? undefined,
  });

  return presence;
}

export async function updateVoiceAgentRoutingPreference(input: {
  userId: string;
  routingEnabled?: boolean | null;
  allowAfterHoursCalls?: boolean | null;
}) {
  const existingUser = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, isActive: true },
  });
  if (!existingUser?.isActive) {
    throw new Error("voice_routing_user_not_found");
  }

  const preference = await prisma.voiceAgentRoutingPreference.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      routingEnabled: input.routingEnabled ?? true,
      allowAfterHoursCalls: input.allowAfterHoursCalls ?? false,
    },
    update: {
      routingEnabled: input.routingEnabled ?? undefined,
      allowAfterHoursCalls: input.allowAfterHoursCalls ?? undefined,
    },
  });

  publishVoiceLiveEvent({
    type: "presence",
    reason: "voice_agent_routing_preference_updated",
    userId: input.userId,
  });

  return preference;
}

export async function updateVoiceRoutingConfig(input: {
  overflowUserId?: string | null;
  overflowPhone?: string | null;
}) {
  const overflowUserId = String(input.overflowUserId || "").trim() || null;
  const overflowPhone = normalizeKenyanPhone(String(input.overflowPhone || "").trim()) || null;

  if (overflowUserId) {
    const overflowUser = await prisma.user.findUnique({
      where: { id: overflowUserId },
      select: { id: true, isActive: true },
    });
    if (!overflowUser?.isActive) {
      throw new Error("voice_overflow_user_not_found");
    }
  }

  const config = await prisma.voiceRoutingConfig.upsert({
    where: { key: "default" },
    create: {
      key: "default",
      overflowUserId,
      overflowPhone,
    },
    update: {
      overflowUserId,
      overflowPhone,
    },
    include: {
      overflowUser: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  publishVoiceLiveEvent({
    type: "presence",
    reason: "voice_routing_config_updated",
    userId: overflowUserId ?? undefined,
  });

  return config;
}

export async function reassignVoiceWork(input: {
  callId?: string | null;
  queueId?: string | null;
  queueType?: "task" | "lead" | null;
  assignedToId: string;
}) {
  if (input.callId) {
    const call = await prisma.voiceCall.update({
      where: { id: input.callId },
      data: {
        assignedToId: input.assignedToId,
      },
    });

    await prisma.voiceFollowUp.updateMany({
      where: { voiceCallId: input.callId, status: { in: ["pending", "contacted"] } },
      data: { assignedToId: input.assignedToId },
    });

    const callContext = await prisma.voiceCall.findUnique({
      where: { id: input.callId },
      select: {
        callerNumber: true,
        destinationNumber: true,
        customerId: true,
        startedAt: true,
      },
    });
    const relatedFollowUps = await prisma.voiceFollowUp.findMany({
      where: {
        OR: [{ voiceCallId: input.callId }],
      },
      select: {
        phone: true,
      },
      orderBy: [{ updatedAt: "desc" }],
    });

    const assignmentPhones = Array.from(
      new Set(
        [
          callContext ? getManualReassignmentPhone(callContext) : null,
          ...relatedFollowUps.map((item) => normalizeKenyanPhone(String(item.phone || "").trim()) || null),
        ].filter((value): value is string => Boolean(value)),
      ),
    );

    for (const assignmentPhone of assignmentPhones) {
      await persistVoicePhoneAssignment({
        phone: assignmentPhone,
        assignedToId: input.assignedToId,
        customerId: callContext?.customerId ?? null,
        lastCallAt: callContext?.startedAt ?? null,
      });
      await propagateVoiceCallAssignmentByPhone({
        phone: assignmentPhone,
        assignedToId: input.assignedToId,
      });
    }

    publishVoiceLiveEvent({
      type: "queue",
      reason: "voice_call_reassigned",
      callId: call.id,
      userId: call.assignedToId,
    });
    return { type: "call" as const, id: call.id, assignedToId: call.assignedToId };
  }

  if (input.queueId && input.queueType === "task") {
    const followUp = await prisma.voiceFollowUp.update({
      where: { id: input.queueId },
      data: { assignedToId: input.assignedToId },
    });
    const normalizedPhone = normalizeKenyanPhone(followUp.phone);
    if (normalizedPhone) {
      await persistVoicePhoneAssignment({
        phone: normalizedPhone,
        assignedToId: input.assignedToId,
      });
    }
    publishVoiceLiveEvent({
      type: "queue",
      reason: "voice_task_reassigned",
      callId: followUp.voiceCallId,
      userId: followUp.assignedToId,
    });
    return { type: "task" as const, id: followUp.id, assignedToId: followUp.assignedToId };
  }

  if (input.queueId && input.queueType === "lead") {
    const lead = await prisma.voiceLead.update({
      where: { id: input.queueId },
      data: { assignedToId: input.assignedToId },
    });
    await prisma.voiceFollowUp.updateMany({
      where: {
        OR: [{ voiceLeadId: lead.id }, { phone: lead.phone }],
        status: { in: ["pending", "contacted", "open", "pending_follow_up"] },
      },
      data: { assignedToId: input.assignedToId },
    });
    publishVoiceLiveEvent({
      type: "queue",
      reason: "voice_lead_reassigned",
      userId: lead.assignedToId,
    });
    return { type: "lead" as const, id: lead.id, assignedToId: lead.assignedToId };
  }

  throw new Error("reassign_target_required");
}

export async function addVoiceCallNote(input: {
  voiceCallId: string;
  authorId: string;
  note: string;
}) {
  const trimmedNote = input.note.trim();
  if (!trimmedNote) throw new Error("note_required");

  const call = await prisma.voiceCall.findUnique({
    where: { id: input.voiceCallId },
    select: {
      id: true,
      customerId: true,
    },
  });

  if (!call) throw new Error("voice_call_not_found");

  const note = await prisma.voiceCallNote.create({
    data: {
      voiceCallId: call.id,
      customerId: call.customerId,
      authorId: input.authorId,
      note: trimmedNote,
    },
  });
  publishVoiceLiveEvent({
    type: "note",
    reason: "voice_call_note_created",
    callId: call.id,
    userId: input.authorId,
  });
  return note;
}

export async function saveVoiceFollowUp(input: {
  id?: string | null;
  voiceCallId?: string | null;
  voiceLeadId?: string | null;
  customerId?: string | null;
  assignedToId?: string | null;
  phone?: string | null;
  title?: string | null;
  status?: string | null;
  dueAt?: string | null;
  notes?: string | null;
}) {
  const normalizedStatus = String(input.status || "pending").trim().toLowerCase();
  if (!["pending", "contacted", "resolved", "closed"].includes(normalizedStatus)) {
    throw new Error("invalid_follow_up_status");
  }

  const normalizedDueAt = input.dueAt ? new Date(input.dueAt) : null;
  if (normalizedDueAt && Number.isNaN(normalizedDueAt.getTime())) {
    throw new Error("invalid_due_at");
  }

  if (input.id) {
    const followUp = await prisma.voiceFollowUp.update({
      where: { id: input.id },
      data: {
        title: input.title?.trim() || undefined,
        status: normalizedStatus,
        dueAt: normalizedDueAt ?? undefined,
        notes: input.notes?.trim() || undefined,
        assignedToId: input.assignedToId ?? undefined,
      },
    });
    publishVoiceLiveEvent({
      type: "follow_up",
      reason: "voice_follow_up_updated",
      callId: followUp.voiceCallId,
      userId: followUp.assignedToId,
    });
    return followUp;
  }

  let phone = String(input.phone || "").trim();
  let customerId = input.customerId ?? null;

  if (input.voiceCallId) {
    const call = await prisma.voiceCall.findUnique({
      where: { id: input.voiceCallId },
      select: {
        callerNumber: true,
        customerId: true,
        assignedToId: true,
      },
    });
    if (!call) throw new Error("voice_call_not_found");
    if (!phone) phone = call.callerNumber;
    if (!customerId) customerId = call.customerId;
    if (!input.assignedToId && call.assignedToId) {
      input.assignedToId = call.assignedToId;
    }
  }

  if (input.voiceLeadId && !phone) {
    const lead = await prisma.voiceLead.findUnique({
      where: { id: input.voiceLeadId },
      select: { phone: true, customerId: true, assignedToId: true },
    });
    if (!lead) throw new Error("voice_lead_not_found");
    phone = lead.phone;
    if (!customerId) customerId = lead.customerId;
    if (!input.assignedToId && lead.assignedToId) {
      input.assignedToId = lead.assignedToId;
    }
  }

  if (!phone) throw new Error("phone_required");
  if (!input.title?.trim()) throw new Error("title_required");

  const followUp = await prisma.voiceFollowUp.create({
    data: {
      voiceCallId: input.voiceCallId ?? null,
      voiceLeadId: input.voiceLeadId ?? null,
      customerId,
      assignedToId: input.assignedToId ?? null,
      phone,
      title: input.title.trim(),
      status: normalizedStatus,
      dueAt: normalizedDueAt,
      notes: input.notes?.trim() || null,
    },
  });
  publishVoiceLiveEvent({
    type: "follow_up",
    reason: "voice_follow_up_created",
    callId: followUp.voiceCallId,
    userId: followUp.assignedToId,
  });
  return followUp;
}

export async function updateVoiceQueueStatus(input: {
  followUpId?: string | null;
  voiceLeadId?: string | null;
  status: string;
}) {
  const normalizedStatus = String(input.status || "").trim().toLowerCase();
  if (!normalizedStatus) {
    throw new Error("status_required");
  }

  if (input.followUpId) {
    if (!["pending", "contacted", "resolved", "closed"].includes(normalizedStatus)) {
      throw new Error("invalid_follow_up_status");
    }

    const followUp = await prisma.voiceFollowUp.update({
      where: { id: input.followUpId },
      data: { status: normalizedStatus },
    });

    publishVoiceLiveEvent({
      type: "follow_up",
      reason: "voice_follow_up_status_updated",
      callId: followUp.voiceCallId,
      userId: followUp.assignedToId,
    });

    return { type: "follow_up" as const, id: followUp.id, status: followUp.status };
  }

  if (input.voiceLeadId) {
    if (!["open", "pending_follow_up", "contacted", "closed"].includes(normalizedStatus)) {
      throw new Error("invalid_voice_lead_status");
    }

    const lead = await prisma.voiceLead.update({
      where: { id: input.voiceLeadId },
      data: { status: normalizedStatus },
    });

    publishVoiceLiveEvent({
      type: "queue",
      reason: "voice_lead_status_updated",
      userId: lead.assignedToId,
    });

    return { type: "lead" as const, id: lead.id, status: lead.status };
  }

  throw new Error("queue_status_target_required");
}
