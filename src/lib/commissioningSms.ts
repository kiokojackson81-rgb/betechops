import "server-only";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendTransactionalSms } from "@/lib/africasTalking";
import { normalizeProjectPhone } from "@/services/project-notifications/project-notification.formatters";

/** The unique automatic key prevents repeated assignment saves from resending SMS. */
export async function sendCommissioningSms(input: {
  sessionId: string; kind: "TECHNICIAN_LINK" | "CUSTOMER_DOCUMENTS";
  recipientName: string; phone: string | null | undefined; message: string;
  automaticKey: string; manual?: boolean; actorId?: string | null;
}) {
  const phone = normalizeProjectPhone(input.phone) || "";
  const idempotencyKey = input.manual ? `${input.automaticKey}:manual:${randomUUID()}` : input.automaticKey;
  const log = await prisma.commissioningSmsLog.upsert({
    where: { idempotencyKey }, update: {},
    create: { sessionId: input.sessionId, kind: input.kind, recipientName: input.recipientName, phone, message: input.message, idempotencyKey, actorId: input.actorId || null },
  });
  const claimed = await prisma.commissioningSmsLog.updateMany({ where: { id: log.id, status: "PENDING" }, data: { status: "SENDING" } });
  if (!claimed.count) return { status: log.status, reused: true, id: log.id, error: log.error };
  try {
    if (!phone) throw new Error("No valid mobile number is saved for this recipient. Update the phone number and resend.");
    const response = await sendTransactionalSms(phone, input.message) as { SMSMessageData?: { Recipients?: Array<{ messageId?: string }> } };
    await prisma.commissioningSmsLog.update({ where: { id: log.id }, data: { status: "SENT", sentAt: new Date(), providerId: response.SMSMessageData?.Recipients?.[0]?.messageId || null } });
    return { status: "SENT", reused: false, id: log.id };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "SMS delivery failed.";
    await prisma.commissioningSmsLog.update({ where: { id: log.id }, data: { status: "FAILED", error: detail } });
    return { status: "FAILED", reused: false, id: log.id, error: detail };
  }
}
