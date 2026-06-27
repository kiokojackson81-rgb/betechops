import { Prisma } from "@prisma/client";
import { z } from "zod";
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
  "Yes, very helpful",
  "Somewhat helpful",
  "No",
] as const;

export const CALL_FEEDBACK_ANSWER_OPTIONS = ["Yes", "Partially", "No"] as const;
export const CALL_FEEDBACK_RECOMMEND_OPTIONS = ["Definitely", "Maybe", "No"] as const;

const boundedText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => sanitizeFeedbackText(value))
    .optional()
    .or(z.literal("").transform(() => undefined));

export const callFeedbackSchema = z
  .object({
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
    callId: boundedText(120),
  })
  .superRefine((value, ctx) => {
    if (value.wantsContact) {
      const normalizedPhone = normalizeKenyanPhone(value.phone || "");
      if (!normalizedPhone) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["phone"],
          message: "Phone number is required when contact follow-up is requested.",
        });
      }
    }
  });

export type CallFeedbackInput = z.infer<typeof callFeedbackSchema>;

export function sanitizeFeedbackText(value: string | null | undefined) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeFeedbackPhone(input?: string | null) {
  return normalizeKenyanPhone(String(input || "").trim()) || null;
}

export function getCallFeedbackStatus(input: {
  wantsContact: boolean;
  rating: number;
  reviewed?: boolean | null;
}) {
  if (input.reviewed) return "Reviewed";
  if (input.wantsContact) return "Contact requested";
  if (Number(input.rating) <= 2) return "Low rating";
  return "No follow-up needed";
}

function buildFeedbackWhere(filters: {
  rating?: number | null;
  contactReason?: string | null;
  wantsContact?: boolean | null;
  lowRatingOnly?: boolean;
  startDate?: Date | null;
  endDate?: Date | null;
}) {
  const where: Prisma.CallFeedbackWhereInput = {};

  if (filters.rating) where.rating = Number(filters.rating);
  if (filters.contactReason) where.contactReason = filters.contactReason;
  if (typeof filters.wantsContact === "boolean") where.wantsContact = filters.wantsContact;
  if (filters.lowRatingOnly) where.rating = { lte: 2 };
  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = filters.startDate;
    if (filters.endDate) where.createdAt.lte = filters.endDate;
  }

  return where;
}

async function getLatestCallForPhone(phone: string | null) {
  if (!phone) return null;
  return prisma.voiceCall.findFirst({
    where: {
      callerNumber: phone,
    },
    orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      sessionId: true,
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
  });
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
    prisma.callFeedback.count({ where }),
    prisma.callFeedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const items = await Promise.all(
    rows.map(async (row) => {
      const normalizedPhone = normalizeFeedbackPhone(row.phone);
      const latestCall = await getLatestCallForPhone(normalizedPhone);
      return {
        ...row,
        normalizedPhone,
        statusLabel: getCallFeedbackStatus(row),
        latestCall,
      };
    }),
  );

  return {
    total,
    page,
    pageSize,
    items,
  };
}

export async function getCallFeedbackDetail(id: string) {
  const feedback = await prisma.callFeedback.findUnique({
    where: { id },
  });

  if (!feedback) return null;

  const normalizedPhone = normalizeFeedbackPhone(feedback.phone);
  const linkedCall = feedback.callId
    ? await prisma.voiceCall.findFirst({
        where: {
          OR: [{ id: feedback.callId }, { sessionId: feedback.callId }],
        },
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
      })
    : null;

  const recentCalls = normalizedPhone
    ? await prisma.voiceCall.findMany({
        where: {
          callerNumber: normalizedPhone,
        },
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
      })
    : [];

  return {
    feedback: {
      ...feedback,
      normalizedPhone,
      statusLabel: getCallFeedbackStatus(feedback),
    },
    linkedCall,
    recentCalls,
  };
}

export function getFeedbackPublicUrl(args: { phone?: string | null; callId?: string | null }) {
  const params = new URLSearchParams();
  const normalizedPhone = normalizeFeedbackPhone(args.phone);
  if (normalizedPhone) params.set("phone", normalizedPhone.replace(/^\+/, ""));
  if (args.callId) params.set("callId", String(args.callId).trim());
  const query = params.toString();
  return `${getShopBaseUrl()}/feedback${query ? `?${query}` : ""}`;
}
