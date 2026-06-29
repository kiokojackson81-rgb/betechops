import type { VoiceCall, VoiceSmsNotificationType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { sendTransactionalSms } from "@/lib/africasTalking";
import { normalizeKenyanPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

const NAIROBI_TIMEZONE = "Africa/Nairobi";
const VOICE_SMS_PROVIDER = "AFRICASTALKING";
const MISSED_CALL_STATUSES = new Set([
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

const WORKING_HOURS_MISSED_CALL_SMS =
  "Thank you for calling Betech Solar Solutions. We sincerely apologize for missing your call. Your call is important to us, and we will call you back shortly. Thank you for your patience.";
const AFTER_HOURS_MISSED_CALL_SMS =
  "Thank you for calling Betech Solar Solutions. We sincerely apologize for missing your call. Our office is currently closed, but your call is important to us. We will call you back during our next working hours. Thank you for your patience.";

type VoiceSmsEligibleCall = Pick<
  VoiceCall,
  "id" | "direction" | "callerNumber" | "destinationNumber" | "status" | "durationInSeconds" | "startedAt"
>;

type SendNotificationResult =
  | { sent: true; reason: "sent"; providerMessageId: string | null }
  | { sent: false; reason: string };

function formatNairobiDayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: NAIROBI_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
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

export function isInternalVoicePhone(phone: string | null | undefined) {
  const normalized = normalizeKenyanPhone(String(phone || "").trim());
  if (!normalized) return false;
  return getInternalVoiceNumbers().has(normalized);
}

function isWithinVoiceWorkingHours(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: NAIROBI_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const weekday = String(parts.weekday || "");
  const hour = Number(parts.hour || "0");
  const minute = Number(parts.minute || "0");
  const totalMinutes = hour * 60 + minute;

  if (weekday === "Sun") return false;
  if (weekday === "Sat") return totalMinutes >= 9 * 60 && totalMinutes <= 15 * 60;
  return totalMinutes >= 9 * 60 && totalMinutes <= 17 * 60 + 30;
}

function getCustomerPhoneForCall(call: VoiceSmsEligibleCall) {
  const direction = String(call.direction || "").trim().toUpperCase();
  const candidate = direction === "OUTBOUND" ? call.destinationNumber || call.callerNumber : call.callerNumber;
  const normalized = normalizeKenyanPhone(String(candidate || "").trim());
  if (!normalized) return null;
  if (isInternalVoicePhone(normalized)) return null;
  return normalized;
}

function isMissedCallSmsEligible(call: VoiceSmsEligibleCall) {
  const direction = String(call.direction || "").trim().toUpperCase();
  const normalizedStatus = String(call.status || "").trim().toLowerCase();
  if (direction !== "INBOUND") return false;
  if (!MISSED_CALL_STATUSES.has(normalizedStatus)) return false;
  if (Number(call.durationInSeconds ?? 0) > 0) return false;
  return Boolean(getCustomerPhoneForCall(call));
}

function extractProviderMessageId(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const recipients = (payload as { SMSMessageData?: { Recipients?: unknown } }).SMSMessageData?.Recipients;
  if (!Array.isArray(recipients) || !recipients.length) return null;
  const first = recipients[0];
  if (!first || typeof first !== "object") return null;
  const messageId = (first as { messageId?: unknown }).messageId;
  return typeof messageId === "string" && messageId.trim() ? messageId.trim() : null;
}

async function reserveVoiceSmsNotification(input: {
  phoneNumber: string;
  normalizedPhoneNumber: string;
  notificationType: VoiceSmsNotificationType;
  voiceCallId: string | null;
  messageBody: string;
}) {
  const dayKey = formatNairobiDayKey();

  if (input.voiceCallId) {
    const existingForCall = await prisma.voiceSmsNotificationLog.findFirst({
      where: {
        voiceCallId: input.voiceCallId,
        notificationType: input.notificationType,
      },
      select: { id: true },
    });
    if (existingForCall) {
      return { ok: false as const, reason: "already_processed_for_call" };
    }
  }

  try {
    const log = await prisma.voiceSmsNotificationLog.create({
      data: {
        phoneNumber: input.phoneNumber,
        normalizedPhoneNumber: input.normalizedPhoneNumber,
        notificationType: input.notificationType,
        voiceCallId: input.voiceCallId,
        messageBody: input.messageBody,
        provider: VOICE_SMS_PROVIDER,
        status: "PROCESSING",
        dayKey,
      },
    });

    const existingSent = await prisma.voiceSmsNotificationLog.findFirst({
      where: {
        id: { not: log.id },
        normalizedPhoneNumber: input.normalizedPhoneNumber,
        notificationType: input.notificationType,
        dayKey,
        status: "SENT",
      },
      orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
    });

    if (!existingSent) {
      return { ok: true as const, logId: log.id };
    }

    await prisma.voiceSmsNotificationLog.update({
      where: { id: log.id },
      data: {
        status: "SKIPPED_DUPLICATE",
        reason: "already_sent_today",
      },
    });
    return { ok: false as const, reason: "already_sent_today" };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false as const, reason: "already_processed_for_call" };
    }
    throw error;
  }
}

async function completeVoiceSmsNotification(input: {
  logId: string;
  status: "SENT" | "FAILED";
  providerMessageId?: string | null;
  reason?: string | null;
  sentAt?: Date | null;
}) {
  await prisma.voiceSmsNotificationLog.update({
    where: { id: input.logId },
    data: {
      status: input.status,
      providerMessageId: input.providerMessageId ?? null,
      reason: input.reason ?? null,
      sentAt: input.sentAt ?? null,
    },
  });
}

export async function sendVoiceSmsOncePerDay(input: {
  phoneNumber: string;
  normalizedPhoneNumber: string;
  notificationType: VoiceSmsNotificationType;
  voiceCallId?: string | null;
  messageBody: string;
}): Promise<SendNotificationResult> {
  const reservation = await reserveVoiceSmsNotification({
    phoneNumber: input.phoneNumber,
    normalizedPhoneNumber: input.normalizedPhoneNumber,
    notificationType: input.notificationType,
    voiceCallId: input.voiceCallId ?? null,
    messageBody: input.messageBody,
  });

  if (!reservation.ok) {
    return { sent: false, reason: reservation.reason };
  }

  try {
    const providerPayload = await sendTransactionalSms(input.normalizedPhoneNumber, input.messageBody);
    const providerMessageId = extractProviderMessageId(providerPayload);
    await completeVoiceSmsNotification({
      logId: reservation.logId,
      status: "SENT",
      providerMessageId,
      sentAt: new Date(),
    });
    return { sent: true, reason: "sent", providerMessageId };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await completeVoiceSmsNotification({
      logId: reservation.logId,
      status: "FAILED",
      reason,
    });
    throw error;
  }
}

export async function maybeSendMissedCallSms(call: VoiceSmsEligibleCall) {
  if (!isMissedCallSmsEligible(call)) {
    return { sent: false, reason: "call_not_eligible" } as const;
  }

  const normalizedPhone = getCustomerPhoneForCall(call);
  if (!normalizedPhone) {
    return { sent: false, reason: "missing_external_phone" } as const;
  }

  const messageBody = isWithinVoiceWorkingHours(call.startedAt ?? new Date())
    ? WORKING_HOURS_MISSED_CALL_SMS
    : AFTER_HOURS_MISSED_CALL_SMS;

  try {
    return await sendVoiceSmsOncePerDay({
      phoneNumber: call.callerNumber,
      normalizedPhoneNumber: normalizedPhone,
      notificationType: "MISSED_CALL_SMS",
      voiceCallId: call.id,
      messageBody,
    });
  } catch (error) {
    console.error("[voice.sms.missed_call_failed]", {
      callId: call.id,
      phone: normalizedPhone,
      error: error instanceof Error ? error.message : String(error),
    });
    return { sent: false, reason: "provider_failed" } as const;
  }
}
