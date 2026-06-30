const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const { PrismaClient } = require("@prisma/client");

function loadPreferredEnv() {
  const cwd = process.cwd();
  for (const name of [".env.local", ".env"]) {
    const filePath = path.join(cwd, name);
    if (!fs.existsSync(filePath)) continue;
    const parsed = dotenv.parse(fs.readFileSync(filePath));
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] == null || process.env[key] === "") {
        process.env[key] = value;
      }
    }
  }

  const preferredDbUrl =
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DIRECT_URL ||
    process.env.DATABASE_URL;
  if (preferredDbUrl) {
    process.env.DATABASE_URL = preferredDbUrl;
  }
}

loadPreferredEnv();

const prisma = new PrismaClient();

const MISSED_STATUSES = new Set([
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
]);

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function safeNumber(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(safeString(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseInteger(value) {
  if (!value) return null;
  const parsed = safeNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function normalizeKenyanPhone(input) {
  if (!input) return "";
  let s = String(input).trim();
  s = s.replace(/[^+0-9]/g, "");

  if (/^0((?:7|1)\d{8})$/.test(s)) return `+254${s.slice(1)}`;
  if (/^((?:7|1)\d{8})$/.test(s)) return `+254${s}`;
  if (/^254((?:7|1)\d{8})$/.test(s)) return `+${s}`;
  if (/^\+254(?:7|1)\d{8}$/.test(s)) return s;
  return "";
}

function getKenyanPhoneVariants(input) {
  const normalized = normalizeKenyanPhone(input);
  if (!normalized) return [];
  const local = `0${normalized.slice(4)}`;
  const short = normalized.slice(4);
  const digits = normalized.slice(1);
  return Array.from(new Set([normalized, local, short, digits]));
}

function inferVoiceCompletionStatus(payload, options = {}) {
  const hangupCause = safeString(payload.lastBridgeHangupCause || payload.bridgeHangupCause || payload.hangupCause).toUpperCase();
  if (hangupCause === "USER_BUSY" || hangupCause === "BUSY") return "busy";
  if (hangupCause === "NO_ANSWER" || hangupCause === "NO ANSWER") return "no_answer";

  const normalizedStatus = safeString(payload.status).toLowerCase();
  const normalizedSessionState = safeString(payload.callSessionState).toLowerCase();
  if (["answered", "connected", "in_progress", "transferred"].includes(normalizedStatus)) {
    return normalizedStatus;
  }
  const duration = parseInteger(payload.durationInSeconds || payload.duration) ?? 0;
  const direction = safeString(payload.direction || "INBOUND").toUpperCase() || "INBOUND";
  const treatZeroDurationSuccessAsNoAnswer = options.treatZeroDurationSuccessAsNoAnswer !== false;
  const treatInboundSuccessWithoutBridgeAsNoAnswer = options.treatInboundSuccessWithoutBridgeAsNoAnswer === true;
  const isProviderTerminalSuccess =
    ["success", "successful", "completed", "complete"].includes(normalizedStatus) ||
    ["completed", "complete"].includes(normalizedSessionState);
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
    Boolean(safeString(payload.dialDestinationNumber || payload.lastDialDestinationNumber)) ||
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

  return safeString(
    payload.status ||
      payload.callSessionState ||
      payload.callStatus ||
      payload.state ||
      "completed",
  ).trim();
}

function getInternalVoiceNumbers() {
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

function getCustomerPhones(call) {
  const internalNumbers = getInternalVoiceNumbers();
  return Array.from(
    new Set(
      [call.callerNumber, call.destinationNumber]
        .flatMap((value) => getKenyanPhoneVariants(String(value || "").trim()))
        .filter((phone) => Boolean(phone) && !internalNumbers.has(phone)),
    ),
  );
}

function isAnsweredLikeStatus(status) {
  return ["answered", "connected", "in_progress", "transferred", "success", "successful", "completed", "complete"].includes(
    normalizeText(status),
  );
}

async function resolveCallbackArtifactsForAnsweredCall(call) {
  const phoneVariants = getCustomerPhones(call);
  if (!phoneVariants.length) return { followUpsResolved: 0, leadsContacted: 0 };

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
      assignedToId: call.assignedToId || undefined,
    },
  });

  return {
    followUpsResolved: followUpResult.count,
    leadsContacted: leadResult.count,
  };
}

async function run() {
  const sinceDays = Number(process.env.VOICE_STATUS_BACKFILL_DAYS || 14);
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  const candidates = await prisma.voiceCall.findMany({
    where: {
      createdAt: { gte: since },
      status: { in: Array.from(MISSED_STATUSES) },
      OR: [
        { routeType: { not: null } },
        { routedTo: { not: null } },
        { recordingUrl: { not: null } },
        { durationInSeconds: { gt: 0 } },
      ],
    },
    select: {
      id: true,
      sessionId: true,
      status: true,
      routeType: true,
      routedTo: true,
      callerNumber: true,
      destinationNumber: true,
      assignedToId: true,
      durationInSeconds: true,
      recordingUrl: true,
      rawPayloadJson: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  let updatedCalls = 0;
  let resolvedFollowUps = 0;
  let contactedLeads = 0;

  console.log(`[voice-backfill] scanning ${candidates.length} candidate calls since ${since.toISOString()}`);

  for (const call of candidates) {
    if (!call.rawPayloadJson || typeof call.rawPayloadJson !== "object" || Array.isArray(call.rawPayloadJson)) {
      continue;
    }

    const payload = Object.fromEntries(
      Object.entries(call.rawPayloadJson).map(([key, value]) => [key, String(value ?? "")]),
    );
    const isRoutedInboundCall = Boolean(String(call.routeType || "").trim() || String(call.routedTo || "").trim());
    const correctedStatus = inferVoiceCompletionStatus(payload, {
      treatZeroDurationSuccessAsNoAnswer: isRoutedInboundCall,
      treatInboundSuccessWithoutBridgeAsNoAnswer: isRoutedInboundCall,
    });

    if (!isAnsweredLikeStatus(correctedStatus)) {
      continue;
    }

    if (normalizeText(call.status) !== normalizeText(correctedStatus)) {
      await prisma.voiceCall.update({
        where: { id: call.id },
        data: {
          status: correctedStatus,
          isActive: false,
        },
      });
      updatedCalls += 1;
      console.log(
        `[voice-backfill] repaired ${call.sessionId} ${call.callerNumber} from ${call.status} -> ${correctedStatus} (duration=${call.durationInSeconds ?? 0})`,
      );
    }

    const callbackRepair = await resolveCallbackArtifactsForAnsweredCall({
      id: call.id,
      callerNumber: call.callerNumber,
      destinationNumber: call.destinationNumber,
      assignedToId: call.assignedToId,
    });
    resolvedFollowUps += callbackRepair.followUpsResolved;
    contactedLeads += callbackRepair.leadsContacted;
  }

  console.log(
    `[voice-backfill] done updatedCalls=${updatedCalls} resolvedFollowUps=${resolvedFollowUps} contactedLeads=${contactedLeads}`,
  );
}

run()
  .catch((error) => {
    console.error("[voice-backfill] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
