import { Prisma } from "@prisma/client";
import { z } from "zod";
import { generateFeedbackToken } from "@/lib/feedbackToken";
import { normalizeKenyanPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { getShopBaseUrl } from "@/lib/runtimeUrls";

export const CALL_FEEDBACK_CONTACT_REASONS = [
  "Solar System",
  "Solar Water Pump",
  "Solar Water Heater",
  "Battery",
  "Inverter",
  "Solar Panels",
  "Technical Support",
  "Installation",
  "Quotation",
  "Other",
] as const;

export const CALL_FEEDBACK_STAFF_HELPFUL_OPTIONS = [
  "Very Helpful",
  "Somewhat Helpful",
  "No",
] as const;

export const CALL_FEEDBACK_ANSWER_OPTIONS = ["Yes", "Partially", "No"] as const;
export const CALL_FEEDBACK_RECOMMEND_OPTIONS = ["Definitely", "Maybe", "No"] as const;

const SUCCESS_STATUSES = new Set(["success", "successful", "completed", "complete", "answered"]);
const FEEDBACK_TOKEN_EXPIRY_DAYS = 30;

const boundedText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => sanitizeFeedbackText(value))
    .optional()
    .or(z.literal("").transform(() => undefined));

export const callFeedbackSchema = z.object({
  token: z.string().trim().min(5).max(32),
  rating: z.number().int().min(1).max(5),
  contactReason: z.enum(CALL_FEEDBACK_CONTACT_REASONS),
  staffHelpful: z.enum(CALL_FEEDBACK_STAFF_HELPFUL_OPTIONS),
  questionsAnswered: z.enum(CALL_FEEDBACK_ANSWER_OPTIONS),
  recommend: z.enum(CALL_FEEDBACK_RECOMMEND_OPTIONS),
  comments: boundedText(1200),
  wantsContact: z.boolean().default(false),
  name: boundedText(120),
  phone: boundedText(32),
  email: z
    .string()
    .trim()
    .email()
    .max(160)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type CallFeedbackInput = z.infer<typeof callFeedbackSchema>;

export function isCallFeedbackSchemaMissingError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2021") return false;
  const message = String(error.message || "");
  return (
    message.includes("VoiceCallFeedback") ||
    message.includes("CallFeedback") ||
    message.includes("CallFeedbackSmsLog")
  );
}

export function sanitizeFeedbackText(value: string | null | undefined) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeFeedbackPhone(input?: string | null) {
  return normalizeKenyanPhone(String(input || "").trim()) || null;
}

export function getFeedbackPublicUrl(token: string) {
  return `${getShopBaseUrl()}/feedback/${encodeURIComponent(token)}`;
}

function getFeedbackExpiryDate(now = new Date()) {
  const expires = new Date(now);
  expires.setDate(expires.getDate() + FEEDBACK_TOKEN_EXPIRY_DAYS);
  return expires;
}

function isSuccessfulCallStatus(status: string | null | undefined) {
  return SUCCESS_STATUSES.has(String(status || "").trim().toLowerCase());
}

async function createUniqueFeedbackToken(tx: Prisma.TransactionClient | typeof prisma) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const token = generateFeedbackToken(attempt >= 4 ? 6 : 5);
    const existing = await tx.voiceCallFeedback.findUnique({
      where: { token },
      select: { id: true },
    });
    if (!existing) return token;
  }
  throw new Error("feedback_token_generation_failed");
}

function getCallFeedbackStatus(input: {
  submitted: boolean;
  expiresAt: Date;
  rating?: number | null;
  wantsContact?: boolean | null;
  followUpCreated?: boolean | null;
}) {
  if (!input.submitted && input.expiresAt.getTime() < Date.now()) return "Expired";
  if (!input.submitted) return "Pending";
  if (input.followUpCreated) return "Follow-up created";
  if (input.wantsContact) return "Contact requested";
  if (Number(input.rating || 0) <= 3) return "Low rating";
  return "Submitted";
}

async function resolveFollowUpAssignee(agentId: string | null | undefined) {
  if (!agentId) return null;
  const presence = await prisma.voiceAgentPresence.findUnique({
    where: { userId: agentId },
    select: { status: true, lastSeenAt: true },
  });
  if (!presence) return null;
  if (String(presence.status || "").toUpperCase() !== "AVAILABLE") return null;
  if (!presence.lastSeenAt) return null;
  const ageMs = Date.now() - presence.lastSeenAt.getTime();
  return ageMs <= 5 * 60 * 1000 ? agentId : null;
}

