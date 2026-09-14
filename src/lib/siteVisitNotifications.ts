import "server-only";

import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { sendTransactionalSms } from "@/lib/africasTalking";
import { notifyAdminCriticalSms } from "@/lib/adminCriticalSms";
import { sendGeneralCustomerNotificationEmail } from "@/lib/email";
import { normalizeKenyanPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import type { QuoteProjectType } from "@/lib/quoteRequests";
import type { SiteVisitReason } from "@/lib/siteVisitShared";
import {
  generateSiteAssessmentReportPdf,
  reportRecommendationLabel,
  type SiteAssessmentReport,
} from "@/lib/siteAssessmentReport";

type Visit = { id: string; visitRef: string; customerName: string; customerPhone: string; customerEmail?: string | null; county?: string | null; town?: string | null; location?: string | null; landmark?: string | null; projectType?: QuoteProjectType | null; visitReason?: SiteVisitReason | null; assignedTechnicianId?: string | null; assignedTechnicianName?: string | null; scheduledAt?: string | null; estimatedDurationMinutes?: number | null; cancellationReason?: string | null; paymentStatus: string; paymentMethod?: string | null; visitFee: number; dataLoggerRequested: boolean; dataLoggerDays: number; dataLoggerFee: number };
type RecipientType = "CUSTOMER" | "TECHNICIAN";
type NotificationType = "SITE_VISIT_CREATED_CUSTOMER_SMS" | "TECHNICIAN_ASSIGNED_CUSTOMER_SMS" | "TECHNICIAN_ASSIGNED_SMS" | "TECHNICIAN_REASSIGNED_CUSTOMER_SMS" | "TECHNICIAN_REASSIGNED_SMS" | "SITE_VISIT_SCHEDULED_CUSTOMER_SMS" | "SITE_VISIT_SCHEDULED_TECHNICIAN_SMS" | "SITE_VISIT_CANCELLED_CUSTOMER_SMS" | "SITE_ASSESSMENT_REPORT_CUSTOMER_SMS" | "SITE_ASSESSMENT_REPORT_RESENT_CUSTOMER_SMS";

// The apex domain is the registered customer site. The www alias has not
// consistently served customer-account routes, so SMS links must use this URL.
const customerUrl = (id: string) => `https://betech.co.ke/account/site-visits/${id}`;
const customerReportUrl = (id: string) => `https://betech.co.ke/account/site-visits/${id}/report`;
const siteVisitRequestUrl = "https://www.betech.co.ke/site-visit";
const location = (visit: Visit) => [visit.location, visit.landmark, visit.town, visit.county].filter(Boolean).join(", ") || "Location pending";
const providerMessageId = (result: unknown) => (result as { SMSMessageData?: { Recipients?: Array<{ messageId?: string }> } })?.SMSMessageData?.Recipients?.[0]?.messageId ?? null;
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] || character);
const scheduleLabel = (scheduledAt: string | null | undefined) => scheduledAt
  ? new Date(scheduledAt).toLocaleDateString("en-KE", { dateStyle: "medium" })
  : null;
const paymentLabel = (visit: Visit) => {
  if (visit.paymentStatus === "PAID") return "Paid";
  if (visit.paymentStatus === "WAIVED") return "Waived";
  if (visit.paymentStatus === "COLLECT_ON_SITE") return "Collect on site";
  return "Customer M-Pesa payment pending";
};
const customerPaymentNote = (visit: Visit) => {
  if (visit.paymentStatus === "PAID") return "Your site visit fee is already paid.";
  if (visit.paymentStatus === "WAIVED") return "Your site visit fee has been waived.";
  if (visit.paymentStatus === "COLLECT_ON_SITE") return `KSh ${visit.visitFee.toLocaleString("en-KE")} will be collected on site and may be credited to your final quotation if you proceed.`;
  return `A KSh ${visit.visitFee.toLocaleString("en-KE")} M-Pesa PayBill payment is pending. If you selected pay now, check your phone for the prompt. The fee may be credited to your final quotation if you proceed.`;
};

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
  await notifyAdminCriticalSms({ eventType: "SITE_VISIT_REQUESTED", entityId: visit.id, title: `New Site Visit Booking ${visit.visitRef}`, details: [`Customer: ${visit.customerName}`, `Phone: ${visit.customerPhone}`, `Location: ${location(visit)}`, `Requested by: ${requestedBy || "Customer"}`, "Technician: Pending Assignment", `Site Visit Fee: KSh ${visit.visitFee.toLocaleString("en-KE")}`, `Payment: ${paymentLabel(visit)}`, visit.dataLoggerRequested ? `Data Logger: ${visit.dataLoggerDays} day(s)` : "Data Logger: None"], actionPath: `/admin/quotation-center/site-visits/${visit.id}`, payload: { visitRef: visit.visitRef, notificationType: "SITE_VISIT_CREATED_ADMIN_SMS" } });
  const message = `Your site visit ${visit.visitRef} is booked and pending technician assignment. ${customerPaymentNote(visit)} Once assigned, the technician will contact you. Track: ${customerUrl(visit.id)}`;
  return sendOnce({ visitId: visit.id, type: "SITE_VISIT_CREATED_CUSTOMER_SMS", recipient: visit.customerPhone, recipientType: "CUSTOMER", message, version: "created" });
}

