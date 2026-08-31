import "server-only";

import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { sendTransactionalSms } from "@/lib/africasTalking";
import { notifyAdminCriticalSms } from "@/lib/adminCriticalSms";
import { normalizeKenyanPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

type Visit = { id: string; visitRef: string; customerName: string; customerPhone: string; county?: string | null; town?: string | null; location?: string | null; landmark?: string | null; assignedTechnicianId?: string | null; assignedTechnicianName?: string | null; scheduledAt?: string | null; paymentStatus: string; visitFee: number; dataLoggerRequested: boolean; dataLoggerDays: number; dataLoggerFee: number };
type RecipientType = "CUSTOMER" | "TECHNICIAN";
type NotificationType = "SITE_VISIT_CREATED_CUSTOMER_SMS" | "TECHNICIAN_ASSIGNED_CUSTOMER_SMS" | "TECHNICIAN_ASSIGNED_SMS" | "TECHNICIAN_REASSIGNED_CUSTOMER_SMS" | "TECHNICIAN_REASSIGNED_SMS";

const customerUrl = (id: string) => `https://www.betech.co.ke/account/site-visits/${id}`;
const location = (visit: Visit) => [visit.location, visit.landmark, visit.town, visit.county].filter(Boolean).join(", ") || "Location pending";
const providerMessageId = (result: unknown) => (result as { SMSMessageData?: { Recipients?: Array<{ messageId?: string }> } })?.SMSMessageData?.Recipients?.[0]?.messageId ?? null;

async function sendOnce(input: { visitId: string; type: NotificationType; recipient: string; recipientType: RecipientType; message: string; version: string }) {
  const phone = normalizeKenyanPhone(input.recipient);
  if (!phone) return { status: "SKIPPED" };
  const idempotencyKey = `${input.type}:${input.visitId}:${input.version}:${phone}`;
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`INSERT INTO "SiteVisitNotification" ("id", "siteVisitId", "recipient", "recipientType", "notificationType", "messageBody", "idempotencyKey", "status") VALUES (${randomUUID()}, ${input.visitId}, ${phone}, ${input.recipientType}, ${input.type}, ${input.message}, ${idempotencyKey}, 'PENDING') ON CONFLICT ("idempotencyKey") DO NOTHING RETURNING "id"`).catch(() => []);
  const id = rows[0]?.id;
  if (!id) return { status: "SKIPPED" };
  try {
    const response = await sendTransactionalSms(phone, input.message);
    await prisma.$executeRaw(Prisma.sql`UPDATE "SiteVisitNotification" SET "status" = 'SENT', "providerMessageId" = ${providerMessageId(response)}, "sentAt" = CURRENT_TIMESTAMP, "failureReason" = NULL WHERE "id" = ${id}`);
    return { status: "SENT" };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await prisma.$executeRaw(Prisma.sql`UPDATE "SiteVisitNotification" SET "status" = 'FAILED', "failureReason" = ${reason.slice(0, 1000)} WHERE "id" = ${id}`).catch(() => undefined);
    console.error("[site-visit-sms] delivery failed", { visitId: input.visitId, type: input.type, recipientType: input.recipientType, reason });
    return { status: "FAILED" };
  }
}

async function technicianPhone(visit: Visit) {
  const id = String(visit.assignedTechnicianId || "");
  if (!id) return null;
  if (id.startsWith("external:")) return (await prisma.projectExternalAgent.findUnique({ where: { id: id.slice(9) }, select: { whatsappNumber: true } }))?.whatsappNumber || null;
  const user = await prisma.user.findUnique({ where: { id }, select: { phone: true, whatsappNumber: true } });
  return user?.whatsappNumber || user?.phone || null;
}

