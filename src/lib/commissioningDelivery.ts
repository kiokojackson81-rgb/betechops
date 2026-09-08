import { prisma } from "@/lib/prisma";
import { sendTransactionalSms } from "@/lib/africasTalking";
import { sendGeneralCustomerNotificationEmail } from "@/lib/email";
import { sendWhatsAppTextMessage, hasWhatsAppConfig } from "@/lib/notifications/whatsapp";
import { sanitizeWhatsAppPhone, isValidEmailAddress, normalizeProjectPhone } from "@/services/project-notifications/project-notification.formatters";
import {
  appendCommissioningAudit,
  createCommissioningToken,
  encryptCommissioningToken,
  hashCommissioningToken,
} from "@/lib/commissioning";
import { buildCommissioningCertificatePdf } from "@/lib/commissioningCertificate";

export async function ensureCustomerCertificateToken(sessionId: string) {
  const session = await prisma.commissioningSession.findUnique({ where: { id: sessionId }, select: { id: true, customerTokenCiphertext: true } });
  if (!session) throw new Error("Commissioning session not found.");
  if (session.customerTokenCiphertext) return null;
  const token = createCommissioningToken();
  await prisma.commissioningSession.update({
    where: { id: session.id },
    data: { customerTokenHash: hashCommissioningToken(token), customerTokenCiphertext: encryptCommissioningToken(token) },
  });
  return token;
}

export async function sendCustomerCertificateDelivery(input: {
  sessionId: string;
  certificateUrl: string;
  actorId?: string | null;
}) {
  const session = await prisma.commissioningSession.findUnique({
    where: { id: input.sessionId },
    include: {
      technician: { select: { name: true } },
      receipt: { select: { receiptNumber: true, data: true, order: { select: { orderNumber: true, customerName: true, customerPhone: true, customerEmail: true, metadata: true } } } },
    },
  });
  if (!session || session.status !== "ISSUED") throw new Error("Only an issued certificate can be sent to the customer.");
  const name = session.receipt.order?.customerName || "Customer";
  const reference = session.receipt.receiptNumber || session.receipt.order?.orderNumber || "your project";
  const message = `Hello ${name}, your Betech Solar Completion & Commissioning Certificate for ${reference} is ready. Download it securely here: ${input.certificateUrl}`;
  const phone = normalizeProjectPhone(session.receipt.order?.customerPhone);
  const email = session.receipt.order?.customerEmail || "";
  const pdf = await buildCommissioningCertificatePdf(session);
  const filename = `${(session.certificateNo || reference).replace(/[^a-zA-Z0-9_-]+/g, "-")}-certificate.pdf`;
  const jobs: Array<Promise<unknown>> = [];
  const labels: string[] = [];
  if (phone) { jobs.push(sendTransactionalSms(phone, message)); labels.push("sms"); }
  if (phone && hasWhatsAppConfig()) {
    jobs.push(sendWhatsAppTextMessage({ to: sanitizeWhatsAppPhone(phone), body: message, previewUrl: true })); labels.push("whatsapp");
  }
  if (isValidEmailAddress(email)) {
    jobs.push(sendGeneralCustomerNotificationEmail({
      to: email,
      subject: `Your Betech Solar completion certificate — ${reference}`,
      title: "Your installation certificate is ready",
      intro: `Hello ${name},`,
      bodyHtml: `<p>Your Solar PV Completion & Commissioning Certificate is ready for download.</p><p>The certificate is attached to this email and remains available from your Betech customer account.</p>`,
      bodyText: `${message}\n\nThe certificate is attached to this email and is available in your Betech customer account.`,
      ctaLabel: "Download certificate",
      ctaUrl: input.certificateUrl,
      attachments: [{ filename, content: pdf, contentType: "application/pdf" }],
    })); labels.push("email");
  }
  const settled = await Promise.allSettled(jobs);
  const results = Object.fromEntries(settled.map((result, index) => [labels[index], result.status === "fulfilled" ? "SENT" : "FAILED"]));
  await prisma.commissioningSession.update({
    where: { id: session.id },
    data: {
      customerDeliveredAt: new Date(),
      audit: appendCommissioningAudit(session.audit, { at: new Date().toISOString(), action: "CUSTOMER_CERTIFICATE_DELIVERY", actorId: input.actorId || null, detail: results }),
    },
  });
  return { results, missing: { phone: !phone, email: !isValidEmailAddress(email) } };
}
