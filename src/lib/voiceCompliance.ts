import { prisma } from "@/lib/prisma";
import { notifyAdminCriticalSms } from "@/lib/adminCriticalSms";
import { sendTransactionalSms } from "@/lib/africasTalking";
import { publishVoiceLiveEvent } from "@/lib/voiceLiveEvents";

const LOW_RATING_LIMIT = 2;
const QUALITY_RESPONSE_MINIMUM = 5;
const QUALITY_AVERAGE_THRESHOLD = 3;
const ADMIN_OVERRIDE_GRACE_MS = 24 * 60 * 60 * 1000;

export type VoiceComplianceStatus =
  | "NORMAL"
  | "WARNING"
  | "QUALITY_REVIEW"
  | "RESTRICTED"
  | "ADMIN_OVERRIDE";

function eventPayload(input: Record<string, unknown>) {
  return input as Record<string, never>;
}

async function notifyComplianceRestriction(input: {
  eventId: string;
  userId: string;
  reason: string | null;
  overdueCallbackCount: number;
}) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { name: true, phone: true },
  });
  const agentLabel = user?.name || "The assigned agent";
  const reason = input.reason || "overdue customer callback work";
  const actionPath = "/admin/communications/voice?tab=agents";

  await Promise.allSettled([
    notifyAdminCriticalSms({
      eventType: "VOICE_COMPLIANCE_RESTRICTED",
      entityId: input.eventId,
      title: "Voice routing paused",
      details: [
        `Agent: ${agentLabel}`,
        `Reason: ${reason}`,
        `Overdue callbacks: ${input.overdueCallbackCount}`,
        "New inbound calls are being sent to the emergency admin fallback.",
      ],
      actionPath,
      payload: { userId: input.userId, reason, overdueCallbackCount: input.overdueCallbackCount },
    }),
    user?.phone
      ? sendTransactionalSms(
          user.phone,
          `[BETECH VOICE] Your inbound-call routing has been paused: ${reason} Complete or update your callback tasks, then contact an admin if you need routing restored.`,
        )
      : Promise.resolve(),
  ]);
}

