import "server-only";

import { Prisma } from "@prisma/client";
import { sendTransactionalSms } from "@/lib/africasTalking";
import {
  buildAdminCriticalSmsMessage,
  resolveAdminCriticalSmsRecipients,
  type AdminCriticalSmsEventType,
} from "@/lib/adminCriticalSmsCore";
import { prisma } from "@/lib/prisma";
import { getOpsBaseUrl } from "@/lib/runtimeUrls";

type AdminCriticalSmsInput = {
  eventType: AdminCriticalSmsEventType;
  entityId: string;
  title: string;
  details: string[];
  actionPath?: string | null;
  payload?: Record<string, unknown>;
};

function providerMessageId(result: unknown) {
  const response = result as {
    SMSMessageData?: { Recipients?: Array<{ messageId?: string }> };
  } | null;
  return response?.SMSMessageData?.Recipients?.[0]?.messageId ?? null;
}

function isDuplicateLog(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function dispatchAdminCriticalSms(input: AdminCriticalSmsInput) {
  const recipients = resolveAdminCriticalSmsRecipients({
    smsNumbers: process.env.ADMIN_NOTIFICATION_SMS_NUMBERS,
    whatsappNumbers: process.env.ADMIN_NOTIFICATION_WHATSAPP_NUMBERS,
    adminPhone: process.env.ADMIN_PHONE,
  });
  if (!recipients.length) {
    console.warn("[admin-critical-sms] skipped: no configured recipients", {
      eventType: input.eventType,
      entityId: input.entityId,
    });
    return { sent: 0, failed: 0, skipped: 1 };
  }

  const actionUrl = input.actionPath
    ? input.actionPath.startsWith("http")
      ? input.actionPath
      : `${getOpsBaseUrl()}${input.actionPath.startsWith("/") ? "" : "/"}${input.actionPath}`
    : null;
  const messageBody = buildAdminCriticalSmsMessage({
    title: input.title,
    details: input.details,
    actionUrl,
  });
  const totals = { sent: 0, failed: 0, skipped: 0 };

  for (const recipientPhone of recipients) {
    const idempotencyKey = `${input.eventType}:${input.entityId}:${recipientPhone}`;
    let logId: string;
    try {
      const log = await prisma.adminCriticalSmsLog.create({
        data: {
          eventType: input.eventType,
          entityId: input.entityId,
          recipientPhone,
          idempotencyKey,
          messageBody,
          actionUrl,
          ...(input.payload
            ? { payloadSnapshot: input.payload as Prisma.InputJsonValue }
            : {}),
        },
        select: { id: true },
      });
      logId = log.id;
    } catch (error) {
      if (isDuplicateLog(error)) {
        totals.skipped += 1;
        continue;
      }
      console.error("[admin-critical-sms] failed to create delivery log", {
        eventType: input.eventType,
        entityId: input.entityId,
        error: error instanceof Error ? error.message : String(error),
      });
      totals.failed += 1;
      continue;
    }

    try {
      const result = await sendTransactionalSms(recipientPhone, messageBody);
      await prisma.adminCriticalSmsLog.update({
        where: { id: logId },
        data: {
          status: "SENT",
          providerMessageId: providerMessageId(result),
          sentAt: new Date(),
          errorMessage: null,
          failedAt: null,
        },
      });
      totals.sent += 1;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await prisma.adminCriticalSmsLog.update({
        where: { id: logId },
        data: {
          status: "FAILED",
          errorMessage: errorMessage.slice(0, 1000),
          failedAt: new Date(),
        },
      }).catch(() => undefined);
      console.error("[admin-critical-sms] delivery failed", {
        eventType: input.eventType,
        entityId: input.entityId,
        recipientPhone,
        error: errorMessage,
      });
      totals.failed += 1;
    }
  }

  return totals;
}

export async function notifyAdminCriticalSms(input: AdminCriticalSmsInput) {
  try {
    return await dispatchAdminCriticalSms(input);
  } catch (error) {
    console.error("[admin-critical-sms] unexpected dispatch failure", {
      eventType: input.eventType,
      entityId: input.entityId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { sent: 0, failed: 1, skipped: 0 };
  }
}