async function createLowRatingFollowUp(tx: Prisma.TransactionClient, session: {
  id: string;
  token: string;
  normalizedPhone: string;
  phoneNumber: string;
  voiceCallId: string | null;
  agentId: string | null;
}, input: CallFeedbackInput) {
  const assignedToId = await resolveFollowUpAssignee(session.agentId);
  const followUp = await tx.voiceFollowUp.create({
    data: {
      voiceCallId: session.voiceCallId,
      assignedToId,
      phone: session.normalizedPhone || session.phoneNumber,
      title: "Customer Service Recovery",
      status: "pending_follow_up",
      dueAt: new Date(),
      notes: [
        "Customer submitted low feedback rating.",
        `Rating: ${input.rating}/5`,
        `Service: ${input.contactReason}`,
        `Helpful: ${input.staffHelpful}`,
        `Questions answered: ${input.questionsAnswered}`,
        `Recommend: ${input.recommend}`,
        input.comments ? `Comment: ${input.comments}` : null,
        `Feedback token: ${session.token}`,
      ]
        .filter(Boolean)
        .join("\n"),
    },
    select: { id: true },
  });
  return followUp.id;
}

export async function ensureVoiceCallFeedbackSession(input: {
  phoneNumber: string;
  voiceCallId?: string | null;
  agentId?: string | null;
  callStartedAt?: Date | null;
  callEndedAt?: Date | null;
}) {
  const normalizedPhone = normalizeFeedbackPhone(input.phoneNumber);
  if (!normalizedPhone) return null;

  if (input.voiceCallId) {
    const existing = await prisma.voiceCallFeedback.findFirst({
      where: { voiceCallId: input.voiceCallId },
    });
    if (existing) return existing;
  }

  const token = await createUniqueFeedbackToken(prisma);
  return prisma.voiceCallFeedback.create({
    data: {
      token,
      phoneNumber: input.phoneNumber,
      normalizedPhone,
      voiceCallId: input.voiceCallId ?? null,
      agentId: input.agentId ?? null,
      callStartedAt: input.callStartedAt ?? null,
      callEndedAt: input.callEndedAt ?? null,
      expiresAt: getFeedbackExpiryDate(),
    },
  });
}