function formatCallbackDeadline(value: Date) {
  return value.toLocaleString("en-KE", {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimeRemaining(value: Date, now: Date) {
  const milliseconds = Math.max(0, value.getTime() - now.getTime());
  const minutes = Math.ceil(milliseconds / 60_000);
  if (minutes <= 0) return "now";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h${remainder ? ` ${remainder}m` : ""}` : `${remainder}m`;
}

async function notifyComplianceWarning(input: {
  userId: string;
  pendingCallbackCount: number;
  nextDueAt: Date | null;
  now: Date;
}) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { phone: true },
  });
  if (!user?.phone || !input.pendingCallbackCount) return;
  const deadline = input.nextDueAt
    ? ` Your next deadline is ${formatCallbackDeadline(input.nextDueAt)} EAT (${formatTimeRemaining(input.nextDueAt, input.now)} left).`
    : "";
  await sendTransactionalSms(
    user.phone,
    `[BETECH VOICE] You have ${input.pendingCallbackCount} customer follow-up${input.pendingCallbackCount === 1 ? "" : "s"} to complete.${deadline} If a follow-up becomes overdue, new inbound calls will be routed to the fallback until all overdue work is resolved.`,
  );
}

function formatOverrideDeadline(value: Date) {
  return value.toLocaleString("en-KE", {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function notifyOverrideGrace(input: { userId: string; deadline: Date }) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { phone: true },
  });
  if (!user?.phone) return;
  await sendTransactionalSms(
    user.phone,
    `[BETECH VOICE] An admin has temporarily restored your inbound-call routing. You have until ${formatOverrideDeadline(input.deadline)} (EAT) to complete or update your overdue callback tasks. If the work remains overdue after this deadline, routing will be restricted again automatically.`,
  );
}

async function notifyComplianceRestored(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
  if (!user?.phone) return;
  await sendTransactionalSms(
    user.phone,
    "[BETECH VOICE] Your overdue call tasks have been cleared. Your inbound-call routing has been restored automatically. Thank you for completing the customer follow-up.",
  );
}

export async function evaluateVoiceAgentCompliance(userId: string, now = new Date()) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) throw new Error("VOICE_USER_NOT_FOUND");
  // Admin/fallback staff must always remain reachable. Their callback work is
  // still visible, but it never participates in automated inbound restrictions.
  if (user.role === "ADMIN") {
    return prisma.voiceAgentCompliance.upsert({
      where: { userId },
      create: { userId, status: "NORMAL", overdueCallbackCount: 0, lowRatingCount30d: 0, feedbackResponseCount30d: 0, averageRating30d: 0, qualityReviewRequired: false },
      update: { status: "NORMAL", overdueCallbackCount: 0, oldestOverdueAt: null, restrictionReason: null, restrictedAt: null, overrideActive: false, manualRestriction: false, manualRestrictionReason: null, manualRestrictedAt: null },
    });
  }
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - 30);

  const [existing, pendingTasks, feedbackStats, lowRatingCount] =
    await Promise.all([
      prisma.voiceAgentCompliance.findUnique({ where: { userId } }),
      prisma.voiceFollowUp.findMany({
        where: {
          assignedToId: userId,
          status: { notIn: ["resolved", "closed"] },
        },
        orderBy: { dueAt: "asc" },
        select: { id: true, dueAt: true },
      }),
      prisma.voiceCallFeedback.aggregate({
        where: { agentId: userId, submitted: true, submittedAt: { gte: windowStart } },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      prisma.voiceCallFeedback.count({
        where: {
          agentId: userId,
          submitted: true,
          submittedAt: { gte: windowStart },
          rating: { lte: LOW_RATING_LIMIT },
        },
      }),
    ]);

  const overdueTasks = pendingTasks.filter(
    (task) => Boolean(task.dueAt && task.dueAt <= now),
  );
  const oldestOverdueAt = overdueTasks[0]?.dueAt ?? null;
  const overdueCallbackCount = overdueTasks.length;
  const pendingCallbackCount = pendingTasks.length;
  const nextCallbackDueAt = pendingTasks.find((task) => task.dueAt && task.dueAt > now)?.dueAt ?? null;
  const feedbackResponseCount30d = Number(feedbackStats._count.rating ?? 0);
  const averageRating30d = Number(feedbackStats._avg.rating ?? 0);
  const qualityReviewRequired =
    lowRatingCount >= 3 ||
    (feedbackResponseCount30d >= QUALITY_RESPONSE_MINIMUM &&
      averageRating30d > 0 &&
      averageRating30d < QUALITY_AVERAGE_THRESHOLD);
  // Automatic callback tasks are due after two active working hours. Once a
  // task is overdue, inbound calls go to fallback until that overdue work is
  // resolved. The count remains visible for escalation and audit.
  const callbackRestrictionRequired = overdueCallbackCount >= 1;
  const overrideGraceEndsAt = existing?.overrideAt
    ? new Date(existing.overrideAt.getTime() + ADMIN_OVERRIDE_GRACE_MS)
    : null;
  const overrideActive = Boolean(
    existing?.overrideActive &&
      overrideGraceEndsAt &&
      now.getTime() < overrideGraceEndsAt.getTime(),
  );
  const manualRestriction = Boolean(existing?.manualRestriction);

  const status: VoiceComplianceStatus = manualRestriction ||
    (callbackRestrictionRequired && !overrideActive)
    ? "RESTRICTED"
    : overrideActive
      ? "ADMIN_OVERRIDE"
      : pendingCallbackCount > 0
        ? "WARNING"
        : qualityReviewRequired
          ? "QUALITY_REVIEW"
          : "NORMAL";
  const restrictionReason = manualRestriction
    ? existing?.manualRestrictionReason || "Restricted by an administrator."
    : callbackRestrictionRequired
      ? `${overdueCallbackCount} overdue customer callback task${overdueCallbackCount === 1 ? "" : "s"}.`
      : null;
  const changed =
    !existing ||
    existing.status !== status ||
    existing.overdueCallbackCount !== overdueCallbackCount ||
    existing.lowRatingCount30d !== lowRatingCount ||
    existing.qualityReviewRequired !== qualityReviewRequired ||
    Math.abs(Number(existing.averageRating30d ?? 0) - averageRating30d) > 0.01;

  const compliance = await prisma.voiceAgentCompliance.upsert({
    where: { userId },
    create: {
      userId,
      status,
      overdueCallbackCount,
      oldestOverdueAt,
      lowRatingCount30d: lowRatingCount,
      feedbackResponseCount30d,
      averageRating30d,
      qualityReviewRequired,
      restrictionReason,
      restrictedAt: status === "RESTRICTED" ? now : null,
      overrideActive,
      overrideReason: existing?.overrideReason ?? null,
      overrideById: existing?.overrideById ?? null,
      overrideAt: existing?.overrideAt ?? null,
      overrideBaselineAt: existing?.overrideBaselineAt ?? null,
      manualRestriction,
      manualRestrictionReason: existing?.manualRestrictionReason ?? null,
      manualRestrictedAt: existing?.manualRestrictedAt ?? null,
    },
    update: {
      status,
      overdueCallbackCount,
      oldestOverdueAt,
      lowRatingCount30d: lowRatingCount,
      feedbackResponseCount30d,
      averageRating30d,
      qualityReviewRequired,
      restrictionReason,
      restrictedAt:
        status === "RESTRICTED"
          ? existing?.restrictedAt ?? now
          : null,
      overrideActive,
    },
  });

  if (changed) {
    const complianceEvent = await prisma.voiceComplianceEvent.create({
      data: {
        complianceId: compliance.id,
        type: status === "RESTRICTED" ? "RESTRICTION_EVALUATED" : "STATUS_EVALUATED",
        reason: restrictionReason,
        payload: eventPayload({
          previousStatus: existing?.status ?? null,
          status,
          overdueCallbackCount,
          pendingCallbackCount,
          nextCallbackDueAt: nextCallbackDueAt?.toISOString() ?? null,
          lowRatingCount30d: lowRatingCount,
          feedbackResponseCount30d,
          averageRating30d,
          qualityReviewRequired,
        }),
      },
    });
    publishVoiceLiveEvent({
      type: "presence",
      reason: "voice_compliance_updated",
      userId,
    });
    if (status === "RESTRICTED" && existing?.status !== "RESTRICTED") {
      try {
        await notifyComplianceRestriction({
          eventId: complianceEvent.id,
          userId,
          reason: restrictionReason,
          overdueCallbackCount,
        });
      } catch (error) {
        console.error("[voice.compliance.notification_failed]", error);
      }
    }
    if (
      status === "WARNING" &&
      existing?.status !== "WARNING" &&
      !manualRestriction
    ) {
      try {
        await notifyComplianceWarning({
          userId,
          pendingCallbackCount,
          nextDueAt: nextCallbackDueAt,
          now,
        });
      } catch (error) {
        console.error("[voice.compliance.warning_notification_failed]", error);
      }
    }
    if (
      status !== "RESTRICTED" &&
      existing?.status === "RESTRICTED" &&
      !manualRestriction
    ) {
      try {
        await notifyComplianceRestored(userId);
      } catch (error) {
        console.error("[voice.compliance.restore_notification_failed]", error);
      }
    }
  }

  return compliance;
}

export async function evaluateAllVoiceCompliance() {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { role: { in: ["ADMIN", "SUPERVISOR"] } },
        { attendantCategory: { in: ["DIRECT_SALES_OPS", "MARKETING_OPS"] } },
      ],
    },
    select: { id: true },
  });
  return Promise.all(users.map((user) => evaluateVoiceAgentCompliance(user.id)));
}

export async function setVoiceComplianceAdminDecision(input: {
  userId: string;
  adminId: string;
  action: "restore" | "restrict";
  reason?: string | null;
}) {
  const target = await prisma.user.findUnique({ where: { id: input.userId }, select: { role: true } });
  if (target?.role === "ADMIN") throw new Error("ADMIN_VOICE_COMPLIANCE_EXEMPT");
  const now = new Date();
  const overrideGraceEndsAt = new Date(now.getTime() + ADMIN_OVERRIDE_GRACE_MS);
  const reason = String(input.reason || "").trim() || null;
  const current = await evaluateVoiceAgentCompliance(input.userId, now);
  const compliance = await prisma.voiceAgentCompliance.update({
    where: { id: current.id },
    data:
      input.action === "restore"
        ? {
            status: "ADMIN_OVERRIDE",
            overrideActive: true,
            overrideReason: reason,
            overrideById: input.adminId,
            overrideAt: now,
            overrideBaselineAt: now,
            manualRestriction: false,
            manualRestrictionReason: null,
            manualRestrictedAt: null,
            restrictionReason: null,
            restrictedAt: null,
          }
        : {
            status: "RESTRICTED",
            manualRestriction: true,
            manualRestrictionReason: reason || "Restricted by an administrator.",
            manualRestrictedAt: now,
            overrideActive: false,
            restrictionReason: reason || "Restricted by an administrator.",
            restrictedAt: now,
          },
  });
  const complianceEvent = await prisma.voiceComplianceEvent.create({
    data: {
      complianceId: compliance.id,
      type: input.action === "restore" ? "ADMIN_ROUTING_RESTORED" : "ADMIN_RESTRICTION_APPLIED",
      reason,
      payload: eventPayload({
        adminId: input.adminId,
        action: input.action,
        overrideGraceEndsAt:
          input.action === "restore" ? overrideGraceEndsAt.toISOString() : null,
      }),
    },
  });
  publishVoiceLiveEvent({ type: "presence", reason: "voice_compliance_admin_decision", userId: input.userId });
  if (input.action === "restrict") {
    try {
      await notifyComplianceRestriction({
        eventId: complianceEvent.id,
        userId: input.userId,
        reason: compliance.restrictionReason,
        overdueCallbackCount: compliance.overdueCallbackCount,
      });
    } catch (error) {
      console.error("[voice.compliance.notification_failed]", error);
    }
  } else {
    try {
      await notifyOverrideGrace({ userId: input.userId, deadline: overrideGraceEndsAt });
    } catch (error) {
      console.error("[voice.compliance.override_notification_failed]", error);
    }
  }
  return compliance;
}

export function isVoiceComplianceRestricted(compliance: {
  status?: string | null;
  overrideActive?: boolean | null;
} | null | undefined) {
  return compliance?.status === "RESTRICTED" && !compliance.overrideActive;
}
