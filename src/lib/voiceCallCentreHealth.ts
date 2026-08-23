import { Prisma } from "@prisma/client";
import { syncDividedChatraceContact } from "@/lib/integrations/chatraceDivided";
import { prisma } from "@/lib/prisma";
import { runOrderedChatraceHealthDelivery } from "@/lib/voiceCallCentreAlertDelivery";
import {
  BUSY_ALERT_REASON,
  INACTIVITY_ALERT_REASON,
  evaluateBusyTransition,
  formatNairobiAlertTime,
  getNairobiWorkingWindow,
  hasReachedInactivityThreshold,
  normalizeCallCentreStatus,
} from "@/lib/voiceCallCentreHealthLogic";

const HEALTH_ID = "default";
const MAX_PRE_TAG_ATTEMPTS = 4;

type InboundHealthCall = {
  id: string;
  direction: string;
  status: string;
  startedAt: Date | null;
  createdAt: Date;
};

async function ensureHealthState(tx: Prisma.TransactionClient) {
  return tx.voiceCallCentreHealth.upsert({
    where: { id: HEALTH_ID },
    create: { id: HEALTH_ID },
    update: {},
  });
}

async function resolveAlert(
  tx: Prisma.TransactionClient,
  alertId: string | null,
  resolvedAt: Date,
) {
  if (!alertId) return;
  await tx.voiceCallCentreAlert.updateMany({
    where: { id: alertId, resolvedAt: null },
    data: { resolvedAt },
  });
}

export async function processInboundCallCentreHealth(call: InboundHealthCall) {
  if (String(call.direction).toUpperCase() !== "INBOUND") return null;

  const now = new Date();
  const callAt = call.startedAt || call.createdAt;
  const normalizedStatus = normalizeCallCentreStatus(call.status);

  const alertId = await prisma.$transaction(async (tx) => {
    const state = await ensureHealthState(tx);
    const isNewestInbound = !state.lastInboundAt || callAt >= state.lastInboundAt;
    const isNewInbound = isNewestInbound && state.lastInboundCallId !== call.id;
    const update: Prisma.VoiceCallCentreHealthUpdateInput = {};

    if (isNewInbound) {
      update.lastInboundCallId = call.id;
      update.lastInboundAt = callAt;
      if (state.inactivityIncidentActive) {
        await resolveAlert(tx, state.inactivityIncidentAlertId, now);
        update.inactivityIncidentActive = false;
        update.inactivityIncidentStartedAt = null;
        update.inactivityIncidentAlertId = null;
      }
    }

    const isTerminal = normalizedStatus === "BUSY" || normalizedStatus === "ANSWERED";
    const terminalAlreadyEvaluated =
      state.lastEvaluatedTerminalId === call.id &&
      state.lastEvaluatedTerminalStatus === normalizedStatus;
    if (!isTerminal || terminalAlreadyEvaluated) {
      if (Object.keys(update).length) {
        await tx.voiceCallCentreHealth.update({ where: { id: HEALTH_ID }, data: update });
      }
      return null;
    }

    update.lastEvaluatedTerminalId = call.id;
    update.lastEvaluatedTerminalStatus = normalizedStatus;
    const transition = evaluateBusyTransition(state, normalizedStatus);
    update.consecutiveBusy = transition.consecutiveBusy;
    update.busyIncidentActive = transition.busyIncidentActive;

    if (normalizedStatus === "ANSWERED") {
      await resolveAlert(tx, state.busyIncidentAlertId, now);
      update.lastAnsweredCallId = call.id;
      update.lastAnsweredAt = callAt;
      update.lastBusyCallId = null;
      update.busyIncidentStartedAt = null;
      update.busyIncidentAlertId = null;
    } else {
      update.lastBusyCallId = call.id;
    }

    let createdAlertId: string | null = null;
    if (transition.shouldAlert) {
      const alert = await tx.voiceCallCentreAlert.create({
        data: {
          incidentKey: `BUSY_CALLS:${call.id}`,
          type: "BUSY_CALLS",
          reason: BUSY_ALERT_REASON,
          detectedAt: now,
          associatedCallIds: [state.lastBusyCallId, call.id].filter(Boolean),
        },
      });
      createdAlertId = alert.id;
      update.busyIncidentStartedAt = now;
      update.busyIncidentAlertId = alert.id;
    }

    await tx.voiceCallCentreHealth.update({ where: { id: HEALTH_ID }, data: update });
    return createdAlertId;
  });

  if (alertId) await deliverCallCentreHealthAlert(alertId);
  return alertId;
}