export async function dispatchSiteVisitTechnicianAssignment(visit: Visit, previousTechnicianId?: string | null) {
  if (!visit.assignedTechnicianId || !visit.assignedTechnicianName) return;
  const reassigned = Boolean(previousTechnicianId);
  const version = `${visit.assignedTechnicianId}:${visit.scheduledAt || "unscheduled"}`;
  const schedule = scheduleLabel(visit.scheduledAt);
  const phone = await technicianPhone(visit);
  const technicianContact = phone ? ` (${phone})` : "";
  const customerMessage = reassigned
    ? `Your assigned technician for site visit ${visit.visitRef} has changed. Your new technician is ${visit.assignedTechnicianName}${technicianContact} and will contact you to arrange the visit. Track: ${customerUrl(visit.id)}`
    : schedule
      ? `Your site visit ${visit.visitRef} is confirmed for ${schedule}. Technician: ${visit.assignedTechnicianName}${technicianContact}. The technician will contact you before travelling to site. Track: ${customerUrl(visit.id)}`
      : `A technician has been assigned to your site visit ${visit.visitRef}. Technician: ${visit.assignedTechnicianName}${technicianContact}. The technician will contact you to arrange the visit. ${customerPaymentNote(visit)} Track: ${customerUrl(visit.id)}`;
  const technicianPaymentNote = visit.paymentStatus === "PAID" || visit.paymentStatus === "WAIVED"
    ? "Do not collect a site visit fee."
    : visit.paymentStatus === "COLLECT_ON_SITE"
      ? `Collect KSh ${visit.visitFee.toLocaleString("en-KE")} on site.`
      : "Customer M-Pesa payment is pending; do not collect unless the admin confirms a change.";
  const technicianMessage = `[BETECH FIELD] Site Visit Assigned: ${visit.visitRef}\nCustomer: ${visit.customerName}\nTel: ${visit.customerPhone}\nLocation: ${location(visit)}\nContact the customer to arrange and conduct the site visit. ${technicianPaymentNote} Submit the site assessment report for quotation preparation.${visit.dataLoggerRequested ? ` Data Logger: ${visit.dataLoggerDays} day(s) - install/collect as specified.` : ""}\nOpen: https://ops.betech.co.ke/technical/site-visits/${visit.id}`;
  await Promise.allSettled([sendOnce({ visitId: visit.id, type: reassigned ? "TECHNICIAN_REASSIGNED_CUSTOMER_SMS" : "TECHNICIAN_ASSIGNED_CUSTOMER_SMS", recipient: visit.customerPhone, recipientType: "CUSTOMER", message: customerMessage, version }), phone ? sendOnce({ visitId: visit.id, type: reassigned ? "TECHNICIAN_REASSIGNED_SMS" : "TECHNICIAN_ASSIGNED_SMS", recipient: phone, recipientType: "TECHNICIAN", message: technicianMessage, version }) : Promise.resolve({ status: "SKIPPED" })]);
}

