import { commissioningPaymentState, requireCommissioningPaymentDecision } from "@/lib/commissioningPayment";
import "server-only";

import { isReadyToIssue } from "@/lib/commissioningValidation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getBranding } from "@/lib/branding";
import { appendCommissioningAudit, certificateNumber, projectSummary } from "@/lib/commissioning";
import { ensureCustomerCertificateToken, sendCustomerCertificateDelivery } from "@/lib/commissioningDelivery";
import { TERMS_URL } from "@/lib/publicLinks";
import { prepareProjectDocuments } from "@/lib/projectDocuments";
import { completeCertifiedProject } from "@/lib/projectCompletion";
import { syncPosReceiptToCustomerAccount } from "@/lib/posCustomerAccountSync";
import { ensureReviewInvitationForReceipt } from "@/lib/reviewsReferrals";

export type LicensedProfessionalSnapshot = {
  userId: string | null;
  name: string;
  title: string;
  qualification: string;
  licenceNumber: string;
  signatureUrl: string | null;
  stampUrl?: string | null;
};

export async function activeLicensedProfessional() {
  const branding = await getBranding();
  const professional: LicensedProfessionalSnapshot = { ...branding.licensedProfessional, stampUrl: branding.digitalStampUrl };
  return { professional, active: branding.licensedProfessional.active };
}

export function technicianIsLicensedProfessional(
  technicianName: string | null | undefined,
  professional: LicensedProfessionalSnapshot,
  technicianId?: string | null,
) {
  return Boolean(professional.userId && technicianId === professional.userId);
}

export async function submitForProfessionalReview(input: {
  sessionId: string;
  technicianId?: string | null;
  technicianName?: string | null;
}) {
  const now = new Date();
  const session = await prisma.commissioningSession.findUnique({
    where: { id: input.sessionId },
    select: { audit: true, status: true, updatedAt: true },
  });
  if (!session) throw new Error("Commissioning session not found.");
  if (session.status === "ISSUED") throw new Error("The completion certificate has already been issued.");
  if (!["DRAFT", "RETURNED_FOR_CORRECTION"].includes(session.status)) throw new Error("This record has already been submitted.");
  return prisma.commissioningSession.update({
    where: { id: input.sessionId, status: session.status, updatedAt: session.updatedAt },
    data: {
      status: "AWAITING_PROFESSIONAL_REVIEW",
      progress: 100,
      technicianSignedAt: now,
      audit: appendCommissioningAudit(session.audit, {
        at: now.toISOString(),
        action: "TECHNICIAN_COMPLETED_AWAITING_PROFESSIONAL_REVIEW",
        actorId: input.technicianId || null,
        detail: { technicianName: input.technicianName || "Assigned technician" },
      }),
    },
  });
}

const asRecord = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

