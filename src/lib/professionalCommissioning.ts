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

/** Issues only after the technician is the licensed professional or the review has been approved. */
export async function issueProfessionallyApprovedCertificate(input: {
  sessionId: string;
  origin: string;
  professional: LicensedProfessionalSnapshot;
  approvedById?: string | null;
  approvedByName?: string | null;
}) {
  const session = await prisma.commissioningSession.findUnique({
    where: { id: input.sessionId },
    include: {
      technician: { select: { id: true, name: true } },
      receipt: { select: { id: true, receiptNumber: true, data: true, order: { select: { orderNumber: true, customerName: true, customerPhone: true, customerEmail: true, metadata: true } } } },
    },
  });
  if (!session) throw new Error("Commissioning session not found.");
  if (!["DRAFT", "RETURNED_FOR_CORRECTION", "AWAITING_PROFESSIONAL_REVIEW"].includes(session.status)) throw new Error("The completion certificate has already been issued.");
  if (!input.professional.userId || input.professional.userId !== input.approvedById) throw new Error("Only the licensed professional's linked staff account may certify this installation. Link the account in Company Documents settings.");
  const professionalAccount = await prisma.user.findUnique({ where: { id: input.professional.userId }, select: { isActive: true } });
  if (!professionalAccount?.isActive) throw new Error("The licensed professional account is inactive.");
  if (!session.customerTermsAcceptedAt || asRecord(asRecord(session.data).termsAcceptance).accepted !== true) throw new Error("Customer terms acceptance is required before certification.");
  if (!input.professional.signatureUrl) throw new Error("Upload the licensed professional signature before certification.");
  if (!isReadyToIssue(asRecord(session.data)).ready) throw new Error("Commissioning evidence, equipment, tests, handover and signatures must be complete and all tests must pass or be marked N/A.");
  const [signatureSnapshot, stampSnapshot] = await Promise.all([snapshotImage(input.professional.signatureUrl, "professional signature"), snapshotImage(input.professional.stampUrl, "company stamp")]);
  const issuedAt = new Date();
  const reference = projectSummary(session.receipt).reference;
  const certificateNo = certificateNumber(reference);
  const acceptedAt = session.customerTermsAcceptedAt;
  const data = asRecord(session.data);
  const certificateData = {
    ...data,
    projectSnapshot: { ...projectSummary(session.receipt), customerPhone: session.receipt.order?.customerPhone || "" },
    installationCertifiedBySameProfessional: session.technicianId === input.professional.userId,
    termsAcceptance: {
      ...asRecord(data.termsAcceptance), accepted: true, acceptedAt: acceptedAt.toISOString(), termsVersionUrl: TERMS_URL, termsUrl: TERMS_URL,
      acceptedByCustomerName: projectSummary(session.receipt).customerName, customerName: projectSummary(session.receipt).customerName, certificateId: certificateNo, projectId: reference,
    },
    terms_accepted: true, terms_accepted_at: acceptedAt.toISOString(), terms_version_url: TERMS_URL, terms_url: TERMS_URL,
    accepted_by_customer_name: projectSummary(session.receipt).customerName, customer_name: projectSummary(session.receipt).customerName, certificate_id: certificateNo, project_id: reference,
  };
  const updated = await prisma.$transaction(async tx => {
  await completeCertifiedProject(tx, session.receiptId, issuedAt);
  return tx.commissioningSession.update({
    where: { id: session.id, status: session.status, updatedAt: session.updatedAt },
    data: {
      status: "ISSUED", issuedAt, progress: 100, certificateNo, customerTermsAcceptedAt: acceptedAt,
      technicianSignedAt: session.technicianSignedAt || issuedAt,
      professionalApprovedAt: issuedAt,
      supervisedByProfessionalId: input.professional.userId,
      professionalReviewedBy: input.approvedByName || input.professional.name,
      professionalSignatureSnapshot: signatureSnapshot,
      professionalProfileSnapshot: { ...input.professional, stampUrl: stampSnapshot },
      data: certificateData as Prisma.InputJsonValue,
      audit: appendCommissioningAudit(session.audit, { at: issuedAt.toISOString(), action: "CERTIFICATE_ISSUED_AFTER_PROFESSIONAL_CERTIFICATION", actorId: input.approvedById || session.technicianId, detail: { technicianId: session.technicianId, certificateNo, professional: input.professional.name, licenceNumber: input.professional.licenceNumber } }),
    },
  });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
  await syncPosReceiptToCustomerAccount(updated.receiptId).catch(error => console.error("[commissioning] customer account sync needs retry", error));
  let delivery: unknown = null;
  let warranty: unknown = null;
  try {
    warranty = await prepareProjectDocuments({ sessionId: updated.id, origin: input.origin, actorId: input.approvedById });
    const customerToken = await ensureCustomerCertificateToken(updated.id);
    delivery = await sendCustomerCertificateDelivery({ sessionId: updated.id, certificateUrl: `${input.origin.replace(/\/$/, "")}/certificate/${customerToken}`, actorId: input.approvedById });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Document preparation failed.";
    warranty = { error: detail };
    delivery = { error: "Project completed. Customer SMS will be available once all documents are ready." };
  }
  return { updated, delivery, warranty };
}
