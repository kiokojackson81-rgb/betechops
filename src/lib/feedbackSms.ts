import type { VoiceCall } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ensureVoiceCallFeedbackSession,
  getFeedbackPublicUrl,
  normalizeFeedbackPhone,
} from "@/lib/callFeedback";
import { isInternalVoicePhone, sendVoiceSmsOncePerDay } from "@/lib/voiceSmsNotifications";

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
  const targetPhone =
    String(call.direction || "").trim().toUpperCase() === "OUTBOUND"
      ? call.destinationNumber || call.callerNumber || ""
      : call.callerNumber || call.destinationNumber || "";
  const normalizedPhone = normalizeFeedbackPhone(targetPhone);
  if (!normalizedPhone) return { sent: false, reason: "missing_phone" } as const;
  if (isInternalVoicePhone(normalizedPhone)) return { sent: false, reason: "internal_phone" } as const;
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

  const sendResult = await sendVoiceSmsOncePerDay({
    phoneNumber: targetPhone,
    normalizedPhoneNumber: normalizedPhone,
    notificationType: "CALL_FEEDBACK_SMS",
    voiceCallId: call.id,
    messageBody: message,
  });

  if (!sendResult.sent) {
    return sendResult;
  }

  await prisma.voiceCallFeedback.update({
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
