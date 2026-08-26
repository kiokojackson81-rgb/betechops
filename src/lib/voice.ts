import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getKenyanPhoneVariants, normalizeKenyanPhone } from "@/lib/phone";
import { resolveVoiceCustomerLinkByPhone } from "@/lib/voiceCustomerContext";
import { publishVoiceLiveEvent } from "@/lib/voiceLiveEvents";
import { buildVoiceWebrtcIdentity } from "@/lib/voiceOperations";
import { toSpeechText } from "@/lib/voiceSpeech";
import { isVoiceWebrtcClientReady } from "@/lib/voiceWebrtc/registry";
import { maybeSendCallFeedbackSms } from "@/lib/feedbackSms";
import { generateFeedbackToken } from "@/lib/feedbackToken";
import { getShopBaseUrl } from "@/lib/runtimeUrls";
import {
  isInternalVoicePhone,
  maybeSendMissedCallSms,
  sendVoiceSmsOncePerDay,
} from "@/lib/voiceSmsNotifications";
import {
  getVoiceAdminTestNumber,
  isVoiceAdminTestPhone,
} from "@/lib/voiceTestNumbers";

const NAIROBI_TIMEZONE = "Africa/Nairobi";
const ATTEMPTED_CALL_THRESHOLD_SECONDS = 14;
const CALLBACK_REQUEST_TOKEN_EXPIRY_DAYS = 14;

type VoicePayload = Record<string, string>;
type VoiceRouteLabel =
  | "BRENDAH"
  | "JENNIFER"
  | "ADMIN"
  | "OVERFLOW"
  | "QUOTATION_OWNER";

export type VoiceRouteTarget = {
  label: VoiceRouteLabel;
  phoneNumber: string;
  userId: string | null;
  presenceStatus: string;
  isAvailable: boolean;
  routingEnabled: boolean;
  allowAfterHoursCalls: boolean;
  lastSeenAt: Date | null;
  webRtcIdentity: string | null;
  isWebrtcRegistered: boolean;
  dialValue: string;
  dialValues: string[];
  skipReasons: string[];
};

const VOICE_PRESENCE_ROUTING_WINDOW_MS = 90 * 1000;
const DEFAULT_VOICE_STICKY_OWNER_DAYS = 60;

function isRoutingBlockingVoiceStatus(status: string | null | undefined) {
  return [
    "queued",
    "ringing",
    "initiated",
    "dialing",
    "in_progress",
    "answered",
    "connected",
    "processing",
    "transferred",
  ].includes(safeString(status).toLowerCase());
}

function isVoiceWebrtcEnabled() {
  return (
    String(process.env.NEXT_PUBLIC_VOICE_WEBRTC_ENABLED || "")
      .trim()
      .toLowerCase() === "true"
  );
}

function getDefaultWebrtcClientName(label: VoiceRouteTarget["label"]) {
  if (label === "BRENDAH") return "brendah";
  if (label === "JENNIFER") return "jennifer";
  if (label === "OVERFLOW") return "overflow";
  return "jackson";
}

