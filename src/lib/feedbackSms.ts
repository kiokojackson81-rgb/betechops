import type { VoiceCall } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendTransactionalSms } from "@/lib/africasTalking";
import {
  ensureVoiceCallFeedbackSession,
  getFeedbackPublicUrl,
  normalizeFeedbackPhone,
} from "@/lib/callFeedback";

const SUCCESS_STATUSES = new Set(["success", "successful", "completed", "complete", "answered"]);
const INBOUND_ANSWERED_STATUSES = new Set(["answered"]);

function isSuccessfulFeedbackCall(call: Pick<VoiceCall, "direction" | "status" | "durationInSeconds">) {
  const normalizedStatus = String(call.status || "").trim().toLowerCase();
  const duration = Number(call.durationInSeconds || 0);
  if (!(duration > 15)) return false;

  const direction = String(call.direction || "").trim().toUpperCase();
  if (direction === "INBOUND") {
    return INBOUND_ANSWERED_STATUSES.has(normalizedStatus);
  }

  return SUCCESS_STATUSES.has(normalizedStatus);
}

export async function maybeSendCallFeedbackSms(
  call: Pick<
    VoiceCall,
    "id" | "direction" | "callerNumber" | "destinationNumber" | "status" | "durationInSeconds" | "assignedToId" | "startedAt" | "endedAt"
  >,
) {
  const normalizedPhone = normalizeFeedbackPhone(call.callerNumber || call.destinationNumber || "");
  if (!normalizedPhone) return { sent: false, reason: "missing_phone" } as const;
  if (!isSuccessfulFeedbackCall(call)) return { sent: false, reason: "call_not_eligible" } as const;

  const session =
    (await prisma.voiceCallFeedback.findFirst({
      where: {
        voiceCallId: call.id,
      },
    })) ||
    (await ensureVoiceCallFeedbackSession({
      phoneNumber: normalizedPhone,
      voiceCallId: call.id,
      agentId: call.assignedToId,
      callStartedAt: call.startedAt,
      callEndedAt: call.endedAt,
    }));

  if (!session) return { sent: false, reason: "session_not_created" } as const;
  if (session.smsSent) return { sent: false, reason: "already_sent_for_call" } as const;

  const feedbackUrl = getFeedbackPublicUrl(session.token);
  const message = `Thank you for calling Betech Solar Solutions. We value your feedback. Please share your experience with us here: ${feedbackUrl}`;

  await sendTransactionalSms(normalizedPhone, message);
  await prisma.voiceCallFeedback.update({
    where: { id: session.id },
    data: {
      smsSent: true,
      smsSentAt: new Date(),
    },
  });

  return { sent: true, reason: "sent", token: session.token } as const;
}