export async function safelyProcessInboundCallCentreHealth(call: InboundHealthCall) {
  try {
    return await processInboundCallCentreHealth(call);
  } catch (error) {
    console.error("[voice.call_centre_health.processing_failed]", {
      callId: call.id,
      status: call.status,
      error: error instanceof Error ? error.message : "health_processing_failed",
    });
    return null;
  }
}

export async function runCallCentreInactivityCheck(now = new Date()) {
  const window = getNairobiWorkingWindow(now);
  const state = await prisma.voiceCallCentreHealth.upsert({
    where: { id: HEALTH_ID },
    create: { id: HEALTH_ID, lastHealthCheckAt: now },
    update: { lastHealthCheckAt: now },
  });

  let alertId: string | null = null;
  if (window && !state.inactivityIncidentActive) {
    const latestInbound = await prisma.voiceCall.findFirst({
      where: {
        direction: "INBOUND",
        startedAt: { gte: window.start, lte: now },
      },
      orderBy: { startedAt: "desc" },
      select: { id: true, startedAt: true },
    });
    const lastInboundAt = latestInbound?.startedAt ?? null;

    if (
      hasReachedInactivityThreshold({
        now,
        windowStart: window.start,
        lastInboundAt,
      })
    ) {
      const created = await prisma.$transaction(async (tx) => {
        const current = await ensureHealthState(tx);
        if (current.inactivityIncidentActive) return null;
        const alert = await tx.voiceCallCentreAlert.upsert({
          where: { incidentKey: `NO_INBOUND_CALLS:${window.start.toISOString()}` },
          create: {
            incidentKey: `NO_INBOUND_CALLS:${window.start.toISOString()}`,
            type: "NO_INBOUND_CALLS",
            reason: INACTIVITY_ALERT_REASON,
            detectedAt: now,
            associatedCallIds: latestInbound?.id ? [latestInbound.id] : [],
          },
          update: {},
        });
        await tx.voiceCallCentreHealth.update({
          where: { id: HEALTH_ID },
          data: {
            inactivityIncidentActive: true,
            inactivityIncidentStartedAt: now,
            inactivityIncidentAlertId: alert.id,
          },
        });
        return alert.id;
      });
      alertId = created;
    }
  }

  if (alertId) await deliverCallCentreHealthAlert(alertId);
  await retryPreTagCallCentreAlerts();
  return getCallCentreHealthSnapshot();
}