export function safeString(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : value == null
      ? ""
      : String(value).trim();
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
  if (
    ["completed", "ended", "terminated", "aborted", "failed"].includes(
      sessionState,
    )
  ) {
    return false;
  }

  const status = safeString(payload.status).toLowerCase();
  if (
    [
      "completed",
      "aborted",
      "failed",
      "busy",
      "no answer",
      "no_answer",
    ].includes(status)
  ) {
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
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
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

function getVoiceStickyOwnerCutoff(date: Date) {
  const configuredDays = Number.parseInt(
    String(process.env.BETECH_VOICE_STICKY_OWNER_DAYS || ""),
    10,
  );
  const stickyDays =
    Number.isFinite(configuredDays) && configuredDays > 0
      ? configuredDays
      : DEFAULT_VOICE_STICKY_OWNER_DAYS;
  return new Date(date.getTime() - stickyDays * 24 * 60 * 60 * 1000);
}

function getConfiguredPhone(label: "BRENDAH" | "JENNIFER" | "ADMIN") {
  const envKey =
    label === "BRENDAH"
      ? "BETECH_VOICE_BRENDAH_NUMBER"
      : label === "JENNIFER"
        ? "BETECH_VOICE_JENNIFER_NUMBER"
        : "BETECH_VOICE_ADMIN_NUMBER";
  const configured = normalizeVoiceNumber(process.env[envKey]);
  if (label === "ADMIN") return configured || getVoiceAdminTestNumber();
  return configured;
}

function normalizeCompareValue(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase();
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
        {
          phone: {
            in: [brendahPhone, jenniferPhone, adminPhone].filter(Boolean),
          },
        },
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

  const findUserId = (
    label: VoiceRouteTarget["label"],
    phoneNumber: string | null,
  ) => {
    const matched = users.find((user) => {
      const normalizedPhone = normalizeCompareValue(user.phone);
      const normalizedEmail = normalizeCompareValue(user.email);
      const normalizedName = normalizeCompareValue(user.name);
      if (phoneNumber && normalizedPhone === normalizeCompareValue(phoneNumber))
        return true;
      if (label === "BRENDAH") {
        return (
          normalizedEmail.includes("brendah") ||
          normalizedName.includes("brendah")
        );
      }
      if (label === "JENNIFER") {
        return (
          normalizedEmail.includes("jen") ||
          normalizedName.includes("jennifer") ||
          normalizedName.includes("jeniffer")
        );
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

async function buildVoiceTargets(): Promise<
  Record<Exclude<VoiceRouteTarget["label"], "QUOTATION_OWNER">, VoiceRouteTarget>
> {
  const brendahPhone = getConfiguredPhone("BRENDAH");
  const jenniferPhone = getConfiguredPhone("JENNIFER");
  const adminPhone = getConfiguredPhone("ADMIN");
  const routingUsers = await resolveRoutingUsers();
  const brendahUserId = routingUsers.BRENDAH;
  const jenniferUserId = routingUsers.JENNIFER;
  const adminUserId = routingUsers.ADMIN;

  const voiceRoutingConfig = await prisma.voiceRoutingConfig.findUnique({
    where: { key: "default" },
    include: {
      overflowUser: {
        select: {
          id: true,
          phone: true,
        },
      },
    },
  });
  const overflowPhone = normalizeVoiceNumber(
    voiceRoutingConfig?.overflowPhone ||
      voiceRoutingConfig?.overflowUser?.phone ||
      "",
  );
  const overflowPhoneUser =
    !voiceRoutingConfig?.overflowUserId && overflowPhone
      ? await prisma.user.findFirst({
          where: {
            isActive: true,
            phone: { in: getKenyanPhoneVariants(overflowPhone) },
          },
          select: { id: true },
        })
      : null;
  const overflowUserId =
    voiceRoutingConfig?.overflowUserId ?? overflowPhoneUser?.id ?? null;

  const userIds = [
    brendahUserId,
    jenniferUserId,
    adminUserId,
    overflowUserId,
  ].filter((value): value is string => Boolean(value));
  const [presences, routingPreferences]: [
    Array<{
      userId: string;
      status: string;
      lastSeenAt: Date;
      currentCallId: string | null;
    }>,
    Array<{
      userId: string;
      routingEnabled: boolean;
      allowAfterHoursCalls: boolean;
    }>,
  ] = await Promise.all([
    userIds.length
      ? prisma.voiceAgentPresence.findMany({
          where: { userId: { in: userIds } },
          select: {
            userId: true,
            status: true,
            lastSeenAt: true,
            currentCallId: true,
          },
        })
      : Promise.resolve([]),
    userIds.length
      ? prisma.voiceAgentRoutingPreference.findMany({
          where: { userId: { in: userIds } },
          select: {
            userId: true,
            routingEnabled: true,
            allowAfterHoursCalls: true,
          },
        })
      : Promise.resolve([]),
  ]);
  const presenceByUserId = new Map<string, (typeof presences)[number]>();
  for (const presence of presences) {
    presenceByUserId.set(presence.userId, presence);
  }
  const routingPreferenceByUserId = new Map<
    string,
    (typeof routingPreferences)[number]
  >();
  for (const preference of routingPreferences) {
    routingPreferenceByUserId.set(preference.userId, preference);
  }
  const activeCalls = userIds.length
    ? await prisma.voiceCall.findMany({
        where: {
          assignedToId: { in: userIds },
          OR: [
            { isActive: true },
            {
              status: {
                in: [
                  "queued",
                  "ringing",
                  "initiated",
                  "dialing",
                  "in_progress",
                  "answered",
                  "connected",
                  "processing",
                  "transferred",
                ],
              },
            },
          ],
        },
        select: {
          id: true,
          assignedToId: true,
          isActive: true,
          status: true,
        },
      })
    : [];
  const activeCallByUserId = new Map<string, string>();
  for (const call of activeCalls) {
    if (!call.assignedToId) continue;
    if (!call.isActive && !isRoutingBlockingVoiceStatus(call.status)) continue;
    if (!activeCallByUserId.has(call.assignedToId)) {
      activeCallByUserId.set(call.assignedToId, call.id);
    }
  }
  const now = Date.now();

  const toTarget = (
    label: VoiceRouteTarget["label"],
    phoneNumber: string,
    userId: string | null,
    options?: { alwaysDial?: boolean; defaultAllowAfterHoursCalls?: boolean },
  ): VoiceRouteTarget => {
    const presence = userId ? presenceByUserId.get(userId) : null;
    const routingPreference = userId
      ? routingPreferenceByUserId.get(userId)
      : null;
    const webRtcRegistration = userId ? isVoiceWebrtcClientReady(userId) : null;
    const presenceStatus =
      safeString(presence?.status).toUpperCase() || "OFFLINE";
    const lastSeenAt = presence?.lastSeenAt ?? null;
    const currentCallId = safeString(presence?.currentCallId);
    const assignedActiveCallId = userId
      ? (activeCallByUserId.get(userId) ?? null)
      : null;
    const hasBusyCall = Boolean(currentCallId || assignedActiveCallId);
    const routingEnabled = routingPreference?.routingEnabled ?? true;
    const allowAfterHoursCalls =
      routingPreference?.allowAfterHoursCalls ??
      Boolean(options?.defaultAllowAfterHoursCalls);
    const skipReasons: string[] = [];
    if (!phoneNumber) skipReasons.push("missing_mobile_fallback");
    if (!routingEnabled) skipReasons.push("routing_disabled");
    if (!userId && label !== "OVERFLOW")
      skipReasons.push("missing_routing_user");
    if (!options?.alwaysDial) {
      if (!presence) {
        skipReasons.push("missing_presence");
      } else {
        if (presenceStatus !== "AVAILABLE") {
          skipReasons.push(`status_${presenceStatus.toLowerCase()}`);
        }
        if (
          lastSeenAt &&
          now - lastSeenAt.getTime() > VOICE_PRESENCE_ROUTING_WINDOW_MS
        ) {
          skipReasons.push("stale_presence");
        }
        if (!lastSeenAt) {
          skipReasons.push("missing_last_seen");
        }
      }
      if (hasBusyCall) {
        skipReasons.push("active_call_in_progress");
      }
    }
    const isAvailable =
      routingEnabled &&
      Boolean(phoneNumber) &&
      (options?.alwaysDial
        ? true
        : presenceStatus === "AVAILABLE" &&
          Boolean(lastSeenAt) &&
          now - (lastSeenAt?.getTime() ?? 0) <=
            VOICE_PRESENCE_ROUTING_WINDOW_MS &&
          !hasBusyCall);
    const webRtcIdentity =
      webRtcRegistration?.identity ??
      buildVoiceWebrtcIdentity(getDefaultWebrtcClientName(label)) ??
      null;
    if (isVoiceWebrtcEnabled() && !options?.alwaysDial) {
      if (!webRtcRegistration?.identity)
        skipReasons.push("missing_browser_identity");
      if (!webRtcRegistration) skipReasons.push("browser_not_registered");
    }
    const dialValues = [phoneNumber].filter(Boolean);

    const target = {
      label,
      phoneNumber,
      userId,
      presenceStatus,
      isAvailable,
      routingEnabled,
      allowAfterHoursCalls,
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
      currentCallId: currentCallId || assignedActiveCallId,
      isAvailable,
      routingEnabled,
      allowAfterHoursCalls,
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
    OVERFLOW: toTarget("OVERFLOW", overflowPhone, overflowUserId, {
      alwaysDial: true,
      defaultAllowAfterHoursCalls: true,
    }),
  };
}

type VoiceRouteSelection = {
  preferredTarget: VoiceRouteTarget | null;
  orderedTargets: VoiceRouteTarget[];
  routeReason:
    | "after_hours"
    | "quotation_owner"
    | "returning_customer"
    | "round_robin"
    | "admin_only"
    | "assigned_owner";
};

type QuotationOwnerRow = {
  ownerId: string | null;
  quoteRef: string;
};

async function buildQuotationOwnerVoiceTarget(
  ownerId: string,
): Promise<VoiceRouteTarget | null> {
  const [user, presence, routingPreference, activeCall] = await Promise.all([
    prisma.user.findFirst({
      where: { id: ownerId, isActive: true },
      select: { phone: true },
    }),
    prisma.voiceAgentPresence.findUnique({ where: { userId: ownerId } }),
    prisma.voiceAgentRoutingPreference.findUnique({ where: { userId: ownerId } }),
    prisma.voiceCall.findFirst({
      where: {
        assignedToId: ownerId,
        OR: [
          { isActive: true },
          {
            status: {
              in: [
                "queued",
                "ringing",
                "initiated",
                "dialing",
                "in_progress",
                "answered",
                "connected",
                "processing",
                "transferred",
              ],
            },
          },
        ],
      },
      select: { id: true, isActive: true, status: true },
    }),
  ]);
  const phoneNumber = normalizeVoiceNumber(user?.phone || "");
  const routingEnabled = routingPreference?.routingEnabled ?? true;
  if (!phoneNumber || !routingEnabled) return null;

  const presenceStatus = safeString(presence?.status).toUpperCase() || "OFFLINE";
  const lastSeenAt = presence?.lastSeenAt ?? null;
  const hasBusyCall = Boolean(
    presence?.currentCallId ||
      (activeCall &&
        (activeCall.isActive || isRoutingBlockingVoiceStatus(activeCall.status))),
  );
  const hasRecentPresence = Boolean(
    lastSeenAt &&
      Date.now() - lastSeenAt.getTime() <= VOICE_PRESENCE_ROUTING_WINDOW_MS,
  );
  const isAvailable =
    presenceStatus === "AVAILABLE" && hasRecentPresence && !hasBusyCall;
  const skipReasons: string[] = [];
  if (!presence) skipReasons.push("missing_presence");
  if (presenceStatus !== "AVAILABLE") {
    skipReasons.push(`status_${presenceStatus.toLowerCase()}`);
  }
  if (!hasRecentPresence) skipReasons.push("stale_or_missing_presence");
  if (hasBusyCall) skipReasons.push("active_call_in_progress");

  return {
    label: "QUOTATION_OWNER",
    phoneNumber,
    userId: ownerId,
    presenceStatus,
    isAvailable,
    routingEnabled,
    allowAfterHoursCalls: routingPreference?.allowAfterHoursCalls ?? false,
    lastSeenAt,
    webRtcIdentity: null,
    isWebrtcRegistered: false,
    dialValue: phoneNumber,
    dialValues: [phoneNumber],
    skipReasons,
  };
}

async function findQuotationOwnerTarget(
  callerNumber: string | null,
  targets: VoiceRouteTarget[],
): Promise<VoiceRouteTarget | null> {
  if (!callerNumber) return null;
  const phoneVariants = getKenyanPhoneVariants(callerNumber);
  if (!phoneVariants.length) return null;
  const phoneDigitVariants = phoneVariants
    .map((phone) => phone.replace(/\D/g, ""))
    .filter(Boolean);

  try {
    const rows = await prisma.$queryRaw<QuotationOwnerRow[]>(Prisma.sql`
      SELECT
        COALESCE(
          "respondedById",
          NULLIF("responseMetadata"->>'createdById', ''),
          "assignedAttendantId"
        ) AS "ownerId",
        "quoteRef"
      FROM "QuoteRequest"
      WHERE (
        "customerPhone" IN (${Prisma.join(phoneVariants)})
        OR "manualCustomerPhone" IN (${Prisma.join(phoneVariants)})
        OR REGEXP_REPLACE(COALESCE("customerPhone", ''), '[^0-9]', '', 'g')
          IN (${Prisma.join(phoneDigitVariants)})
        OR REGEXP_REPLACE(COALESCE("manualCustomerPhone", ''), '[^0-9]', '', 'g')
          IN (${Prisma.join(phoneDigitVariants)})
      )
        AND UPPER(COALESCE("status", '')) NOT IN ('CLOSED', 'REJECTED', 'EXPIRED')
      ORDER BY COALESCE("respondedAt", "updatedAt", "createdAt") DESC
      LIMIT 1
    `);
    const owner = rows[0];
    if (!owner?.ownerId) return null;

    const target =
      targets.find((candidate) => candidate.userId === owner.ownerId) ??
      (await buildQuotationOwnerVoiceTarget(owner.ownerId));
    if (target) {
      console.info("[voice.routing.quotation_owner]", {
        callerNumber,
        quoteRef: owner.quoteRef,
        ownerId: owner.ownerId,
        target: target.label,
      });
    }
    return target;
  } catch (error) {
    // Quotation routing must fail open so inbound calls still use normal routing.
    console.warn("[voice.routing.quotation_owner_unavailable]", {
      callerNumber,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function findAssignedLeadTarget(
  callerNumber: string | null,
  agentTargets: VoiceRouteTarget[],
): Promise<VoiceRouteTarget | null> {
  if (!callerNumber) return null;
  const phoneVariants = getKenyanPhoneVariants(callerNumber);
  if (!phoneVariants.length) return null;

  const agentUserIds = agentTargets
    .map((target) => target.userId)
    .filter((value): value is string => Boolean(value));
  if (!agentUserIds.length) return null;

  const assignedLead = await prisma.voiceLead.findFirst({
    where: {
      phone: { in: phoneVariants },
      assignedToId: { in: agentUserIds },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      assignedToId: true,
    },
  });

  if (!assignedLead?.assignedToId) return null;
  return (
    agentTargets.find(
      (target) => target.userId === assignedLead.assignedToId,
    ) ?? null
  );
}

async function findAssignedFollowUpTarget(
  callerNumber: string | null,
  agentTargets: VoiceRouteTarget[],
): Promise<VoiceRouteTarget | null> {
  if (!callerNumber) return null;
  const phoneVariants = getKenyanPhoneVariants(callerNumber);
  if (!phoneVariants.length) return null;

  const agentUserIds = agentTargets
    .map((target) => target.userId)
    .filter((value): value is string => Boolean(value));
  if (!agentUserIds.length) return null;

  const followUp = await prisma.voiceFollowUp.findFirst({
    where: {
      phone: { in: phoneVariants },
      assignedToId: { in: agentUserIds },
      status: { in: ["pending", "contacted", "open", "pending_follow_up"] },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      assignedToId: true,
    },
  });

  if (!followUp?.assignedToId) return null;
  return (
    agentTargets.find((target) => target.userId === followUp.assignedToId) ??
    null
  );
}

async function findStickyOwnerTarget(
  callerNumber: string | null,
  agentTargets: VoiceRouteTarget[],
): Promise<VoiceRouteTarget | null> {
  if (!callerNumber) return null;
  const phoneVariants = getKenyanPhoneVariants(callerNumber);
  if (!phoneVariants.length) return null;

  const agentUserIds = agentTargets
    .map((target) => target.userId)
    .filter((value): value is string => Boolean(value));
  if (!agentUserIds.length) return null;

  const [followUp, lead, lastCall] = await Promise.all([
    prisma.voiceFollowUp.findFirst({
      where: {
        phone: { in: phoneVariants },
        assignedToId: { in: agentUserIds },
        status: { in: ["pending", "contacted", "open", "pending_follow_up"] },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: { assignedToId: true, updatedAt: true, createdAt: true },
    }),
    prisma.voiceLead.findFirst({
      where: {
        phone: { in: phoneVariants },
        assignedToId: { in: agentUserIds },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: { assignedToId: true, updatedAt: true, createdAt: true },
    }),
    prisma.voiceCall.findFirst({
      where: {
        direction: "INBOUND",
        callerNumber: { in: phoneVariants },
        assignedToId: { in: agentUserIds },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: { assignedToId: true, updatedAt: true, createdAt: true },
    }),
  ]);

  const freshest = [followUp, lead, lastCall]
    .filter(
      (
        item,
      ): item is {
        assignedToId: string | null;
        updatedAt: Date;
        createdAt: Date;
      } => Boolean(item?.assignedToId),
    )
    .sort((left, right) => {
      const rightTime =
        right.updatedAt?.getTime?.() ?? right.createdAt.getTime();
      const leftTime = left.updatedAt?.getTime?.() ?? left.createdAt.getTime();
      return rightTime - leftTime;
    })[0];

  if (!freshest?.assignedToId) return null;
  return (
    agentTargets.find((target) => target.userId === freshest.assignedToId) ??
    null
  );
}

async function findPreviousAgentTarget(
  callerNumber: string | null,
  agentTargets: VoiceRouteTarget[],
): Promise<VoiceRouteTarget | null> {
  if (!callerNumber) return null;
  const phoneVariants = getKenyanPhoneVariants(callerNumber);
  if (!phoneVariants.length) return null;

  const agentUserIds = agentTargets
    .map((target) => target.userId)
    .filter((value): value is string => Boolean(value));
  if (!agentUserIds.length) return null;

  const lastCall = await prisma.voiceCall.findFirst({
    where: {
      direction: "INBOUND",
      callerNumber: { in: phoneVariants },
      assignedToId: { in: agentUserIds },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      assignedToId: true,
    },
  });

  if (!lastCall?.assignedToId) return null;
  return (
    agentTargets.find((target) => target.userId === lastCall.assignedToId) ??
    null
  );
}

async function findLastAnsweredTarget(
  callerNumber: string | null,
  targets: VoiceRouteTarget[],
  date: Date,
): Promise<VoiceRouteTarget | null> {
  if (!callerNumber) return null;
  const phoneVariants = getKenyanPhoneVariants(callerNumber);
  if (!phoneVariants.length || !targets.length) return null;

  const lastAnsweredCall = await prisma.voiceCall.findFirst({
    where: {
      direction: "INBOUND",
      callerNumber: { in: phoneVariants },
      answeredAt: { gte: getVoiceStickyOwnerCutoff(date) },
      answeredNumber: { not: null },
    },
    orderBy: [{ answeredAt: "desc" }, { createdAt: "desc" }],
    select: {
      answeredById: true,
      answeredNumber: true,
    },
  });
  if (!lastAnsweredCall?.answeredNumber) return null;

  const normalizedAnsweredNumber = normalizeVoiceNumber(
    lastAnsweredCall.answeredNumber,
  );
  return (
    targets.find((target) =>
      target.dialValues.some(
        (dialValue) =>
          normalizeVoiceNumber(dialValue) === normalizedAnsweredNumber,
      ),
    ) ??
    targets.find(
      (target) =>
        Boolean(lastAnsweredCall.answeredById) &&
        target.userId === lastAnsweredCall.answeredById,
    ) ??
    null
  );
}

async function findRoundRobinTarget(agentTargets: VoiceRouteTarget[]) {
  const agentUserIds = agentTargets
    .map((target) => target.userId)
    .filter((value): value is string => Boolean(value));
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
  const lastIndex = agentTargets.findIndex(
    (target) => target.userId === lastAssignedCall.assignedToId,
  );
  if (lastIndex < 0) return agentTargets[0] ?? null;
  return (
    agentTargets[(lastIndex + 1) % agentTargets.length] ??
    agentTargets[0] ??
    null
  );
}

function buildWorkingHoursSelection(input: {
  preferredTarget: VoiceRouteTarget | null;
  agentTargets: VoiceRouteTarget[];
  adminTarget: VoiceRouteTarget;
  routeReason: VoiceRouteSelection["routeReason"];
  preferAdminFirst?: boolean;
}): VoiceRouteSelection {
  const alternateTargets = input.agentTargets.filter(
    (target) =>
      target.userId && target.userId !== input.preferredTarget?.userId,
  );
  const orderedTargets = (
    input.preferAdminFirst
      ? [
          ...(input.adminTarget.phoneNumber && input.adminTarget.routingEnabled
            ? [input.adminTarget]
            : []),
          ...(input.preferredTarget?.phoneNumber
            ? [input.preferredTarget]
            : []),
          ...alternateTargets.filter((target) => Boolean(target.phoneNumber)),
        ]
      : [
          ...(input.preferredTarget?.phoneNumber
            ? [input.preferredTarget]
            : []),
          ...alternateTargets.filter((target) => Boolean(target.phoneNumber)),
          ...(input.adminTarget.phoneNumber && input.adminTarget.routingEnabled
            ? [input.adminTarget]
            : []),
        ]
  ).filter(
    (target, index, array) =>
      array.findIndex((candidate) => candidate.label === target.label) ===
      index,
  );

  return {
    preferredTarget: input.preferredTarget,
    orderedTargets,
    routeReason: input.routeReason,
  };
}

export function buildStickyVoiceTargetOrder(input: {
  stickyTarget: VoiceRouteTarget;
  roundRobinTarget: VoiceRouteTarget | null;
  agentTargets: VoiceRouteTarget[];
  adminTarget: VoiceRouteTarget;
}) {
  const roundRobinIndex = input.roundRobinTarget
    ? input.agentTargets.findIndex(
        (target) => target.label === input.roundRobinTarget?.label,
      )
    : -1;
  const rotatedAgents =
    roundRobinIndex > 0
      ? [
          ...input.agentTargets.slice(roundRobinIndex),
          ...input.agentTargets.slice(0, roundRobinIndex),
        ]
      : input.agentTargets;
  const seenNumbers = new Set<string>();

  return [input.stickyTarget, ...rotatedAgents, input.adminTarget].filter(
    (target) => {
      const normalizedNumber = normalizeVoiceNumber(target.phoneNumber);
      if (!normalizedNumber || !target.routingEnabled) return false;
      if (seenNumbers.has(normalizedNumber)) return false;
      seenNumbers.add(normalizedNumber);
      return true;
    },
  );
}

export async function getVoiceRouteTargets(
  input?: Date | { date?: Date; callerNumber?: string | null },
) {
  const date = input instanceof Date ? input : (input?.date ?? new Date());
  const callerNumber = normalizeVoiceNumber(
    input instanceof Date ? "" : input?.callerNumber || "",
  );
  const targets = await buildVoiceTargets();
  const allConfiguredTargets = [
    targets.BRENDAH,
    targets.JENNIFER,
    targets.ADMIN,
    targets.OVERFLOW,
  ].filter((target) => target.phoneNumber);
  const agentTargets = [targets.BRENDAH, targets.JENNIFER].filter(
    (target) => target.phoneNumber && target.routingEnabled,
  );
  const adminTarget = targets.ADMIN;
  const overflowTarget = targets.OVERFLOW;
  const quotationOwnerTargets = [
    targets.BRENDAH,
    targets.JENNIFER,
    targets.ADMIN,
  ].filter((target) => target.phoneNumber && target.routingEnabled);
  const directFallbackTargets = [adminTarget, overflowTarget].filter(
    (target) => target.phoneNumber && target.routingEnabled,
  );

  if (isVoiceAdminTestPhone(callerNumber) && adminTarget.phoneNumber) {
    return {
      routeType: "DIRECT_FALLBACK",
      orderedTargets: [adminTarget],
      primaryTarget: adminTarget,
      availableTargets: adminTarget.isAvailable ? [adminTarget] : [],
      unavailableTargets: allConfiguredTargets.filter(
        (target) => target.label !== "ADMIN",
      ),
      hasAvailableTarget: adminTarget.isAvailable,
      hasRoutableTarget: true,
      usedMobileFallback: false,
      routeReason: "admin_only" as const,
    };
  }

  if (!isWithinVoiceWorkingHours(date)) {
    const afterHoursTargets = [
      adminTarget,
      targets.BRENDAH,
      targets.JENNIFER,
      overflowTarget,
    ].filter(
      (target) =>
        target.phoneNumber &&
        target.routingEnabled &&
        (target.label === "ADMIN" ||
          target.label === "OVERFLOW" ||
          target.allowAfterHoursCalls),
    );
    const orderedTargets = afterHoursTargets;
    return {
      routeType: "AFTER_HOURS",
      orderedTargets,
      primaryTarget: orderedTargets[0] ?? null,
      availableTargets: orderedTargets.filter((target) => target.isAvailable),
      unavailableTargets: allConfiguredTargets.filter(
        (target) => !orderedTargets.includes(target),
      ),
      hasAvailableTarget: orderedTargets.some((target) => target.isAvailable),
      hasRoutableTarget: orderedTargets.length > 0,
      usedMobileFallback: orderedTargets.some(
        (target) => target.label === "OVERFLOW",
      ),
      routeReason: "after_hours" as const,
    };
  }

  const [
    quotationOwnerTarget,
    assignedFollowUpTarget,
    assignedLeadTarget,
    previousAgentTarget,
    stickyOwnerTarget,
    lastAnsweredTarget,
  ] = await Promise.all([
    findQuotationOwnerTarget(callerNumber, quotationOwnerTargets),
    findAssignedFollowUpTarget(callerNumber, agentTargets),
    findAssignedLeadTarget(callerNumber, agentTargets),
    findPreviousAgentTarget(callerNumber, agentTargets),
    findStickyOwnerTarget(callerNumber, agentTargets),
    findLastAnsweredTarget(
      callerNumber,
      [targets.BRENDAH, targets.JENNIFER, targets.ADMIN, targets.OVERFLOW].filter(
        (target) => target.phoneNumber && target.routingEnabled,
      ),
      date,
    ),
  ]);
  const stickyTarget =
    quotationOwnerTarget ??
    lastAnsweredTarget ??
    stickyOwnerTarget ??
    assignedFollowUpTarget ??
    assignedLeadTarget ??
    previousAgentTarget;

  if (!stickyTarget && !agentTargets.length && directFallbackTargets.length) {
    console.info("[voice.routing.direct_fallback]", {
      callerNumber,
      date: date.toISOString(),
      reason: "no_agent_targets_configured",
      orderedTargets: directFallbackTargets.map((target) => ({
        label: target.label,
        phoneNumber: target.phoneNumber,
        userId: target.userId,
        presenceStatus: target.presenceStatus,
        isAvailable: target.isAvailable,
        dialValues: target.dialValues,
      })),
    });

    return {
      routeType: "DIRECT_FALLBACK",
      orderedTargets: directFallbackTargets,
      primaryTarget: directFallbackTargets[0] ?? null,
      availableTargets: directFallbackTargets.filter(
        (target) => target.isAvailable,
      ),
      unavailableTargets: allConfiguredTargets.filter(
        (target) => !directFallbackTargets.includes(target),
      ),
      hasAvailableTarget: directFallbackTargets.some(
        (target) => target.isAvailable,
      ),
      hasRoutableTarget: true,
      usedMobileFallback: false,
      routeReason: "admin_only" as const,
    };
  }

  const roundRobinTarget = await findRoundRobinTarget(agentTargets);
  const selection = stickyTarget
    ? {
        preferredTarget: stickyTarget,
        orderedTargets: buildStickyVoiceTargetOrder({
          stickyTarget,
          roundRobinTarget,
          agentTargets,
          adminTarget,
        }),
        routeReason: quotationOwnerTarget
          ? ("quotation_owner" as const)
          : lastAnsweredTarget
            ? ("assigned_owner" as const)
            : stickyOwnerTarget
              ? ("assigned_owner" as const)
              : ("returning_customer" as const),
      }
    : buildWorkingHoursSelection({
        preferredTarget: roundRobinTarget,
        agentTargets,
        adminTarget,
        routeReason: "round_robin",
        preferAdminFirst: false,
      });

  const workingTargets = [
    targets.BRENDAH,
    targets.JENNIFER,
    targets.ADMIN,
    ...(quotationOwnerTarget &&
    ![targets.BRENDAH, targets.JENNIFER, targets.ADMIN].some(
      (target) => target.userId === quotationOwnerTarget.userId,
    )
      ? [quotationOwnerTarget]
      : []),
  ];
  const orderedTargets = selection.orderedTargets.length
    ? selection.orderedTargets
    : directFallbackTargets;
  const availableTargets = workingTargets.filter(
    (target) => target.phoneNumber && target.isAvailable,
  );
  const hasRoutableTarget = orderedTargets.length > 0;
  const primaryTarget = selection.preferredTarget?.userId
    ? selection.preferredTarget
    : (orderedTargets[0] ?? null);

  if (!availableTargets.length || orderedTargets[0]?.label === "ADMIN") {
    console.warn("[voice.routing.fallback]", {
      routeType: "WORKING_HOURS",
      reason: selection.routeReason,
      callerNumber,
      quotationOwnerTarget: quotationOwnerTarget?.label ?? null,
      assignedFollowUpTarget: assignedFollowUpTarget?.label ?? null,
      assignedLeadTarget: assignedLeadTarget?.label ?? null,
      stickyOwnerTarget: stickyOwnerTarget?.label ?? null,
      lastAnsweredTarget: lastAnsweredTarget?.label ?? null,
      previousAgent: previousAgentTarget?.label ?? null,
      preferAdminFirst: false,
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
    unavailableTargets: workingTargets.filter(
      (target) => target.phoneNumber && !target.isAvailable,
    ),
    hasAvailableTarget: availableTargets.length > 0,
    hasRoutableTarget,
    usedMobileFallback: Boolean(
      orderedTargets.find(
        (target) => target.label === "ADMIN" || target.label === "OVERFLOW",
      ),
    ),
    routeReason: selection.routeReason,
  };
}

async function resolveAnsweredAgentAssignment(
  destinationNumber: string | null,
) {
  const normalizedDestination = normalizeVoiceNumber(destinationNumber || "");
  if (!normalizedDestination) return null;

  const routingUsers = await resolveRoutingUsers();
  const brendahPhone = getConfiguredPhone("BRENDAH");
  const jenniferPhone = getConfiguredPhone("JENNIFER");

  if (normalizedDestination === brendahPhone && routingUsers.BRENDAH)
    return routingUsers.BRENDAH;
  if (normalizedDestination === jenniferPhone && routingUsers.JENNIFER)
    return routingUsers.JENNIFER;
  return null;
}

export function buildVoiceXmlResponse(input: {
  phoneNumbers: string[];
  preDialMessage?: string | null;
}) {
  const phoneNumbers = input.phoneNumbers.filter(Boolean).join(",");
  const sayPart = input.preDialMessage
    ? `<Say>${escapeXml(toSpeechText(input.preDialMessage))}</Say>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${sayPart}<Dial record="true" sequential="true" phoneNumbers="${escapeXml(phoneNumbers)}" /></Response>`;
}

export function buildEmptyVoiceXmlResponse() {
  return `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
}

export function buildVoiceMessageXmlResponse(message: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${escapeXml(toSpeechText(message))}</Say></Response>`;
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
  const contentType = safeString(
    request.headers.get("content-type"),
  ).toLowerCase();

  if (contentType.includes("application/json")) {
    const json = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
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
    treatInboundSuccessWithoutBridgeAsNoAnswer?: boolean;
  },
) {
  const hangupCause = safeString(
    payload.lastBridgeHangupCause ||
      payload.bridgeHangupCause ||
      payload.hangupCause,
  ).toUpperCase();
  if (hangupCause === "USER_BUSY" || hangupCause === "BUSY") return "busy";
  if (hangupCause === "NO_ANSWER" || hangupCause === "NO ANSWER")
    return "no_answer";

  const normalizedStatus = safeString(payload.status).toLowerCase();
  const normalizedSessionState = safeString(
    payload.callSessionState,
  ).toLowerCase();
  const duration =
    parseInteger(payload.durationInSeconds || payload.duration) ?? 0;
  const direction =
    safeString(payload.direction || "INBOUND").toUpperCase() || "INBOUND";
  const treatZeroDurationSuccessAsNoAnswer =
    options?.treatZeroDurationSuccessAsNoAnswer !== false;
  const treatInboundSuccessWithoutBridgeAsNoAnswer =
    options?.treatInboundSuccessWithoutBridgeAsNoAnswer === true;
  const isProviderTerminalSuccess =
    ["success", "successful", "completed", "complete"].includes(
      normalizedStatus,
    ) || ["completed", "complete"].includes(normalizedSessionState);
  const bridgeStatus = safeString(
    payload.dialCallStatus ||
      payload.lastBridgeDialStatus ||
      payload.bridgeStatus ||
      payload.lastBridgeStatus ||
      payload.bridgeCallStatus,
  ).toLowerCase();
  const bridgeDuration =
    parseInteger(
      payload.bridgeDurationInSeconds ||
        payload.lastBridgeDurationInSeconds ||
        payload.talkDurationInSeconds ||
        payload.conversationDurationInSeconds,
    ) ?? 0;
  const dialDuration =
    parseInteger(
      payload.dialDurationInSeconds ||
        payload.dialDuration ||
        payload.dialCallDurationInSeconds,
    ) ?? 0;
  const hasBridgeEvidence =
    bridgeDuration > 0 ||
    dialDuration > 0 ||
    Boolean(safeString(payload.recordingUrl)) ||
    Boolean(
      safeString(
        payload.dialDestinationNumber || payload.lastDialDestinationNumber,
      ),
    ) ||
    [
      "answered",
      "connected",
      "completed",
      "complete",
      "success",
      "successful",
      "transferred",
      "bridged",
    ].includes(bridgeStatus) ||
    Boolean(
      hangupCause &&
      !["USER_BUSY", "BUSY", "NO_ANSWER", "NO ANSWER"].includes(hangupCause),
    );

  if (["connected", "in_progress", "transferred"].includes(normalizedStatus)) {
    return normalizedStatus;
  }
  if (normalizedStatus === "answered") {
    if (
      direction === "INBOUND" &&
      duration > 0 &&
      treatInboundSuccessWithoutBridgeAsNoAnswer &&
      !hasBridgeEvidence
    ) {
      return duration < ATTEMPTED_CALL_THRESHOLD_SECONDS
        ? "attempted_call"
        : "no_answer";
    }
    return normalizedStatus;
  }

  if (
    isProviderTerminalSuccess &&
    treatZeroDurationSuccessAsNoAnswer &&
    duration <= 0
  ) {
    return "no_answer";
  }

  if (isProviderTerminalSuccess && direction === "INBOUND" && duration > 0) {
    if (treatInboundSuccessWithoutBridgeAsNoAnswer && !hasBridgeEvidence) {
      return duration < ATTEMPTED_CALL_THRESHOLD_SECONDS
        ? "attempted_call"
        : "no_answer";
    }
    return "answered";
  }

  return normalizeVoiceStatus(payload);
}

export function hasAnsweredVoiceBridge(
  payload: VoicePayload,
  inferredStatus = inferVoiceCompletionStatus(payload, {
    treatZeroDurationSuccessAsNoAnswer: true,
    treatInboundSuccessWithoutBridgeAsNoAnswer: true,
  }),
) {
  if (!isAnsweredBusinessStatus(inferredStatus)) return false;

  const bridgeStatus = safeString(
    payload.dialCallStatus ||
      payload.lastBridgeDialStatus ||
      payload.bridgeStatus ||
      payload.lastBridgeStatus ||
      payload.bridgeCallStatus,
  ).toLowerCase();
  const bridgeDuration =
    parseInteger(
      payload.bridgeDurationInSeconds ||
        payload.lastBridgeDurationInSeconds ||
        payload.talkDurationInSeconds ||
        payload.conversationDurationInSeconds,
    ) ?? 0;
  const dialDuration =
    parseInteger(
      payload.dialDurationInSeconds ||
        payload.dialDuration ||
        payload.dialCallDurationInSeconds,
    ) ?? 0;

  return (
    bridgeDuration > 0 ||
    dialDuration > 0 ||
    Boolean(safeString(payload.recordingUrl)) ||
    [
      "answered",
      "connected",
      "completed",
      "complete",
      "success",
      "successful",
      "transferred",
      "bridged",
    ].includes(bridgeStatus)
  );
}

function getInternalRoutingPhoneSet() {
  return new Set(
    [
      getConfiguredPhone("BRENDAH"),
      getConfiguredPhone("JENNIFER"),
      getConfiguredPhone("ADMIN"),
    ]
      .map((value) => normalizeVoiceNumber(value || ""))
      .filter(Boolean),
  );
}

function getCustomerContactPhones(call: {
  callerNumber?: string | null;
  destinationNumber?: string | null;
  routedTo?: string | null;
}) {
  const internalNumbers = getInternalRoutingPhoneSet();
  const values = [call.callerNumber, call.destinationNumber]
    .flatMap((value) => getKenyanPhoneVariants(value || ""))
    .filter((value) => Boolean(value) && !internalNumbers.has(value));

  return Array.from(new Set(values));
}

function isAttemptedCallStatus(status: string | null | undefined) {
  const normalized = safeString(status).toLowerCase();
  return normalized === "attempted_call" || normalized === "attempted call";
}

function isAnsweredBusinessStatus(status: string | null | undefined) {
  const normalized = safeString(status).toLowerCase();
  return [
    "answered",
    "connected",
    "completed",
    "complete",
    "successful",
    "success",
    "transferred",
  ].includes(normalized);
}

function getVoiceCallbackRequestPublicUrl(token: string) {
  return `${getShopBaseUrl()}/call/${encodeURIComponent(token)}`;
}

function getVoiceCallbackRequestExpiryDate(now = new Date()) {
  const expires = new Date(now);
  expires.setDate(expires.getDate() + CALLBACK_REQUEST_TOKEN_EXPIRY_DAYS);
  return expires;
}

async function createUniqueVoiceCallbackRequestToken(
  tx: Prisma.TransactionClient | typeof prisma,
) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const token = generateFeedbackToken(attempt >= 4 ? 6 : 5);
    const existing = await tx.voiceCallbackRequest.findUnique({
      where: { token },
      select: { id: true },
    });
    if (!existing) return token;
  }
  throw new Error("voice_callback_request_token_generation_failed");
}

async function resolveVoiceCallbackOwnerIdForPhone(
  phone: string,
  assignedToId?: string | null,
) {
  const routingUsers = await resolveRoutingUsers();
  const routingTargets = await buildVoiceTargets();
  const candidateTargets = [
    routingTargets.BRENDAH,
    routingTargets.JENNIFER,
  ].filter((target) => target.label !== "ADMIN" && target.userId);

  if (!candidateTargets.length) return null;
  if (assignedToId && assignedToId !== routingUsers.ADMIN) {
    return (
      candidateTargets.find((target) => target.userId === assignedToId)
        ?.userId ?? assignedToId
    );
  }

  const stickyTarget = await findStickyOwnerTarget(phone, candidateTargets);
  if (stickyTarget?.userId) return stickyTarget.userId;

  const roundRobinTarget = await findRoundRobinTarget(candidateTargets);
  return roundRobinTarget?.userId ?? null;
}

export function isVoiceCallbackRequestSchemaMissingError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2021") return false;
  return String(error.message || "").includes("VoiceCallbackRequest");
}

async function ensureVoiceCallbackRequestSession(input: {
  phoneNumber: string;
  voiceCallId?: string | null;
  agentId?: string | null;
  callStartedAt?: Date | null;
  callEndedAt?: Date | null;
}) {
  const normalizedPhone = normalizeVoiceNumber(input.phoneNumber);
  if (!normalizedPhone || isInternalVoicePhone(normalizedPhone)) return null;

  if (input.voiceCallId) {
    const existing = await prisma.voiceCallbackRequest.findFirst({
      where: { voiceCallId: input.voiceCallId },
    });
    if (existing) return existing;
  }

  const token = await createUniqueVoiceCallbackRequestToken(prisma);
  const resolvedAgentId = await resolveVoiceCallbackOwnerIdForPhone(
    normalizedPhone,
    input.agentId,
  );
  return prisma.voiceCallbackRequest.create({
    data: {
      token,
      phoneNumber: input.phoneNumber,
      normalizedPhone,
      voiceCallId: input.voiceCallId ?? null,
      agentId: resolvedAgentId,
      callStartedAt: input.callStartedAt ?? null,
      callEndedAt: input.callEndedAt ?? null,
      expiresAt: getVoiceCallbackRequestExpiryDate(),
    },
  });
}

async function maybeSendAttemptedCallSms(call: {
  id: string;
  direction: string;
  callerNumber: string;
  destinationNumber?: string | null;
  status: string;
  durationInSeconds?: number | null;
  assignedToId?: string | null;
  startedAt?: Date | null;
  endedAt?: Date | null;
}) {
  if (!isAttemptedCallStatus(call.status)) {
    return { sent: false, reason: "call_not_eligible" } as const;
  }

  const targetPhone =
    String(call.direction || "")
      .trim()
      .toUpperCase() === "OUTBOUND"
      ? call.destinationNumber || call.callerNumber || ""
      : call.callerNumber || call.destinationNumber || "";
  const normalizedPhone = normalizeVoiceNumber(targetPhone);
  if (!normalizedPhone)
    return { sent: false, reason: "missing_phone" } as const;
  if (isInternalVoicePhone(normalizedPhone))
    return { sent: false, reason: "internal_phone" } as const;

  const session = await ensureVoiceCallbackRequestSession({
    phoneNumber: normalizedPhone,
    voiceCallId: call.id,
    agentId: call.assignedToId ?? null,
    callStartedAt: call.startedAt ?? null,
    callEndedAt: call.endedAt ?? null,
  });

  if (!session) return { sent: false, reason: "session_not_created" } as const;
  if (session.smsSent)
    return { sent: false, reason: "already_sent_for_call" } as const;

  const callbackUrl = getVoiceCallbackRequestPublicUrl(session.token);
  const message =
    `We noticed you tried to call Betech Solar Solutions but the call was unsuccessful. ` +
    `If you would like our team to call you back, tap here: ${callbackUrl}`;

  const sendResult = await sendVoiceSmsOncePerDay({
    phoneNumber: targetPhone,
    normalizedPhoneNumber: normalizedPhone,
    notificationType: "ATTEMPTED_CALL_SMS",
    voiceCallId: call.id,
    messageBody: message,
  });

  if (!sendResult.sent) {
    return sendResult;
  }

  await prisma.voiceCallbackRequest.update({
    where: { id: session.id },
    data: {
      smsSent: true,
      smsSentAt: new Date(),
    },
  });

  return {
    sent: true,
    reason: "sent",
    token: session.token,
    providerMessageId: sendResult.providerMessageId,
  } as const;
}

function logAttemptedCallSmsResult(
  call: {
    id: string;
    direction: string;
    callerNumber: string;
    destinationNumber?: string | null;
    status: string;
    durationInSeconds?: number | null;
    assignedToId?: string | null;
  },
  result: {
    sent: boolean;
    reason: string;
    providerMessageId?: string | null;
    token?: string;
  },
) {
  console.info("[voice.sms.attempted_call_result]", {
    callId: call.id,
    direction: call.direction,
    callerNumber: call.callerNumber,
    destinationNumber: call.destinationNumber ?? null,
    status: call.status,
    durationInSeconds: call.durationInSeconds ?? null,
    assignedToId: call.assignedToId ?? null,
    sent: result.sent,
    reason: result.reason,
    providerMessageId: result.providerMessageId ?? null,
    token: result.token ?? null,
    skippedBecauseInternalPhone:
      result.reason === "internal_phone"
        ? normalizeVoiceNumber(
            String(call.direction || "")
              .trim()
              .toUpperCase() === "OUTBOUND"
              ? call.destinationNumber || call.callerNumber || ""
              : call.callerNumber || call.destinationNumber || "",
          )
        : null,
  });
}

export async function getPublicVoiceCallbackRequestByToken(token: string) {
  const trimmedToken = safeString(token);
  if (!trimmedToken) return null;

  const session = await prisma.voiceCallbackRequest.findUnique({
    where: { token: trimmedToken },
    include: {
      voiceCall: {
        select: {
          id: true,
          startedAt: true,
          endedAt: true,
          durationInSeconds: true,
          callerNumber: true,
          direction: true,
          status: true,
          assignedTo: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });
  if (!session) return null;

  const now = new Date();
  const isExpired = session.expiresAt.getTime() < now.getTime();
  return {
    session,
    state: session.followUpCreated
      ? "requested"
      : isExpired
        ? "expired"
        : "active",
  } as const;
}

export async function fulfillVoiceCallbackRequestByToken(token: string) {
  const trimmedToken = safeString(token);
  if (!trimmedToken) {
    return { ok: false, error: "invalid_token" } as const;
  }

  return prisma.$transaction(async (tx) => {
    const session = await tx.voiceCallbackRequest.findUnique({
      where: { token: trimmedToken },
      select: {
        id: true,
        token: true,
        phoneNumber: true,
        normalizedPhone: true,
        voiceCallId: true,
        agentId: true,
        followUpCreated: true,
        followUpTaskId: true,
        expiresAt: true,
        openedAt: true,
        openedCount: true,
      },
    });

    if (!session) return { ok: false, error: "invalid_token" } as const;
    if (session.expiresAt.getTime() < Date.now())
      return { ok: false, error: "expired_token" } as const;

    const now = new Date();
    let followUpTaskId = session.followUpTaskId;

    if (!session.followUpCreated) {
      if (!session.voiceCallId)
        return { ok: false, error: "missing_voice_call" } as const;
      const assignedToId =
        session.agentId ??
        (await resolveVoiceCallbackOwnerIdForPhone(
          session.normalizedPhone,
          null,
        ));
      const followUp = await ensureAutoCallbackFollowUp({
        voiceCallId: session.voiceCallId,
        phone: session.normalizedPhone || session.phoneNumber,
        assignedToId,
        status: "attempted_call",
        title: "Customer requested callback",
        notes:
          "Customer clicked the callback request link after an attempted call.",
      });
      followUpTaskId = followUp?.id ?? null;
    }

    const updated = await tx.voiceCallbackRequest.update({
      where: { token: trimmedToken },
      data: {
        openedCount: { increment: 1 },
        openedAt: session.openedAt ?? now,
        lastOpenedAt: now,
        requestedAt: now,
        followUpCreated: Boolean(followUpTaskId),
        followUpTaskId,
      },
      select: {
        id: true,
        token: true,
        followUpCreated: true,
        followUpTaskId: true,
      },
    });

    return { ok: true, request: updated } as const;
  });
}

async function ensureAutoCallbackFollowUp(input: {
  voiceCallId: string;
  voiceLeadId?: string | null;
  phone: string;
  assignedToId?: string | null;
  status: string;
  title?: string | null;
  notes?: string | null;
}) {
  const phoneVariants = getKenyanPhoneVariants(input.phone);
  if (!phoneVariants.length) return null;

  const existing = await prisma.voiceFollowUp.findFirst({
    where: {
      phone: { in: phoneVariants },
      status: { in: ["pending", "contacted"] },
      OR: [
        { voiceCallId: input.voiceCallId },
        ...(input.voiceLeadId ? [{ voiceLeadId: input.voiceLeadId }] : []),
        { title: { contains: "call back", mode: "insensitive" } },
      ],
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  const notes =
    input.notes?.trim() ||
    `Auto-created after ${safeString(input.status).replace(/_/g, " ") || "missed"} call.`;
  const dueAt = new Date(Date.now() + 15 * 60 * 1000);
  const title = input.title?.trim() || "Call back customer";

  if (existing) {
    return prisma.voiceFollowUp.update({
      where: { id: existing.id },
      data: {
        voiceCallId: input.voiceCallId,
        voiceLeadId: input.voiceLeadId ?? existing.voiceLeadId,
        assignedToId: input.assignedToId ?? existing.assignedToId,
        title,
        dueAt: existing.dueAt ?? dueAt,
        notes: existing.notes || notes,
      },
    });
  }

  return prisma.voiceFollowUp.create({
    data: {
      voiceCallId: input.voiceCallId,
      voiceLeadId: input.voiceLeadId ?? null,
      assignedToId: input.assignedToId ?? null,
      phone: input.phone,
      title,
      status: "pending",
      dueAt,
      notes,
    },
  });
}

async function closeVoiceCallbackWorkForAnsweredCall(call: {
  id: string;
  callerNumber: string;
  destinationNumber?: string | null;
  assignedToId?: string | null;
  status: string;
  durationInSeconds?: number | null;
}) {
  if (
    !isAnsweredBusinessStatus(call.status) &&
    Number(call.durationInSeconds ?? 0) <= 0
  )
    return;

  const phoneVariants = getCustomerContactPhones(call);
  if (!phoneVariants.length) return;

  const followUpResult = await prisma.voiceFollowUp.updateMany({
    where: {
      phone: { in: phoneVariants },
      status: { in: ["pending", "contacted"] },
    },
    data: {
      status: "resolved",
    },
  });

  const leadResult = await prisma.voiceLead.updateMany({
    where: {
      phone: { in: phoneVariants },
      status: { in: ["open", "pending_follow_up"] },
    },
    data: {
      status: "contacted",
      lastCallAt: new Date(),
      assignedToId: call.assignedToId ?? undefined,
    },
  });

  if (followUpResult.count || leadResult.count) {
    publishVoiceLiveEvent({
      type: "queue",
      reason: "voice_callback_work_resolved",
      callId: call.id,
      userId: call.assignedToId ?? null,
    });
  }
}

export async function syncVoiceCallAutomation(input: {
  id: string;
  direction: string;
  callerNumber: string;
  destinationNumber?: string | null;
  status: string;
  startedAt?: Date | null;
  endedAt?: Date | null;
  assignedToId?: string | null;
  durationInSeconds?: number | null;
}) {
  const normalizedStatus = safeString(input.status).toLowerCase();

  if (isAttemptedCallStatus(normalizedStatus)) {
    const attemptedSmsResult = await maybeSendAttemptedCallSms({
      id: input.id,
      direction: input.direction,
      callerNumber: input.callerNumber,
      destinationNumber: input.destinationNumber ?? null,
      status: normalizedStatus,
      durationInSeconds: input.durationInSeconds ?? null,
      assignedToId: input.assignedToId ?? null,
      startedAt: input.startedAt ?? null,
      endedAt: input.endedAt ?? null,
    }).catch((smsError) => {
      console.warn(
        "[voice.sms.attempted_call_skipped]",
        smsError instanceof Error ? smsError.message : smsError,
      );
      return null;
    });
    if (attemptedSmsResult) {
      logAttemptedCallSmsResult(
        {
          id: input.id,
          direction: input.direction,
          callerNumber: input.callerNumber,
          destinationNumber: input.destinationNumber ?? null,
          status: normalizedStatus,
          durationInSeconds: input.durationInSeconds ?? null,
          assignedToId: input.assignedToId ?? null,
        },
        attemptedSmsResult,
      );
    }

    return;
  }

  if (shouldCreateMissedLead(normalizedStatus)) {
    const lead = await createOrUpdateMissedVoiceLead({
      callerNumber: input.callerNumber,
      status: normalizedStatus,
      startedAt: input.startedAt,
      assignedToId: input.assignedToId,
      voiceCallId: input.id,
    });

    const callbackPhone = getCustomerContactPhones({
      callerNumber: input.callerNumber,
      destinationNumber: input.destinationNumber,
    })[0];

    if (callbackPhone) {
      const followUp = await ensureAutoCallbackFollowUp({
        voiceCallId: input.id,
        voiceLeadId: lead?.id ?? null,
        phone: callbackPhone,
        assignedToId: lead?.assignedToId ?? input.assignedToId ?? null,
        status: normalizedStatus,
      });

      if (followUp) {
        publishVoiceLiveEvent({
          type: "follow_up",
          reason: "voice_callback_follow_up_auto_created",
          callId: input.id,
          userId: followUp.assignedToId,
        });
      }
    }

    await maybeSendMissedCallSms({
      id: input.id,
      direction: input.direction,
      callerNumber: input.callerNumber,
      destinationNumber: input.destinationNumber ?? null,
      status: normalizedStatus,
      durationInSeconds: input.durationInSeconds ?? null,
      startedAt: input.startedAt ?? null,
    }).catch((smsError) => {
      console.warn(
        "[voice.sms.missed_call_skipped]",
        smsError instanceof Error ? smsError.message : smsError,
      );
    });

    return;
  }

  await closeVoiceCallbackWorkForAnsweredCall({
    id: input.id,
    callerNumber: input.callerNumber,
    destinationNumber: input.destinationNumber,
    assignedToId: input.assignedToId,
    status: normalizedStatus,
    durationInSeconds: input.durationInSeconds,
  });

  await maybeSendCallFeedbackSms({
    id: input.id,
    direction: input.direction,
    callerNumber: input.callerNumber,
    destinationNumber: input.destinationNumber ?? null,
    status: normalizedStatus,
    durationInSeconds: input.durationInSeconds ?? null,
    assignedToId: input.assignedToId ?? null,
    startedAt: input.startedAt ?? null,
    endedAt: input.endedAt ?? null,
  }).catch((smsError) => {
    console.warn(
      "[voice.sms.feedback_skipped]",
      smsError instanceof Error ? smsError.message : smsError,
    );
  });
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

export async function upsertVoiceCallFromPayload(
  payload: VoicePayload,
  input?: {
    routeType?: string | null;
    routedTo?: string | null;
    assignedToId?: string | null;
    answeredById?: string | null;
    answeredNumber?: string | null;
    answeredAt?: Date | null;
  },
) {
  const sessionId = safeString(payload.sessionId || payload.SessionId);
  if (!sessionId) {
    throw new Error("missing_session_id");
  }

  const existingCall = await prisma.voiceCall.findUnique({
    where: { sessionId },
    select: {
      status: true,
      routeType: true,
      routedTo: true,
    },
  });

  const callerNumber = normalizeVoiceNumber(
    payload.callerNumber || payload.caller || payload.from,
  );
  const destinationNumber = normalizeVoiceNumber(
    payload.destinationNumber || payload.to || payload.calledNumber,
  );
  const isRoutedInboundCall = Boolean(
    safeString(input?.routeType ?? existingCall?.routeType) ||
    safeString(input?.routedTo ?? existingCall?.routedTo),
  );
  const inferredStatus = inferVoiceCompletionStatus(payload, {
    treatZeroDurationSuccessAsNoAnswer: isRoutedInboundCall,
    treatInboundSuccessWithoutBridgeAsNoAnswer: isRoutedInboundCall,
  });
  const status = inferredStatus || normalizeVoiceStatus(payload);
  const isActive = isVoiceCallActive(payload);
  const customerLink = callerNumber
    ? await resolveVoiceCustomerLinkByPhone(callerNumber)
    : null;
  const customerId = customerLink?.matchedCustomer?.id ?? null;
  const answeredAgentAssignment =
    input?.assignedToId == null
      ? await resolveAnsweredAgentAssignment(destinationNumber)
      : null;

  const voiceCall = await prisma.voiceCall.upsert({
    where: { sessionId },
    create: {
      sessionId,
      direction:
        safeString(payload.direction || "INBOUND").toUpperCase() || "INBOUND",
      callerNumber:
        callerNumber ||
        safeString(payload.callerNumber || payload.caller || "unknown") ||
        "unknown",
      destinationNumber: destinationNumber || null,
      isActive,
      status,
      routedTo: input?.routedTo ?? null,
      routeType: input?.routeType ?? null,
      assignedToId: input?.assignedToId ?? answeredAgentAssignment ?? null,
      answeredById: input?.answeredById ?? null,
      answeredNumber: normalizeVoiceNumber(input?.answeredNumber || "") || null,
      answeredAt: input?.answeredAt ?? null,
      customerId,
      startedAt: parseDate(payload.startTime) ?? new Date(),
      endedAt: parseDate(payload.endTime),
      durationInSeconds: parseInteger(
        payload.durationInSeconds || payload.duration,
      ),
      currencyCode: safeString(payload.currencyCode) || null,
      amount: parseMoney(payload.amount ?? "0"),
      recordingUrl: safeString(payload.recordingUrl) || null,
      menuOption: safeString(payload.menuOption) || null,
      notes: safeString(payload.notes) || null,
      rawPayloadJson: payload,
    },
    update: {
      direction:
        safeString(payload.direction || "INBOUND").toUpperCase() || "INBOUND",
      callerNumber:
        callerNumber ||
        safeString(payload.callerNumber || payload.caller || "unknown") ||
        "unknown",
      destinationNumber: destinationNumber || null,
      isActive,
      status,
      routedTo: input?.routedTo ?? undefined,
      routeType: input?.routeType ?? undefined,
      assignedToId: input?.assignedToId ?? answeredAgentAssignment ?? undefined,
      answeredById: input?.answeredById ?? undefined,
      answeredNumber:
        normalizeVoiceNumber(input?.answeredNumber || "") || undefined,
      answeredAt: input?.answeredAt ?? undefined,
      customerId: customerId ?? undefined,
      endedAt: parseDate(payload.endTime) ?? undefined,
      durationInSeconds:
        parseInteger(payload.durationInSeconds || payload.duration) ??
        undefined,
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

export async function createVoiceEventFromPayload(
  payload: VoicePayload,
  voiceCallId?: string | null,
) {
  const sessionId = safeString(payload.sessionId || payload.SessionId);
  if (!sessionId) {
    throw new Error("missing_session_id");
  }

  const event = await prisma.voiceEvent.create({
    data: {
      voiceCallId: voiceCallId ?? null,
      sessionId,
      eventType: safeString(
        payload.eventType ||
          payload.status ||
          payload.callStatus ||
          payload.callSessionState ||
          "unknown",
      ),
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
  const normalized = String(status || "")
    .trim()
    .toLowerCase();
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
    "canceled",
    "disconnected",
  ].includes(normalized);
}

export async function createOrUpdateMissedVoiceLead(call: {
  callerNumber: string;
  status: string;
  startedAt?: Date | null;
  assignedToId?: string | null;
  voiceCallId?: string | null;
}) {
  if (!shouldCreateMissedLead(call.status) || !call.callerNumber) return null;

  const phone = normalizeVoiceNumber(call.callerNumber) || call.callerNumber;
  if (isVoiceAdminTestPhone(phone)) return null;
  const customerLink = phone
    ? await resolveVoiceCustomerLinkByPhone(phone)
    : null;
  const customerId = customerLink?.matchedCustomer?.id ?? null;
  const callerName = customerLink?.matchedCustomer?.name ?? null;
  const existing = await prisma.voiceLead.findFirst({
    where: { phone, status: { in: ["open", "pending_follow_up"] } },
    orderBy: { updatedAt: "desc" },
  });
  const leadOwnerId =
    (await resolveVoiceCallbackOwnerIdForPhone(phone, call.assignedToId)) ??
    existing?.assignedToId ??
    null;

  if (call.voiceCallId && leadOwnerId && leadOwnerId !== call.assignedToId) {
    await prisma.voiceCall.updateMany({
      where: { id: call.voiceCallId },
      data: {
        assignedToId: leadOwnerId,
      },
    });
  }

  if (existing) {
    const lead = await prisma.voiceLead.update({
      where: { id: existing.id },
      data: {
        name: callerName ?? existing.name,
        source: "VOICE_MISSED_CALL",
        status: "pending_follow_up",
        assignedToId: leadOwnerId,
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
      assignedToId: leadOwnerId,
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
  if (isVoiceAdminTestPhone(phone)) return null;
  const customerLink = call.customerId
    ? null
    : await resolveVoiceCustomerLinkByPhone(phone);
  const customerId =
    call.customerId ?? customerLink?.matchedCustomer?.id ?? null;
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