export async function dispatchSiteVisitScheduleConfirmation(visit: Visit) {
  if (!visit.assignedTechnicianId || !visit.assignedTechnicianName || !visit.scheduledAt) return;
  const schedule = scheduleLabel(visit.scheduledAt);
  if (!schedule) return;
  const phone = await technicianPhone(visit);
  const duration = visit.estimatedDurationMinutes ? ` Expected duration: ${visit.estimatedDurationMinutes} minutes.` : "";
  const customerMessage = `Your site visit ${visit.visitRef} is confirmed for ${schedule}. Technician: ${visit.assignedTechnicianName}${phone ? ` (${phone})` : ""}. The technician will contact you before travelling to site.${duration} Track: ${customerUrl(visit.id)}`;
  const technicianMessage = `[BETECH FIELD] Site Visit Schedule Confirmed: ${visit.visitRef}\nCustomer: ${visit.customerName}\nTel: ${visit.customerPhone}\nDate: ${schedule}${duration}\nLocation: ${location(visit)}\nOpen: https://ops.betech.co.ke/technical/site-visits/${visit.id}`;
  const version = `${visit.assignedTechnicianId}:${visit.scheduledAt}`;
  await Promise.allSettled([
    sendOnce({ visitId: visit.id, type: "SITE_VISIT_SCHEDULED_CUSTOMER_SMS", recipient: visit.customerPhone, recipientType: "CUSTOMER", message: customerMessage, version }),
    phone ? sendOnce({ visitId: visit.id, type: "SITE_VISIT_SCHEDULED_TECHNICIAN_SMS", recipient: phone, recipientType: "TECHNICIAN", message: technicianMessage, version }) : Promise.resolve({ status: "SKIPPED" }),
  ]);
}

export async function dispatchSiteVisitCancellation(visit: Visit) {
  const reason = String(visit.cancellationReason || "Cancellation requested").trim();
  return sendOnce({
    visitId: visit.id,
    type: "SITE_VISIT_CANCELLED_CUSTOMER_SMS",
    recipient: visit.customerPhone,
    recipientType: "CUSTOMER",
    message: `Your site visit ${visit.visitRef} has been cancelled. Reason: ${reason}. You can request a new site visit when ready: ${siteVisitRequestUrl}`,
    version: `cancelled:${reason}`,
  });
}

export async function dispatchSiteAssessmentReportPublished(
  visit: Visit,
  report: SiteAssessmentReport,
  options: { resend?: boolean; deliveryVersion?: string } = {},
) {
  const reportUrl = customerReportUrl(visit.id);
  const recommendation = reportRecommendationLabel(report);
  const sms = sendOnce({
    visitId: visit.id,
    type: options.resend ? "SITE_ASSESSMENT_REPORT_RESENT_CUSTOMER_SMS" : "SITE_ASSESSMENT_REPORT_CUSTOMER_SMS",
    recipient: visit.customerPhone,
    recipientType: "CUSTOMER",
    message: `Your site assessment report for ${visit.visitRef} is ${options.resend ? "available again" : "ready"}. Recommendation: ${recommendation}. View it securely in your account: ${reportUrl}`,
    version: options.deliveryVersion || report.submittedAt,
  });
  const email = String(visit.customerEmail || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { sms: await sms, email: "SKIPPED" as const };
  }
  try {
    const pdf = await generateSiteAssessmentReportPdf({
      visitRef: visit.visitRef,
      customerName: visit.customerName,
      location: location(visit),
      projectType: visit.projectType,
      visitReason: visit.visitReason,
      report,
    });
    await sendGeneralCustomerNotificationEmail({
      to: email,
      subject: `${options.resend ? "Your Betech site assessment report — resent" : "Your Betech site assessment report"} — ${visit.visitRef}`,
      title: options.resend ? "Your site assessment report has been sent again" : "Your site assessment report is ready",
      intro: `Hello ${visit.customerName},`,
      bodyHtml: `<p>Our field assessment for <strong>${escapeHtml(visit.visitRef)}</strong> is complete.</p><p><strong>Recommendation:</strong> ${escapeHtml(recommendation)}</p>${report.recommendation.notes ? `<p>${escapeHtml(report.recommendation.notes)}</p>` : ""}<p>Your report is attached as a PDF and is also available securely in your Betech account.</p>`,
      bodyText: `Our field assessment for ${visit.visitRef} is complete. Recommendation: ${recommendation}.${report.recommendation.notes ? ` ${report.recommendation.notes}` : ""} View your report securely: ${reportUrl}`,
      ctaLabel: "View your report",
      ctaUrl: reportUrl,
      attachments: [{ filename: `${visit.visitRef}-site-assessment-report.pdf`, content: pdf, contentType: "application/pdf" }],
    });
    return { sms: await sms, email: "SENT" as const };
  } catch (error) {
    console.error("[site-assessment-report.email] delivery failed", { visitId: visit.id, error });
    return { sms: await sms, email: "FAILED" as const };
  }
}

export async function notifySiteVisitCustomer(input: { event: string; customerName: string; phone?: string | null; email?: string | null; visitRef: string; detail?: string | null }) {
  if (input.phone) await sendTransactionalSms(input.phone, `Site visit ${input.visitRef} ${input.event.replace(/_/g, " ").toLowerCase()}.${input.detail ? ` ${input.detail}` : ""}`).catch(() => undefined);
}