export async function dispatchSiteVisitCreated(visit: Visit, requestedBy?: string | null) {
  await notifyAdminCriticalSms({ eventType: "SITE_VISIT_REQUESTED", entityId: visit.id, title: `New Site Visit Booking ${visit.visitRef}`, details: [`Customer: ${visit.customerName}`, `Phone: ${visit.customerPhone}`, `Location: ${location(visit)}`, `Requested by: ${requestedBy || "Customer"}`, "Technician: Pending Assignment", "Site Visit Fee: KSh 2,000", `Payment: ${visit.paymentStatus === "PAID" ? "Paid" : "Collect on Site"}`, visit.dataLoggerRequested ? `Data Logger: ${visit.dataLoggerDays} day(s)` : "Data Logger: None"], actionPath: `/admin/quotation-center/site-visits/${visit.id}`, payload: { visitRef: visit.visitRef, notificationType: "SITE_VISIT_CREATED_ADMIN_SMS" } });
  const message = `Betech Solar: Your site visit ${visit.visitRef} has been booked and is pending technician assignment. A KSh 2,000 site visit fee will be required and deducted from your final quotation if you proceed with Betech. Once assigned, our technician will contact you. Track: ${customerUrl(visit.id)}`;
  return sendOnce({ visitId: visit.id, type: "SITE_VISIT_CREATED_CUSTOMER_SMS", recipient: visit.customerPhone, recipientType: "CUSTOMER", message, version: "created" });
}

export async function dispatchSiteVisitTechnicianAssignment(visit: Visit, previousTechnicianId?: string | null) {
  if (!visit.assignedTechnicianId || !visit.assignedTechnicianName) return;
  const reassigned = Boolean(previousTechnicianId);
  const version = `${visit.assignedTechnicianId}:${visit.scheduledAt || "unscheduled"}`;
  const schedule = visit.scheduledAt ? new Date(visit.scheduledAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }) : null;
  const customerMessage = reassigned ? `Betech Solar: Your assigned technician for site visit ${visit.visitRef} has changed. Your new technician is ${visit.assignedTechnicianName} and will contact you to arrange the visit. Track: ${customerUrl(visit.id)}` : schedule ? `Betech Solar: Your site visit ${visit.visitRef} is confirmed for ${schedule}. Technician: ${visit.assignedTechnicianName}. The technician will contact you before travelling to site. Track: ${customerUrl(visit.id)}` : `Betech Solar: A technician has been assigned to your site visit ${visit.visitRef}. Technician: ${visit.assignedTechnicianName}. The technician will contact you to arrange the visit. ${visit.paymentStatus === "PAID" ? "Site visit fee already paid." : "KSh 2,000 is payable after the site visit and is deductible from your final quotation if you proceed with Betech."} Track: ${customerUrl(visit.id)}`;
  const technicianMessage = `[BETECH FIELD] Site Visit Assigned: ${visit.visitRef}\nCustomer: ${visit.customerName}\nTel: ${visit.customerPhone}\nLocation: ${location(visit)}\nContact the customer to arrange and conduct the site visit. ${visit.paymentStatus === "PAID" ? "Site visit fee already paid - do not collect payment." : "Collect KSh 2,000 at the end of the site visit."} Submit the site assessment report for quotation preparation.${visit.dataLoggerRequested ? ` Data Logger: ${visit.dataLoggerDays} day(s) - install/collect as specified.` : ""}\nOpen: https://ops.betech.co.ke/technical/site-visits/${visit.id}`;
  const phone = await technicianPhone(visit);
  await Promise.allSettled([sendOnce({ visitId: visit.id, type: reassigned ? "TECHNICIAN_REASSIGNED_CUSTOMER_SMS" : "TECHNICIAN_ASSIGNED_CUSTOMER_SMS", recipient: visit.customerPhone, recipientType: "CUSTOMER", message: customerMessage, version }), phone ? sendOnce({ visitId: visit.id, type: reassigned ? "TECHNICIAN_REASSIGNED_SMS" : "TECHNICIAN_ASSIGNED_SMS", recipient: phone, recipientType: "TECHNICIAN", message: technicianMessage, version }) : Promise.resolve({ status: "SKIPPED" })]);
}

export async function notifySiteVisitCustomer(input: { event: string; customerName: string; phone?: string | null; email?: string | null; visitRef: string; detail?: string | null }) {
  if (input.phone) await sendTransactionalSms(input.phone, `Betech Solar: Site visit ${input.visitRef} ${input.event.replace(/_/g, " ").toLowerCase()}.${input.detail ? ` ${input.detail}` : ""}`).catch(() => undefined);
}
