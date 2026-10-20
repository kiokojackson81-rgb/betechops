import { prisma } from "@/lib/prisma";
import { notifyAdminCriticalSms } from "@/lib/adminCriticalSms";
import { sendTransactionalSms } from "@/lib/africasTalking";
import { publishVoiceLiveEvent } from "@/lib/voiceLiveEvents";

const OVERDUE_CALLBACK_LIMIT = 3;
const SINGLE_CALLBACK_RESTRICTION_MS = 2 * 60 * 60 * 1000;
const LOW_RATING_LIMIT = 2;
const QUALITY_RESPONSE_MINIMUM = 5;
const QUALITY_AVERAGE_THRESHOLD = 3;

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

export async function evaluateVoiceAgentCompliance(userId: string, now = new Date()) {
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - 30);

  const [existing, overdueTasks, feedbackStats, lowRatingCount, newestViolation] =
    await Promise.all([
      prisma.voiceAgentCompliance.findUnique({ where: { userId } }),
      prisma.voiceFollowUp.findMany({
        where: {
          assignedToId: userId,
          dueAt: { lte: now },
          status: { notIn: ["resolved", "closed"] },
        },
        orderBy: { dueAt: "asc" },
        select: { id: true, dueAt: true, updatedAt: true },
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
      prisma.voiceCallFeedback.findFirst({
        where: { agentId: userId, submitted: true, submittedAt: { gte: windowStart } },
        orderBy: { submittedAt: "desc" },
        select: { submittedAt: true },
      }),
    ]);

  const oldestOverdueAt = overdueTasks[0]?.dueAt ?? null;
  const overdueCallbackCount = overdueTasks.length;
  const feedbackResponseCount30d = Number(feedbackStats._count.rating ?? 0);
  const averageRating30d = Number(feedbackStats._avg.rating ?? 0);
  const qualityReviewRequired =
    lowRatingCount >= 3 ||
    (feedbackResponseCount30d >= QUALITY_RESPONSE_MINIMUM &&
      averageRating30d > 0 &&
      averageRating30d < QUALITY_AVERAGE_THRESHOLD);
  const callbackRestrictionRequired =
    overdueCallbackCount >= OVERDUE_CALLBACK_LIMIT ||
    Boolean(
      oldestOverdueAt &&
        now.getTime() - oldestOverdueAt.getTime() >=
          SINGLE_CALLBACK_RESTRICTION_MS,
    );
  const hasNewViolationAfterOverride = Boolean(
    existing?.overrideBaselineAt &&
      ((overdueTasks.some(
        (task) => task.updatedAt.getTime() > existing.overrideBaselineAt!.getTime(),
      ) ||
        (newestViolation?.submittedAt?.getTime() ?? 0) >
          existing.overrideBaselineAt.getTime())),
  );
  const overrideActive = Boolean(existing?.overrideActive && !hasNewViolationAfterOverride);
  const manualRestriction = Boolean(existing?.manualRestriction);

  const status: VoiceComplianceStatus = manualRestriction ||
    (callbackRestrictionRequired && !overrideActive)
    ? "RESTRICTED"
    : overrideActive
      ? "ADMIN_OVERRIDE"
      : overdueCallbackCount >= 2
        ? "WARNING"
        : qualityReviewRequired
          ? "QUALITY_REVIEW"
          : "NORMAL";
  const restrictionReason = manualRestriction
    ? existing?.manualRestrictionReason || "Restricted by an administrator."
    : callbackRestrictionRequired
      ? overdueCallbackCount >= OVERDUE_CALLBACK_LIMIT
        ? `${overdueCallbackCount} overdue customer callback tasks.`
        : "A customer callback has been overdue for more than two hours."
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
      overrideActive: hasNewViolationAfterOverride
        ? false
        : existing?.overrideActive ?? false,
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
  const now = new Date();
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
      payload: eventPayload({ adminId: input.adminId, action: input.action }),
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
  }
  return compliance;
}

export function isVoiceComplianceRestricted(compliance: {
  status?: string | null;
  overrideActive?: boolean | null;
} | null | undefined) {
  return compliance?.status === "RESTRICTED" && !compliance.overrideActive;
}
