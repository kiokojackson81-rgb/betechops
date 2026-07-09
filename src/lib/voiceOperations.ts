import { auth } from "@/lib/auth";
import { buildAdminCustomerProfileHref } from "@/lib/adminCustomerProfileLinks";
import { getKenyanPhoneVariants, normalizeKenyanPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { getVoiceTestNumberLabel, isVoiceAdminTestPhone } from "@/lib/voiceTestNumbers";
import { getVoiceCustomerContext } from "@/lib/voiceCustomerContext";
import { publishVoiceLiveEvent } from "@/lib/voiceLiveEvents";
import { getVoiceWebrtcRegistryEntry } from "@/lib/voiceWebrtc/registry";

export const VOICE_ALLOWED_ATTENDANT_CATEGORIES = ["DIRECT_SALES_OPS", "MARKETING_OPS"] as const;
export const VOICE_PRESENCE_STATUSES = ["AVAILABLE", "AWAY", "BUSY", "BREAK", "OFFLINE"] as const;
const ATTEMPTED_CALL_THRESHOLD_SECONDS = 14;
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

function isLiveActiveStatus(status: string | null | undefined) {
  return ["answered", "connected", "transferred", "in_progress", "processing"].includes(normalizeStatus(status));
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

function isAttemptedCallStatus(status: string | null | undefined) {
  const normalized = normalizeStatus(status);
  return normalized === "attempted_call" || normalized === "attempted call";
}

function isAgentAvailableForRouting(status: string | null | undefined, lastSeenAt: Date | null | undefined) {
  if (String(status || "").trim().toUpperCase() !== "AVAILABLE") return false;
  if (!lastSeenAt) return false;
  return Date.now() - lastSeenAt.getTime() <= VOICE_PRESENCE_STALE_MS;
}

function formatStatusLabel(status: string | null | undefined) {
  return String(status || "unknown").replace(/_/g, " ");
}

function getVoiceTimelineEventStatus(event: {
  eventType?: string | null;
  payloadJson?: unknown;
}) {
  if (event.payloadJson && typeof event.payloadJson === "object") {
    const payload = event.payloadJson as Record<string, unknown>;
    const payloadStatus = String(payload.status || payload.callSessionState || "").trim();
    if (payloadStatus) return payloadStatus;
  }
  return String(event.eventType || "").trim();
}

function formatVoiceTimelineEvent(input: {
  event: {
    id: string;
    eventType: string;
    payloadJson?: unknown;
    createdAt: Date;
  };
  finalStatus: string | null | undefined;
}) {
  const rawStatus = getVoiceTimelineEventStatus(input.event);
  const normalizedRawStatus = normalizeStatus(rawStatus);
  const normalizedFinalStatus = normalizeStatus(input.finalStatus);
  const isAttemptedFinalStatus =
    normalizedFinalStatus === "attempted_call" || normalizedFinalStatus === "attempted call";

  if (isAttemptedFinalStatus && ["answered", "connected", "in_progress", "processing", "active"].includes(normalizedRawStatus)) {
    return {
      id: `event-${input.event.id}`,
      type: "EVENT",
      title: "ATTEMPTED CALL",
      detail: "Call did not reach the bridged talk stage",
      at: input.event.createdAt.toISOString(),
    };
  }

  return {
    id: `event-${input.event.id}`,
    type: "EVENT",
    title: input.event.eventType.replace(/_/g, " "),
    detail: rawStatus,
    at: input.event.createdAt.toISOString(),
  };
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
  if (!isMissedStatus(baseStatus) && !isAttemptedCallStatus(baseStatus)) return null;
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
  callerNumber?: string | null;
  routeType?: string | null;
  menuOption?: string | null;
  rawPayloadJson?: unknown;
  assignedToId?: string | null;
}) {
  if (isVoiceAdminTestPhone(call.callerNumber)) {
    return "Test number";
  }
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

function getFollowUpReasonMeta(input: {
  itemType: "task" | "lead";
  source?: string | null;
  title?: string | null;
  notes?: string | null;
  voiceCallId?: string | null;
  voiceLeadId?: string | null;
  callbackRequestedAt?: string | null;
}) {
  const normalizedSource = String(input.source || "").trim().toUpperCase();
  const normalizedTitle = String(input.title || "").trim().toLowerCase();
  const normalizedNotes = String(input.notes || "").trim().toLowerCase();

  if (input.callbackRequestedAt) {
    return { kind: "requested_callback", label: "Requested Callback" } as const;
  }
  if (normalizedNotes.includes("attempted call") || normalizedTitle.includes("requested callback")) {
    return { kind: "attempted_call", label: "Call Attempt" } as const;
  }
  if (input.itemType === "lead" && normalizedSource === "VOICE_MISSED_CALL") {
    return { kind: "missed_call", label: "Missed Call" } as const;
  }
  if (normalizedNotes.includes("auto-created after missed call") || normalizedNotes.includes("auto-created after no answer")) {
    return { kind: "missed_call", label: "Missed Call" } as const;
  }
  if (!input.voiceCallId && !input.voiceLeadId && input.itemType === "task") {
    return { kind: "admin_follow_up", label: "Admin Follow-up" } as const;
  }
  if (input.itemType === "task") {
    return { kind: "task_follow_up", label: "Follow-up Task" } as const;
  }
  return { kind: "voice_lead", label: "Voice Lead" } as const;
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

function getVoiceSlaBreakdown(input: {
  status: string | null | undefined;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  durationInSeconds?: number | null;
  isActive?: boolean | null;
}) {
  const totalDurationSeconds = Math.max(0, Number(input.durationInSeconds ?? 0));
  if (isAttemptedCallStatus(input.status)) {
    return {
      firstResponseSeconds: totalDurationSeconds,
      ringSeconds: totalDurationSeconds,
      talkSeconds: 0,
    };
  }

  const ringSeconds = getRingSeconds(input);
  return {
    firstResponseSeconds: ringSeconds,
    ringSeconds,
    talkSeconds: totalDurationSeconds,
  };
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
  if (["attempted_call", "attempted call"].includes(normalized)) return "ATTEMPTED_CALL";
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

  if (["connected", "in_progress", "transferred"].includes(normalizedStatus)) {
    return normalizedStatus;
  }
  if (normalizedStatus === "answered") {
    if (direction === "INBOUND" && duration > 0 && treatInboundSuccessWithoutBridgeAsNoAnswer && !hasBridgeEvidence) {
      return duration < ATTEMPTED_CALL_THRESHOLD_SECONDS ? "attempted_call" : "no_answer";
    }
    return normalizedStatus;
  }

  if (isProviderTerminalSuccess && treatZeroDurationSuccessAsNoAnswer && duration <= 0) {
    return "no_answer";
  }

  if (isProviderTerminalSuccess && direction === "INBOUND" && duration > 0) {
    if (treatInboundSuccessWithoutBridgeAsNoAnswer && !hasBridgeEvidence) {
      return duration < ATTEMPTED_CALL_THRESHOLD_SECONDS ? "attempted_call" : "no_answer";
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

export function resolveVoiceProviderOutcome(call: {
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

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getCallStartedAt(call: { startedAt: Date | null; createdAt: Date }) {
  return call.startedAt ?? call.createdAt;
}

function getWaitingSeconds(call: { startedAt: Date | null; createdAt: Date; isActive: boolean }) {
  if (!call.isActive) return 0;
  const anchor = getCallStartedAt(call);
  return Math.max(0, Math.floor((Date.now() - anchor.getTime()) / 1000));
}

function buildCustomerProfileHrefFromContext(
  contextSummary: ReturnType<typeof serializeCustomerContextSummary>,
  fallbackPhone: string,
  impersonateId?: string | null,
) {
  return buildAdminCustomerProfileHref({
    customerUserId: contextSummary.matchedCustomerId,
    phone: contextSummary.normalizedPhone || fallbackPhone,
    phones: [contextSummary.normalizedPhone || fallbackPhone],
    email: contextSummary.email,
    displayName: contextSummary.customerName,
    impersonateId,
  });
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

function buildQuotePdfHref(quoteId: string | null | undefined, impersonateId?: string | null) {
  const url = new URL("https://voice.local/api/attendant/quote-requests");
  url.pathname = quoteId
    ? `/api/attendant/quote-requests/${encodeURIComponent(quoteId)}/pdf`
    : "/marketing/receipts";
  if (!quoteId) {
    url.searchParams.set("tab", "quotations");
  }
  if (impersonateId) url.searchParams.set("impersonateId", impersonateId);
  return `${url.pathname}${url.searchParams.toString() ? `?${url.searchParams.toString()}` : ""}`;
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
    recentQuotations: context.recentQuotations.slice(0, 4).map((quotation) => {
      const quotationData =
        quotation.quotationData && typeof quotation.quotationData === "object"
          ? (quotation.quotationData as Record<string, unknown>)
          : null;
      const items = Array.isArray(quotationData?.items) ? quotationData.items : [];
      const totalAmount = Number(
        typeof quotationData?.total === "number"
          ? quotationData.total
          : typeof quotationData?.subtotal === "number"
            ? quotationData.subtotal
            : 0,
      );
      return {
        id: quotation.id,
        quoteRef: quotation.quoteRef,
        quoteTitle: quotation.quoteTitle || null,
        status: quotation.status,
        updatedAt: toIso(quotation.updatedAt || quotation.createdAt),
        customerActionAt: toIso(quotation.customerActionAt),
        itemCount: items.length,
        totalAmount,
        href: buildQuoteHref(quotation.id),
        pdfHref: buildQuotePdfHref(quotation.id),
      };
    }),
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
  metrics?: {
    receivedCallsToday?: number;
    answeredCallsToday?: number;
    missedCallsToday?: number;
    attemptedCallsToday?: number;
  },
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
    receivedCallsToday: metrics?.receivedCallsToday ?? 0,
    answeredCallsToday: metrics?.answeredCallsToday ?? 0,
    missedCallsToday: metrics?.missedCallsToday ?? 0,
    attemptedCallsToday: metrics?.attemptedCallsToday ?? 0,
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
    waitingCallsRaw,
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
        OR: [{ isActive: true }, { status: { in: ["in_progress", "answered", "connected", "transferred", "processing"] } }],
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
    prisma.voiceCall.findMany({
      where: {
        ...callWhere,
        status: { in: ["queued", "ringing", "initiated", "dialing", "new", "pending"] },
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

  const callbackRequestTaskIds = followUpsRaw.map((task) => task.id);
  const callbackRequestCallIds = Array.from(
    new Set(
      followUpsRaw
        .map((task) => task.voiceCallId)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const callbackRequestPhones = Array.from(
    new Set(
      [...followUpsRaw.map((task) => task.phone), ...voiceLeadsRaw.map((lead) => lead.phone)].flatMap((phone) =>
        getKenyanPhoneVariants(phone),
      ),
    ),
  );
  const callbackRequestFilters = [
    callbackRequestTaskIds.length ? { followUpTaskId: { in: callbackRequestTaskIds } } : null,
    callbackRequestCallIds.length ? { voiceCallId: { in: callbackRequestCallIds } } : null,
    callbackRequestPhones.length ? { normalizedPhone: { in: callbackRequestPhones } } : null,
  ].filter(Boolean) as Array<Record<string, unknown>>;
  const callbackRequestsRaw = callbackRequestFilters.length
    ? await prisma.voiceCallbackRequest.findMany({
        where: {
          requestedAt: { not: null },
          OR: callbackRequestFilters,
        },
        select: {
          id: true,
          normalizedPhone: true,
          voiceCallId: true,
          followUpTaskId: true,
          openedAt: true,
          requestedAt: true,
          openedCount: true,
          createdAt: true,
        },
        orderBy: [{ requestedAt: "desc" }, { createdAt: "desc" }],
      })
    : [];
  const callbackRequestByTaskId = new Map<string, (typeof callbackRequestsRaw)[number]>();
  const callbackRequestByCallId = new Map<string, (typeof callbackRequestsRaw)[number]>();
  const callbackRequestByPhone = new Map<string, (typeof callbackRequestsRaw)[number]>();
  for (const request of callbackRequestsRaw) {
    if (request.followUpTaskId && !callbackRequestByTaskId.has(request.followUpTaskId)) {
      callbackRequestByTaskId.set(request.followUpTaskId, request);
    }
    if (request.voiceCallId && !callbackRequestByCallId.has(request.voiceCallId)) {
      callbackRequestByCallId.set(request.voiceCallId, request);
    }
    if (request.normalizedPhone && !callbackRequestByPhone.has(request.normalizedPhone)) {
      callbackRequestByPhone.set(request.normalizedPhone, request);
    }
  }

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

  for (const item of recentCallFollowUpsRaw) {
    if (item.voiceCallId) {
      followUpsByCallId.set(item.voiceCallId, [...(followUpsByCallId.get(item.voiceCallId) || []), item]);
    }
  }

  const activeCalls = await Promise.all(
    activeCallsRaw.map(async (call) => {
      const context = await getContextForPhone(call.callerNumber, true);
      const contextSummary = serializeCustomerContextSummary(context);
      const lastActivity = contextSummary.recentTimeline[0] ?? null;
      const { displayStatus, providerStatus } = resolveVoiceProviderOutcome(call);
      const testNumberLabel = getVoiceTestNumberLabel(call.callerNumber);
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
        testNumberLabel,
        isTestNumber: Boolean(testNumberLabel),
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
          customer: buildCustomerProfileHrefFromContext(contextSummary, call.callerNumber, viewer.impersonateId),
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
      const context = await getContextForPhone(call.callerNumber, true);
      const contextSummary = serializeCustomerContextSummary(context);
      const lastActivity = contextSummary.recentTimeline[0] ?? null;
      const { displayStatus, providerStatus } = resolveVoiceProviderOutcome(call);
      const reviewStatus = isVoiceAdminTestPhone(call.callerNumber)
        ? null
        : getFollowUpReviewStatus(displayStatus, followUpsByCallId.get(call.id) || []);
      const effectiveStatus = reviewStatus || displayStatus;
      const testNumberLabel = getVoiceTestNumberLabel(call.callerNumber);
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
        testNumberLabel,
        isTestNumber: Boolean(testNumberLabel),
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
          customer: buildCustomerProfileHrefFromContext(contextSummary, call.callerNumber, viewer.impersonateId),
          receipt: buildReceiptHref(contextSummary.latestReceiptId, viewer.impersonateId),
          quote: buildQuoteHref(contextSummary.latestQuotationId, viewer.impersonateId),
          createReceipt: buildCreateReceiptHref(viewer.impersonateId),
          agentOrders: buildVoiceHref("/marketing/agent-orders", viewer.impersonateId),
          callBack: `tel:${call.callerNumber}`,
        },
      };
    }),
  );

  const waitingCalls = await Promise.all(
    waitingCallsRaw.map(async (call) => {
      const context = await getContextForPhone(call.callerNumber, true);
      const contextSummary = serializeCustomerContextSummary(context);
      const lastActivity = contextSummary.recentTimeline[0] ?? null;
      const { displayStatus, providerStatus } = resolveVoiceProviderOutcome(call);
      const testNumberLabel = getVoiceTestNumberLabel(call.callerNumber);
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
        testNumberLabel,
        isTestNumber: Boolean(testNumberLabel),
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
          customer: buildCustomerProfileHrefFromContext(contextSummary, call.callerNumber, viewer.impersonateId),
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
      if (isVoiceAdminTestPhone(task.phone)) return null;
      const context = await getContextForPhone(task.phone, true);
      const contextSummary = serializeCustomerContextSummary(context);
      const normalizedTaskPhone = normalizeKenyanPhone(task.phone);
      const callbackRequest =
        callbackRequestByTaskId.get(task.id) ||
        (task.voiceCallId ? callbackRequestByCallId.get(task.voiceCallId) : null) ||
        (normalizedTaskPhone ? callbackRequestByPhone.get(normalizedTaskPhone) : null) ||
        null;
      const reasonMeta = getFollowUpReasonMeta({
        itemType: "task",
        title: task.title,
        notes: task.notes,
        voiceCallId: task.voiceCallId,
        voiceLeadId: task.voiceLeadId,
        callbackRequestedAt: callbackRequest?.requestedAt?.toISOString() ?? null,
      });
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
        queueReasonKind: reasonMeta.kind,
        queueReasonDisplayLabel: reasonMeta.label,
        callbackOverdueSeconds: getCallbackOverdueSeconds({
          dueAt: toIso(task.dueAt),
          status: task.status,
        }),
        assignedToId: task.assignedToId,
        assignedToName: task.assignedTo?.name ?? null,
        assignedToEmail: task.assignedTo?.email ?? null,
        voiceCallId: task.voiceCallId,
        voiceLeadId: task.voiceLeadId,
        source: null,
        callbackRequestedAt: callbackRequest?.requestedAt?.toISOString() ?? null,
        callbackOpenedAt: callbackRequest?.openedAt?.toISOString() ?? null,
        callbackRequestClicks: callbackRequest?.openedCount ?? 0,
        customer: contextSummary,
        links: {
          customer: buildCustomerProfileHrefFromContext(contextSummary, task.phone, viewer.impersonateId),
          quote: buildQuoteHref(contextSummary.latestQuotationId, viewer.impersonateId),
          receipt: buildReceiptHref(contextSummary.latestReceiptId, viewer.impersonateId),
          callBack: `tel:${task.phone}`,
        },
        assignedAgentLabel: task.assignedTo?.name ?? task.assignedTo?.email ?? contextSummary.assignedAgent?.name ?? "Unassigned",
      };
    }),
  ).then((items) => items.filter((item): item is NonNullable<typeof item> => Boolean(item)));

  const taskLeadPhoneSet = new Set(followUps.map((task) => task.phone));
  const missedLeads = await Promise.all(
    voiceLeadsRaw
      .filter((lead) => !taskLeadPhoneSet.has(lead.phone))
      .map(async (lead) => {
        if (isVoiceAdminTestPhone(lead.phone)) return null;
        const context = await getContextForPhone(lead.phone, true);
        const contextSummary = serializeCustomerContextSummary(context);
        const normalizedLeadPhone = normalizeKenyanPhone(lead.phone);
        const callbackRequest = normalizedLeadPhone ? callbackRequestByPhone.get(normalizedLeadPhone) ?? null : null;
        const reasonMeta = getFollowUpReasonMeta({
          itemType: "lead",
          source: lead.source,
          title: lead.name,
          voiceLeadId: lead.id,
          callbackRequestedAt: callbackRequest?.requestedAt?.toISOString() ?? null,
        });
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
          queueReasonKind: reasonMeta.kind,
          queueReasonDisplayLabel: reasonMeta.label,
          callbackOverdueSeconds: 0,
          assignedToId: lead.assignedToId,
          assignedToName: lead.assignedTo?.name ?? null,
          assignedToEmail: lead.assignedTo?.email ?? null,
          voiceCallId: null,
          voiceLeadId: lead.id,
          source: lead.source,
          callbackRequestedAt: callbackRequest?.requestedAt?.toISOString() ?? null,
          callbackOpenedAt: callbackRequest?.openedAt?.toISOString() ?? null,
          callbackRequestClicks: callbackRequest?.openedCount ?? 0,
          customer: contextSummary,
          links: {
            customer: buildCustomerProfileHrefFromContext(contextSummary, lead.phone, viewer.impersonateId),
            quote: buildQuoteHref(contextSummary.latestQuotationId, viewer.impersonateId),
            receipt: buildReceiptHref(contextSummary.latestReceiptId, viewer.impersonateId),
            callBack: `tel:${lead.phone}`,
          },
          assignedAgentLabel: lead.assignedTo?.name ?? lead.assignedTo?.email ?? contextSummary.assignedAgent?.name ?? "Unassigned",
        };
      }),
  ).then((items) => items.filter((item): item is NonNullable<typeof item> => Boolean(item)));

  const activeCallIdsByAgent = new Map<string, number>();
  const waitingCallIdsByAgent = new Map<string, number>();
  for (const call of activeCalls) {
    if (!call.assignedToId) continue;
    activeCallIdsByAgent.set(call.assignedToId, (activeCallIdsByAgent.get(call.assignedToId) ?? 0) + 1);
  }
  for (const call of waitingCalls) {
    if (!call.assignedToId) continue;
    waitingCallIdsByAgent.set(call.assignedToId, (waitingCallIdsByAgent.get(call.assignedToId) ?? 0) + 1);
  }

  const agentIds = voiceAgentsRaw.map((agent) => agent.id);
  const todayAssignedInboundCalls = agentIds.length
    ? await prisma.voiceCall.findMany({
        where: {
          ...callWhere,
          assignedToId: { in: agentIds },
          direction: "INBOUND",
          createdAt: { gte: todayStart },
        },
        select: {
          assignedToId: true,
          status: true,
        },
      })
    : [];

  const agentTodayMetrics = todayAssignedInboundCalls.reduce<
    Map<
      string,
      {
        receivedCallsToday: number;
        answeredCallsToday: number;
        missedCallsToday: number;
        attemptedCallsToday: number;
      }
    >
  >((accumulator, call) => {
    if (!call.assignedToId) return accumulator;
    const current = accumulator.get(call.assignedToId) ?? {
      receivedCallsToday: 0,
      answeredCallsToday: 0,
      missedCallsToday: 0,
      attemptedCallsToday: 0,
    };

    current.receivedCallsToday += 1;
    if (isAnsweredStatus(call.status)) current.answeredCallsToday += 1;
    if (isMissedStatus(call.status)) current.missedCallsToday += 1;
    if (isAttemptedCallStatus(call.status)) current.attemptedCallsToday += 1;

    accumulator.set(call.assignedToId, current);
    return accumulator;
  }, new Map());

  const agents = voiceAgentsRaw
    .map((agent) =>
      serializePresenceRow(
        agent,
        activeCallIdsByAgent.get(agent.id) ?? 0,
        waitingCallIdsByAgent.get(agent.id) ?? 0,
        agentTodayMetrics.get(agent.id),
      ),
    )
    .filter((agent) => (viewer.isAdmin ? agent.isRoutingAgent : true))
    .sort((left, right) => left.routingPriority - right.routingPriority || left.displayName.localeCompare(right.displayName));

  const activeCallsCount = activeCalls.filter((call) => isLiveActiveStatus(call.status)).length;
  const waitingCallsCount = waitingCalls.filter((call) => isWaitingStatus(call.status)).length;
  const answeredCallsCount = recentCalls.filter((call) => isAnsweredStatus(call.status)).length;
  const missedCallsCount =
    recentCalls.filter((call) => isMissedStatus(call.status)).length +
    followUps.filter((task) => normalizeStatus(task.status) === "pending").length +
    missedLeads.filter((lead) => ["pending_follow_up", "open"].includes(normalizeStatus(lead.status))).length;
  const longestWaitingSeconds = waitingCalls.reduce((max, call) => Math.max(max, call.waitingSeconds || 0), 0);
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
    waitingCalls,
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
              testNumberLabel: getVoiceTestNumberLabel(selectedCallDetail.callerNumber),
              isTestNumber: isVoiceAdminTestPhone(selectedCallDetail.callerNumber),
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
          sla: getVoiceSlaBreakdown(selectedCallDetail),
          hopAudit: buildHopAudit(selectedCallDetail.events),
          disposition:
            selectedCallDetail.callNotes
              .map((note) => extractDisposition(note.note))
              .find(Boolean) ?? null,
          timeline: [
            ...selectedCallDetail.events.map((event) =>
              formatVoiceTimelineEvent({
                event,
                finalStatus: selectedCallDetail.status,
              }),
            ),
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
  if (isVoiceAdminTestPhone(phone)) throw new Error("voice_test_number_follow_up_blocked");
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
