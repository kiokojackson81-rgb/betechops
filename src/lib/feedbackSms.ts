import type { VoiceCall } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendTransactionalSms } from "@/lib/africasTalking";
import { getFeedbackPublicUrl, normalizeFeedbackPhone } from "@/lib/callFeedback";

const SUCCESS_STATUSES = new Set([
  "success",
  "successful",
  "completed",
  "complete",
  "answered",
]);

function getNairobiDayBounds(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value || "0");
  const month = Number(parts.find((part) => part.type === "month")?.value || "1");
  const day = Number(parts.find((part) => part.type === "day")?.value || "1");
  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - 3 * 60 * 60 * 1000);
  const end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - 3 * 60 * 60 * 1000);
  return { start, end };
}

function isSuccessfulFeedbackCall(call: Pick<VoiceCall, "status" | "durationInSeconds">) {
  const normalizedStatus = String(call.status || "").trim().toLowerCase();
  const duration = Number(call.durationInSeconds || 0);
  return SUCCESS_STATUSES.has(normalizedStatus) && duration > 15;
}

export async function maybeSendCallFeedbackSms(call: Pick<VoiceCall, "id" | "callerNumber" | "destinationNumber" | "status" | "durationInSeconds">) {
  const normalizedPhone = normalizeFeedbackPhone(call.callerNumber || call.destinationNumber || "");
  if (!normalizedPhone) return { sent: false, reason: "missing_phone" } as const;
  if (!isSuccessfulFeedbackCall(call)) return { sent: false, reason: "call_not_eligible" } as const;

  const { start, end } = getNairobiDayBounds();
  const alreadySentToday = await prisma.callFeedbackSmsLog.findFirst({
    where: {
      phone: normalizedPhone,
      sentAt: {
        gte: start,
        lte: end,
      },
    },
    select: { id: true },
  });

  if (alreadySentToday) {
    return { sent: false, reason: "already_sent_today" } as const;
  }

  const feedbackUrl = getFeedbackPublicUrl({
    phone: normalizedPhone,
    callId: call.id,
  });

  const message = `Thank you for calling Betech Solar Solutions. We'd love to hear about your experience. Please take 30 seconds to share your feedback: ${feedbackUrl}`;

  await sendTransactionalSms(normalizedPhone, message);
  await prisma.callFeedbackSmsLog.create({
    data: {
      phone: normalizedPhone,
      callId: call.id,
    },
  });

  return { sent: true, reason: "sent" } as const;
}