export async function deliverCallCentreHealthAlert(alertId: string) {
  const claimed = await prisma.voiceCallCentreAlert.updateMany({
    where: {
      id: alertId,
      tagAttemptedAt: null,
      attemptCount: { lt: MAX_PRE_TAG_ATTEMPTS },
      deliveryStatus: { in: ["PENDING", "FAILED"] },
    },
    data: {
      deliveryStatus: "DELIVERING",
      attemptCount: { increment: 1 },
      lastAttemptAt: new Date(),
      lastError: null,
    },
  });
  if (!claimed.count) return false;

  const alert = await prisma.voiceCallCentreAlert.findUnique({ where: { id: alertId } });
  if (!alert) return false;

  const configuredAdminNumbers = String(
    process.env.ADMIN_NOTIFICATION_WHATSAPP_NUMBERS || "",
  )
    .split(/[,\s;]+/g)
    .map((value) => value.trim())
    .filter(Boolean);
  const phone = String(
    process.env.CHATRACE_CALL_CENTRE_ADMIN_PHONE || configuredAdminNumbers[0] || "",
  ).trim();
  const firstName = String(process.env.CHATRACE_CALL_CENTRE_ADMIN_NAME || "Betech Admin").trim();
  if (!phone) {
    await prisma.voiceCallCentreAlert.update({
      where: { id: alertId },
      data: { deliveryStatus: "FAILED", lastError: "missing_admin_notification_phone" },
    });
    return false;
  }

  try {
    const result = await runOrderedChatraceHealthDelivery({
      phone,
      firstName,
      issue: alert.reason,
      alertTime: formatNairobiAlertTime(alert.detectedAt),
      sync: syncDividedChatraceContact,
      afterIssueUpdated: async (contactId) => {
        await prisma.voiceCallCentreAlert.update({
          where: { id: alertId },
          data: {
            issueFieldUpdated: true,
            chatraceContact: contactId || phone,
          },
        });
      },
      afterTimeUpdated: async (contactId) => {
        await prisma.voiceCallCentreAlert.update({
          where: { id: alertId },
          data: {
            timeFieldUpdated: true,
            chatraceContact: contactId || phone,
          },
        });
      },
      beforeTagAttempt: async () => {
        await prisma.voiceCallCentreAlert.update({
          where: { id: alertId },
          data: { tagAttemptedAt: new Date() },
        });
      },
    });

    const deliveryStatus = result.ok
      ? "SENT"
      : result.tagAttempted
        ? "DELIVERY_UNCERTAIN"
        : "FAILED";
    await prisma.voiceCallCentreAlert.update({
      where: { id: alertId },
      data: {
        chatraceContact: result.contactId || phone,
        issueFieldUpdated: result.issueFieldUpdated,
        timeFieldUpdated: result.timeFieldUpdated,
        tagApplied: result.tagApplied,
        deliveryStatus,
        lastError: result.error,
      },
    });
    if (result.ok) {
      await prisma.voiceCallCentreHealth.update({
        where: { id: HEALTH_ID },
        data: { lastAlertAt: new Date(), lastAlertReason: alert.reason },
      });
    }
    return result.ok;
  } catch (error) {
    const latest = await prisma.voiceCallCentreAlert.findUnique({
      where: { id: alertId },
      select: { tagAttemptedAt: true },
    });
    await prisma.voiceCallCentreAlert.update({
      where: { id: alertId },
      data: {
        deliveryStatus: latest?.tagAttemptedAt ? "DELIVERY_UNCERTAIN" : "FAILED",
        lastError: error instanceof Error ? error.message.slice(0, 500) : "chatrace_delivery_failed",
      },
    });
    console.error("[voice.call_centre_health.chatrace_failed]", {
      alertId,
      stage: latest?.tagAttemptedAt ? "tag_attempted" : "before_tag",
    });
    return false;
  }
}

export async function retryPreTagCallCentreAlerts() {
  const retryBefore = new Date(Date.now() - 4 * 60 * 1000);
  const retryable = await prisma.voiceCallCentreAlert.findMany({
    where: {
      tagAttemptedAt: null,
      deliveryStatus: { in: ["PENDING", "FAILED"] },
      attemptCount: { lt: MAX_PRE_TAG_ATTEMPTS },
      OR: [{ lastAttemptAt: null }, { lastAttemptAt: { lte: retryBefore } }],
    },
    orderBy: { createdAt: "asc" },
    take: 5,
    select: { id: true },
  });
  for (const alert of retryable) {
    await deliverCallCentreHealthAlert(alert.id);
  }
}

export async function getCallCentreHealthSnapshot() {
  const [state, latestAlert] = await Promise.all([
    prisma.voiceCallCentreHealth.upsert({
      where: { id: HEALTH_ID },
      create: { id: HEALTH_ID },
      update: {},
    }),
    prisma.voiceCallCentreAlert.findFirst({ orderBy: { detectedAt: "desc" } }),
  ]);
  const warning = state.busyIncidentActive || state.inactivityIncidentActive;
  return {
    currentHealth: warning ? "WARNING" : "HEALTHY",
    lastInboundCall: state.lastInboundAt?.toISOString() ?? null,
    lastAnsweredCall: state.lastAnsweredAt?.toISOString() ?? null,
    consecutiveBusy: state.consecutiveBusy,
    lastHealthCheck: state.lastHealthCheckAt?.toISOString() ?? null,
    activeBusyIncident: state.busyIncidentActive,
    activeInactivityIncident: state.inactivityIncidentActive,
    lastWhatsAppAlert: state.lastAlertAt?.toISOString() ?? null,
    alertReason: state.lastAlertReason ?? latestAlert?.reason ?? null,
    latestDeliveryStatus: latestAlert?.deliveryStatus ?? null,
  };
}