async function snapshotImage(url: string | null | undefined, label: string) {
  if (!url) throw new Error(`Upload the ${label} in Company Documents before certification.`);
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const type = response.headers.get("content-type")?.split(";")[0];
  if (!response.ok || !type || !["image/png", "image/jpeg"].includes(type)) throw new Error(`The ${label} image could not be loaded.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 8 * 1024 * 1024) throw new Error(`The ${label} image is too large.`);
  return `data:${type};base64,${bytes.toString("base64")}`;
}

/** Uses the configured supervisor signature and stamp after every required installer check is complete. */
export async function issueAutomaticCompletionCertificate(input: { sessionId: string; origin: string; actorId?: string | null; source: "PUBLIC_LINK" | "STAFF_ACTION"; paymentDecision?: unknown }) {
  const { professional, active } = await activeLicensedProfessional();
  if (!active) throw new Error("Activate the supervisor profile in Company Documents before issuing certificates.");
  if (!professional.name.trim() || !professional.licenceNumber.trim()) throw new Error("Configure the supervisor name and licence number in Company Documents.");
  return issueProfessionallyApprovedCertificate({ sessionId: input.sessionId, origin: input.origin, professional, approvedById: input.actorId || null, automaticSource: input.source, paymentDecision: input.paymentDecision });
}

/** A linked professional may also authorise a record manually when an exception needs review. */
export async function issueProfessionallyApprovedCertificate(input: {
  sessionId: string;
  origin: string;
  professional: LicensedProfessionalSnapshot;
  approvedById?: string | null;
  approvedByName?: string | null;
  automaticSource?: "PUBLIC_LINK" | "STAFF_ACTION";
  paymentDecision?: unknown;
}) {
  const session = await prisma.commissioningSession.findUnique({
    where: { id: input.sessionId },
    include: {
      technician: { select: { id: true, name: true } },
      receipt: { select: { id: true, receiptNumber: true, data: true, order: { select: { orderNumber: true, totalAmount: true, paidAmount: true, customerName: true, customerPhone: true, customerEmail: true, metadata: true } } } },
    },
  });
  if (!session) throw new Error("Commissioning session not found.");
  if (session.status === "ISSUED") throw new Error("The completion certificate has already been issued.");
  if (!input.automaticSource && session.status !== "AWAITING_PROFESSIONAL_REVIEW") throw new Error("Submit the completed installation for professional review before certification.");
  if (input.automaticSource && !["DRAFT", "RETURNED_FOR_CORRECTION", "AWAITING_PROFESSIONAL_REVIEW"].includes(session.status)) throw new Error("The completion certificate has already been issued.");
  if (!input.automaticSource) {
    if (!input.professional.userId || input.professional.userId !== input.approvedById) throw new Error("Only the licensed professional's linked staff account may certify this installation. Link the account in Company Documents settings.");
    const professionalAccount = await prisma.user.findUnique({ where: { id: input.professional.userId }, select: { isActive: true } });
    if (!professionalAccount?.isActive) throw new Error("The licensed professional account is inactive.");
  }
  if (!session.customerTermsAcceptedAt || asRecord(asRecord(session.data).termsAcceptance).accepted !== true) throw new Error("Customer terms acceptance is required before certification.");
  if (!input.professional.signatureUrl) throw new Error("Upload the licensed professional signature before certification.");
  if (!isReadyToIssue(asRecord(session.data)).ready) throw new Error("Commissioning evidence, equipment, tests, handover and signatures must be complete and all tests must pass or be marked N/A.");
  const paymentBefore = commissioningPaymentState(session.receipt.order);
  const paymentDecision = requireCommissioningPaymentDecision(paymentBefore.fullyPaid, input.paymentDecision ?? asRecord(session.data).paymentDecision);
  const [signatureSnapshot, stampSnapshot] = await Promise.all([snapshotImage(input.professional.signatureUrl, "professional signature"), snapshotImage(input.professional.stampUrl, "company stamp")]);
  const issuedAt = new Date();
  const reference = projectSummary(session.receipt).reference;
  const certificateNo = certificateNumber(reference);
  const acceptedAt = session.customerTermsAcceptedAt;
  const data = asRecord(session.data);
  const certificateData = {
    ...data,
    paymentDecision: paymentDecision || "ALREADY_PAID",
    paymentAtCertification: paymentBefore,
    certificationMode: input.automaticSource ? "AUTOMATIC_SUPERVISOR_SIGNATURE" : "PROFESSIONAL_REVIEW",
    installerName: String(data.installerName || session.technician?.name || (asRecord(session.assignment).names as string[] | undefined)?.join(" / ") || "Installer / agent"),
    projectSnapshot: { ...projectSummary(session.receipt), customerPhone: session.receipt.order?.customerPhone || "" },
    installationCertifiedBySameProfessional: session.technicianId === input.professional.userId && String(data.installerName || session.technician?.name || "").trim() === input.professional.name.trim(),
    termsAcceptance: {
      ...asRecord(data.termsAcceptance), accepted: true, acceptedAt: acceptedAt.toISOString(), termsVersionUrl: TERMS_URL, termsUrl: TERMS_URL,
      acceptedByCustomerName: projectSummary(session.receipt).customerName, customerName: projectSummary(session.receipt).customerName, certificateId: certificateNo, projectId: reference,
    },
    terms_accepted: true, terms_accepted_at: acceptedAt.toISOString(), terms_version_url: TERMS_URL, terms_url: TERMS_URL,
    accepted_by_customer_name: projectSummary(session.receipt).customerName, customer_name: projectSummary(session.receipt).customerName, certificate_id: certificateNo, project_id: reference,
  };
  const updated = await prisma.$transaction(async tx => {
  await completeCertifiedProject(tx, session.receiptId, issuedAt, { decision: paymentDecision, actorId: input.approvedById || session.technicianId, sessionId: session.id });
  return tx.commissioningSession.update({
    where: { id: session.id, status: session.status, updatedAt: session.updatedAt },
    data: {
      status: "ISSUED", issuedAt, progress: 100, certificateNo, customerTermsAcceptedAt: acceptedAt,
      technicianSignedAt: session.technicianSignedAt || issuedAt,
      professionalApprovedAt: issuedAt,
      supervisedByProfessionalId: input.professional.userId,
      professionalReviewedBy: input.automaticSource ? null : input.approvedByName || input.professional.name,
      professionalSignatureSnapshot: signatureSnapshot,
      professionalProfileSnapshot: { ...input.professional, stampUrl: stampSnapshot },
      data: certificateData as Prisma.InputJsonValue,
      audit: appendCommissioningAudit(session.audit, { at: issuedAt.toISOString(), action: input.automaticSource ? "CERTIFICATE_AUTO_ISSUED_WITH_SUPERVISOR_SIGNATURE" : "CERTIFICATE_ISSUED_AFTER_PROFESSIONAL_CERTIFICATION", actorId: input.automaticSource ? input.approvedById || null : input.approvedById, detail: { automaticSource: input.automaticSource || null, technicianId: session.technicianId, certificateNo, professional: input.professional.name, licenceNumber: input.professional.licenceNumber } }),
    },
  });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
  await syncPosReceiptToCustomerAccount(updated.receiptId).catch(error => console.error("[commissioning] customer account sync needs retry", error));
  // The normal customer-account sync provisions this too. Keep a direct
  // certificate-path safeguard so every certified installation, including
  // agent-managed projects, receives its seven-day review invitation.
  await ensureReviewInvitationForReceipt(updated.receiptId, {
    completedAt: issuedAt,
    deliveryMode: "project",
  }).catch(error => console.error("[commissioning] review invitation provisioning needs retry", error));
  let delivery: unknown = null;
  let warranty: unknown = null;
  try {
    warranty = await prepareProjectDocuments({ sessionId: updated.id, origin: input.origin, actorId: input.approvedById });
    const customerToken = await ensureCustomerCertificateToken(updated.id);
    delivery = await sendCustomerCertificateDelivery({ sessionId: updated.id, certificateUrl: `${input.origin.replace(/\/$/, "")}/certificate/${customerToken}`, actorId: input.approvedById });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Document preparation failed.";
    warranty = { error: detail };
    delivery = { error: "Installation certified. Customer SMS will be available once all documents are ready." };
  }
  return { updated, delivery, warranty };
}