export async function getPublicFeedbackSessionByToken(token: string) {
  const trimmedToken = String(token || "").trim();
  if (!trimmedToken) return null;
  const session = await prisma.voiceCallFeedback.findUnique({
    where: { token: trimmedToken },
    include: {
      voiceCall: {
        select: {
          id: true,
          startedAt: true,
          endedAt: true,
          durationInSeconds: true,
          recordingUrl: true,
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
    state: session.submitted ? "submitted" : isExpired ? "expired" : "active",
  } as const;
}

export async function submitFeedbackByToken(input: CallFeedbackInput) {
  const token = String(input.token || "").trim();
  if (!token) {
    return { ok: false, error: "invalid_token" } as const;
  }

  return prisma.$transaction(async (tx) => {
    const session = await tx.voiceCallFeedback.findUnique({
      where: { token },
      select: {
        id: true,
        token: true,
        submitted: true,
        expiresAt: true,
        normalizedPhone: true,
        phoneNumber: true,
        voiceCallId: true,
        agentId: true,
      },
    });

    if (!session) return { ok: false, error: "invalid_token" } as const;
    if (session.submitted) return { ok: false, error: "already_submitted" } as const;
    if (session.expiresAt.getTime() < Date.now()) return { ok: false, error: "expired_token" } as const;

    let followUpTaskId: string | null = null;
    if (input.rating <= 3) {
      followUpTaskId = await createLowRatingFollowUp(tx, session, input);
    }

    const feedback = await tx.voiceCallFeedback.update({
      where: { token },
      data: {
        rating: input.rating,
        serviceType: input.contactReason,
        staffHelpful: input.staffHelpful,
        questionsAnswered: input.questionsAnswered,
        wouldRecommend: input.recommend,
        comment: input.comments || null,
        customerName: input.name || null,
        customerEmail: input.email || null,
        wantsContact: input.wantsContact,
        submitted: true,
        submittedAt: new Date(),
        followUpCreated: Boolean(followUpTaskId),
        followUpTaskId,
      },
      select: {
        id: true,
        token: true,
        submittedAt: true,
      },
    });

    return { ok: true, feedback } as const;
  });
}

export async function createReplacementFeedbackSession(phone: string) {
  const normalizedPhone = normalizeFeedbackPhone(phone);
  if (!normalizedPhone) return { ok: false, error: "invalid_phone" } as const;

  const recentCalls = await prisma.voiceCall.findMany({
    where: {
      callerNumber: normalizedPhone,
      startedAt: { gte: new Date(Date.now() - FEEDBACK_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000) },
    },
    orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }],
    take: 10,
    select: {
      id: true,
      callerNumber: true,
      assignedToId: true,
      startedAt: true,
      endedAt: true,
      status: true,
    },
  });
  const recentCall = recentCalls.find((call) => isSuccessfulCallStatus(call.status));

  if (!recentCall) return { ok: false, error: "no_recent_call" } as const;
  const session = await ensureVoiceCallFeedbackSession({
    phoneNumber: recentCall.callerNumber,
    voiceCallId: recentCall.id,
    agentId: recentCall.assignedToId,
    callStartedAt: recentCall.startedAt,
    callEndedAt: recentCall.endedAt,
  });
  if (!session) return { ok: false, error: "invalid_phone" } as const;
  return { ok: true, token: session.token, url: getFeedbackPublicUrl(session.token) } as const;
}

function buildFeedbackWhere(filters: {
  rating?: number | null;
  contactReason?: string | null;
  wantsContact?: boolean | null;
  lowRatingOnly?: boolean;
  startDate?: Date | null;
  endDate?: Date | null;
}) {
  const where: Prisma.VoiceCallFeedbackWhereInput = {};

  if (filters.rating) where.rating = Number(filters.rating);
  if (filters.contactReason) where.serviceType = filters.contactReason;
  if (typeof filters.wantsContact === "boolean") where.wantsContact = filters.wantsContact;
  if (filters.lowRatingOnly) where.rating = { lte: 3 };
  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = filters.startDate;
    if (filters.endDate) where.createdAt.lte = filters.endDate;
  }

  return where;
}

export async function listCallFeedback(args: {
  page?: number;
  pageSize?: number;
  rating?: number | null;
  contactReason?: string | null;
  wantsContact?: boolean | null;
  lowRatingOnly?: boolean;
  startDate?: Date | null;
  endDate?: Date | null;
}) {
  const page = Math.max(1, Number(args.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(args.pageSize || 20)));
  const where = buildFeedbackWhere(args);

  const [total, rows] = await Promise.all([
    prisma.voiceCallFeedback.count({ where }),
    prisma.voiceCallFeedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        voiceCall: {
          select: {
            id: true,
            startedAt: true,
            createdAt: true,
            direction: true,
            status: true,
            durationInSeconds: true,
            recordingUrl: true,
            callerNumber: true,
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        agent: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
  ]);

  const items = rows.map((row) => ({
    id: row.id,
    token: row.token,
    phone: row.phoneNumber,
    normalizedPhone: row.normalizedPhone,
    rating: row.rating,
    contactReason: row.serviceType,
    staffHelpful: row.staffHelpful,
    questionsAnswered: row.questionsAnswered,
    recommend: row.wouldRecommend,
    wantsContact: row.wantsContact,
    reviewed: row.followUpCreated,
    createdAt: row.createdAt,
    submittedAt: row.submittedAt,
    smsSent: row.smsSent,
    smsSentAt: row.smsSentAt,
    statusLabel: getCallFeedbackStatus(row),
    latestCall: row.voiceCall,
    agent: row.agent,
    submitted: row.submitted,
    followUpCreated: row.followUpCreated,
  }));

  return { total, page, pageSize, items };
}

export async function getCallFeedbackDetail(id: string) {
  const feedback = await prisma.voiceCallFeedback.findUnique({
    where: { id },
    include: {
      voiceCall: {
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          callNotes: {
            orderBy: { createdAt: "desc" },
            take: 10,
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          followUps: {
            orderBy: { updatedAt: "desc" },
            take: 10,
            include: {
              assignedTo: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      },
      agent: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!feedback) return null;

  const recentCalls = await prisma.voiceCall.findMany({
    where: { callerNumber: feedback.normalizedPhone },
    orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }],
    take: 12,
    include: {
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      callNotes: {
        orderBy: { createdAt: "desc" },
        take: 6,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      followUps: {
        orderBy: { updatedAt: "desc" },
        take: 6,
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  const previousFeedback = await prisma.voiceCallFeedback.findMany({
    where: {
      normalizedPhone: feedback.normalizedPhone,
      submitted: true,
      id: { not: feedback.id },
    },
    orderBy: { submittedAt: "desc" },
    take: 8,
    select: {
      id: true,
      rating: true,
      serviceType: true,
      comment: true,
      submittedAt: true,
      token: true,
    },
  });

  return {
    feedback: {
      ...feedback,
      statusLabel: getCallFeedbackStatus(feedback),
      contactReason: feedback.serviceType,
      recommend: feedback.wouldRecommend,
      comments: feedback.comment,
      name: feedback.customerName,
      email: feedback.customerEmail,
      phone: feedback.phoneNumber,
      callId: feedback.voiceCallId,
    },
    linkedCall: feedback.voiceCall,
    recentCalls,
    previousFeedback,
  };
}
