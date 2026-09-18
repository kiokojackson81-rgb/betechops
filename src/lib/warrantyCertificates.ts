import { commissioningEquipmentUnits, equipmentValidationErrors } from "@/lib/commissioningEquipment";
import { profileFromCommissioningData } from "@/lib/commissioningProfiles";
import "server-only";

import { technicalConfiguration, warrantyExpiry } from "@/lib/warrantyRules";
import { createHash } from "crypto";
import { put } from "@vercel/blob";
import {
  Prisma,
  type WarrantyCertificate,
  WarrantyCertificateStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendCommissioningAudit, createCommissioningToken, encryptCommissioningToken, hashCommissioningToken, projectSummary } from "@/lib/commissioning";
import { buildWarrantyCertificatePdf, type WarrantyCertificateSnapshot, type WarrantyEquipment } from "@/lib/warrantyCertificate";
import { sendTransactionalSms } from "@/lib/africasTalking";
import { sendGeneralCustomerNotificationEmail } from "@/lib/email";

type CommissioningSource = Prisma.CommissioningSessionGetPayload<{
  include: {
    technician: { select: { id: true; name: true } };
    receipt: { select: { id: true; receiptNumber: true; data: true; order: { select: { id: true; orderNumber: true; customerName: true; customerPhone: true; customerEmail: true; metadata: true } } } };
  };
}>;

const asRecord = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const choose = (record: Record<string, unknown>, keys: string[]) => keys.map((key) => text(record[key])).find(Boolean) || "Not recorded";
const isoDate = (date: Date) => date.toISOString();


export function extractEquipment(data: unknown, start: Date): WarrantyEquipment[] {
  const record = asRecord(data);
  const equipment = asRecord(record.equipment);
  const profile = profileFromCommissioningData(record);
  const panelQuantity = choose(equipment, ["panelQuantity", "panelQty", "panelCount"]);
  const panelModel = choose(equipment, ["panelModel"]);
  const panelRating = choose(equipment, ["panelRating", "panelWatts", "panelWattage", "panelRatedPower"]);
  const panelModelCapacity = [panelModel, panelRating !== "Not recorded" ? panelRating : "", panelQuantity !== "Not recorded" ? `Quantity: ${panelQuantity}` : ""].filter(Boolean).join(" · ") || "Not recorded";
  const panelYears = Number(equipment.panelWarrantyYears ?? 25);
  return [
    ...(profile.panels ? [{ equipment: "Solar Panels", brand: choose(equipment, ["panelBrand"]), modelCapacity: panelModelCapacity, serialNumbers: choose(equipment, ["panelSerial", "panelSerialNumbers", "panelReference"]), warrantyYears: panelYears, warrantyStartDate: isoDate(start), warrantyExpiryDate: warrantyExpiry(start, panelYears) }] : []),
    ...commissioningEquipmentUnits(data).map(unit => ({ equipment: unit.kind === "battery" ? "Lithium Battery" : unit.label || unit.kind.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()), brand: unit.brand || "Not recorded", modelCapacity: [unit.model, unit.capacity].filter(Boolean).join(" / ") || "Not recorded", serialNumbers: unit.serial || "Not recorded", warrantyYears: Number(unit.warrantyYears), warrantyStartDate: isoDate(start), warrantyExpiryDate: warrantyExpiry(start, Number(unit.warrantyYears)) })),
  ];
}

function sourceSnapshot(session: CommissioningSource, certificateNo: string, verificationUrl: string, issuedAt: Date): WarrantyCertificateSnapshot {
  const summary = projectSummary(session.receipt);
  const certificateData = asRecord(session.data);
  const installation = asRecord(certificateData.installation);
  const signatures = asRecord(certificateData.signatures);
  const professional = asRecord(session.professionalProfileSnapshot);
  const commissioningDate = session.technicianSignedAt || session.issuedAt || issuedAt;
  const frozenProject = asRecord(certificateData.projectSnapshot);
  return {
    certificateNo,
    links: { receiptId: session.receiptId, commissioningSessionId: session.id, orderId: session.receipt.order?.id || null, customerId: text(asRecord(session.receipt.data).customerUserId) || text(asRecord(session.receipt.order?.metadata).customerUserId) || null },
    completionCertificateNo: session.certificateNo || "Not recorded",
    projectReference: text(frozenProject.reference) || summary.reference,
    customerName: text(frozenProject.customerName) || summary.customerName,
    customerPhone: session.receipt.order?.customerPhone || "Not recorded",
    installationLocation: text(frozenProject.location) || summary.location,
    installationType: choose(installation, ["type", "installationType"]) === "Not recorded" ? "New solar installation" : choose(installation, ["type", "installationType"]),
    systemConfiguration: `${profileFromCommissioningData(certificateData).label}${technicalConfiguration(choose(installation, ["systemConfiguration", "configuration", "systemType"])) !== "Not recorded" ? ` · ${technicalConfiguration(choose(installation, ["systemConfiguration", "configuration", "systemType"]))}` : ""}`,
    technicianName: text(certificateData.installerName) || session.technician?.name || "Installer / agent",
    technicianSignatureUrl: text(signatures.technician) || null,
    authorisedByName: text(session.professionalReviewedBy) || text(professional.name) || null,
    authorisedByTitle: text(professional.title) || null,
    authorisedByQualification: text(professional.qualification) || null,
    authorisedByLicenceNumber: text(professional.licenceNumber) || null,
    authorisedSignatureUrl: text(session.professionalSignatureSnapshot) || text(professional.signatureUrl) || null,
    companyStampUrl: text(professional.stampUrl) || null,
    commissioningDate: isoDate(commissioningDate),
    issueDate: isoDate(issuedAt),
    verificationUrl,
    equipment: extractEquipment(session.data, commissioningDate),
  };
}

async function commissioningSource(receiptId: string) {
  return prisma.commissioningSession.findUnique({
    where: { receiptId },
    include: {
      technician: { select: { id: true, name: true } },
      receipt: { select: { id: true, receiptNumber: true, data: true, order: { select: { id: true, orderNumber: true, customerName: true, customerPhone: true, customerEmail: true, metadata: true } } } },
    },
  });
}

async function nextCertificateNumber(issuedAt: Date) {
  const year = issuedAt.getUTCFullYear();
  const prefix = `BS-WC-${year}-`;
  const latest = await prisma.warrantyCertificate.findFirst({ where: { certificateNo: { startsWith: prefix } }, orderBy: { certificateNo: "desc" }, select: { certificateNo: true } });
  const sequence = Math.max(0, Number(latest?.certificateNo.slice(prefix.length)) || 0) + 1;
  return `${prefix}${String(sequence).padStart(6, "0")}`;
}

export function getWarrantyCertificate(
  receiptId: string,
  includeHistory: true,
): Promise<WarrantyCertificate[]>;
export function getWarrantyCertificate(
  receiptId: string,
  includeHistory?: false,
): Promise<WarrantyCertificate | null>;
export async function getWarrantyCertificate(
  receiptId: string,
  includeHistory = false,
): Promise<WarrantyCertificate[] | WarrantyCertificate | null> {
  const certificates = await prisma.warrantyCertificate.findMany({
    where: { receiptId },
    include: { history: { orderBy: { createdAt: "asc" } } },
    orderBy: [{ version: "desc" }, { issuedAt: "desc" }],
  });
  return includeHistory ? certificates : certificates.find((certificate) => certificate.status === "ISSUED") || null;
}

export async function issueWarrantyCertificate(input: { receiptId: string; issuedById?: string | null; issuedByName?: string | null; origin: string; reissue?: boolean; reason?: string; warrantyYears?: number[] }) {
  const session = await commissioningSource(input.receiptId);
  if (!session || session.status !== "ISSUED" || !session.certificateNo || !session.issuedAt) {
    throw new Error("Issue a commissioned and verified Certificate of Completion before generating the warranty certificate.");
  }
  const existing = await getWarrantyCertificate(input.receiptId);
  if (existing && !input.reissue) return { certificate: existing, reused: true };

  const errors = equipmentValidationErrors(session.data);
  if (errors.length) throw new Error(errors.join(" "));
  const issuedAt = new Date();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const certificateNo = await nextCertificateNumber(issuedAt);
    const verificationToken = createCommissioningToken();
    const verificationUrl = `${input.origin.replace(/\/$/, "")}/verify/warranty/${verificationToken}`;
    const snapshot = sourceSnapshot(session, certificateNo, verificationUrl, issuedAt);
    snapshot.coverageStatus = existing?.coverageStatus || "ACTIVE";
    if (existing && input.reissue) {
      const previous = await prisma.warrantyCertificate.findUnique({ where: { id: existing.id }, include: { history: { orderBy: { createdAt: "asc" } } } });
      if (previous) snapshot.equipment = currentWarrantyEquipment(previous);
    }
    if (input.warrantyYears) {
      if (input.warrantyYears.length !== snapshot.equipment.length || input.warrantyYears.some(years => !Number.isFinite(years) || years <= 0 || years > 50 || Math.abs(years * 12 - Math.round(years * 12)) > 0.00001)) throw new Error("Provide a valid warranty period for every equipment row (1 month to 50 years).");
      snapshot.equipment = snapshot.equipment.map((row, index) => ({ ...row, warrantyYears: input.warrantyYears![index], warrantyExpiryDate: warrantyExpiry(new Date(row.warrantyStartDate), input.warrantyYears![index]) }));
    }
    const pdf = await buildWarrantyCertificatePdf(snapshot);
    const hash = createHash("sha256").update(pdf).digest("hex");
    if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("Warranty document storage is not configured.");
    const blob = await put(`warranty-certificates/${session.receipt.id}/${certificateNo}.pdf`, pdf, { access: "public", contentType: "application/pdf", addRandomSuffix: true, token: process.env.BLOB_READ_WRITE_TOKEN });
    try {
      const certificate = await prisma.$transaction(async (tx) => {
        const current = await tx.warrantyCertificate.findFirst({ where: { receiptId: input.receiptId, status: "ISSUED" }, orderBy: { version: "desc" } });
        if ((current?.id || null) !== (existing?.id || null) || (current && existing && current.updatedAt.getTime() !== existing.updatedAt.getTime())) throw new Error("The warranty changed during issuance. Reload before retrying.");
        const version = (await tx.warrantyCertificate.count({ where: { receiptId: input.receiptId } })) + 1;
        const created = await tx.warrantyCertificate.create({
          data: {
            receiptId: input.receiptId,
            commissioningSessionId: session.id,
            certificateNo,
            version,
            coverageStatus: existing?.coverageStatus || "ACTIVE",
            verificationTokenHash: hashCommissioningToken(verificationToken),
            verificationTokenCiphertext: encryptCommissioningToken(verificationToken),
            sourceCertificateNo: session.certificateNo!,
            issuedAt,
            issuedById: input.issuedById || null,
            issuedByName: input.issuedByName || null,
            pdfUrl: blob.url,
            pdfSha256: hash,
            data: snapshot as unknown as Prisma.InputJsonValue,
          },
        });
        await tx.warrantyHistory.create({ data: { certificateId: created.id, action: existing ? "REISSUED" : "ISSUED", reason: input.reason || "Issued following successful commissioning", actorId: input.issuedById || "SYSTEM", data: { previousCertificateId: existing?.id || null, completionCertificateId: session.id, warrantyYears: snapshot.equipment.map(row => row.warrantyYears) } } });
        if (existing) await tx.warrantyCertificate.update({ where: { id: existing.id }, data: { status: WarrantyCertificateStatus.SUPERSEDED, supersededAt: issuedAt, supersededById: created.id } });
        await tx.commissioningSession.update({ where: { id: session.id }, data: { audit: appendCommissioningAudit(session.audit, { at: issuedAt.toISOString(), action: input.reissue ? "WARRANTY_CERTIFICATE_REISSUED" : "WARRANTY_CERTIFICATE_ISSUED", actorId: input.issuedById || null, detail: { certificateNo, completionCertificateNo: session.certificateNo, version } }) } });
        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return { certificate, reused: false };
    } catch (error) {
      if (attempt === 2 || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    }
  }
  throw new Error("Unable to allocate a warranty certificate number.");
}

export async function warrantyPdfBytes(certificate: { pdfUrl: string; pdfSha256?: string | null }) {
  const response = await fetch(certificate.pdfUrl, { cache: "no-store" });
  if (!response.ok) throw new Error("The issued warranty PDF could not be retrieved.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (certificate.pdfSha256 && createHash("sha256").update(bytes).digest("hex") !== certificate.pdfSha256) throw new Error("The stored warranty PDF failed its integrity check.");
  return bytes;
}

export async function deliverWarrantyCertificate(input: { certificateId: string; accountUrl: string; actorId?: string | null }) {
  const certificate = await prisma.warrantyCertificate.findUnique({
    where: { id: input.certificateId },
    include: { receipt: { select: { receiptNumber: true, order: { select: { orderNumber: true, customerName: true, customerPhone: true, customerEmail: true } } } } },
  });
  if (!certificate || certificate.status !== "ISSUED") throw new Error("An active issued warranty certificate is required before sending it.");
  const name = certificate.receipt.order?.customerName || "Customer";
  const reference = certificate.receipt.receiptNumber || certificate.receipt.order?.orderNumber || "your project";
  const phone = String(certificate.receipt.order?.customerPhone || "").trim();
  const email = String(certificate.receipt.order?.customerEmail || "").trim();
  const message = `Hello ${name}, your warranty certificate ${certificate.certificateNo} for ${reference} is ready. Download your issued project documents securely: ${input.accountUrl}`;
  const results: Record<string, string> = {};
  if (phone) { await sendTransactionalSms(phone, message); results.sms = "SENT"; } else results.sms = "SKIPPED";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const pdf = await warrantyPdfBytes(certificate);
    await sendGeneralCustomerNotificationEmail({ to: email, subject: `Your Betech warranty certificate — ${reference}`, title: "Your warranty certificate is ready", intro: `Hello ${name},`, bodyHtml: `<p>Your issued warranty certificate <strong>${certificate.certificateNo}</strong> is attached and available securely in your customer account.</p>`, bodyText: `${message}\n\nThe issued PDF is attached.`, ctaLabel: "View project documents", ctaUrl: input.accountUrl, attachments: [{ filename: `${certificate.certificateNo}.pdf`, content: pdf, contentType: "application/pdf" }] });
    results.email = "SENT";
  } else results.email = "SKIPPED";
  return { results };
}

export async function findWarrantyByVerificationToken(token: string) {
  return prisma.warrantyCertificate.findUnique({ where: { verificationTokenHash: hashCommissioningToken(token) }, include: { history: { orderBy: { createdAt: "asc" } } } });
}

export function currentWarrantyEquipment(certificate: { data: unknown; history: Array<{ action: string; data: unknown }> }): WarrantyEquipment[] {
  const snapshot = asRecord(certificate.data);
  const equipment = (Array.isArray(snapshot.equipment) ? snapshot.equipment : []).map(row => ({ ...asRecord(row) })) as WarrantyEquipment[];
  for (const entry of certificate.history) {
    const change = asRecord(entry.data);
    if (entry.action === "REPLACEMENT" && Number.isInteger(change.index) && equipment[Number(change.index)]) equipment[Number(change.index)] = asRecord(change.replacementEquipment) as WarrantyEquipment;
  }
  return equipment;
}

export async function warrantyReadiness(receiptId: string) {
  const session = await commissioningSource(receiptId);
  if (!session || session.status !== "ISSUED") return { ready: false, warnings: ["Finalize the completion certificate first."] };
  const snapshot = sourceSnapshot(session, "PREVIEW — NOT ISSUED", "", new Date());
  const warnings = snapshot.equipment.filter(row => /^(not recorded|n\/?a|unknown|-)$/i.test(row.serialNumbers)).map(row => `${row.equipment}: serial numbers have not been captured.`);
  return { ready: true, warnings, snapshot };
}

export async function previewWarrantyCertificate(receiptId: string) {
  const readiness = await warrantyReadiness(receiptId);
  if (!readiness.snapshot) throw new Error(readiness.warnings[0]);
  const existing = await prisma.warrantyCertificate.findFirst({ where: { receiptId, status: "ISSUED" }, orderBy: { version: "desc" }, include: { history: { orderBy: { createdAt: "asc" } } } });
  if (existing) readiness.snapshot.equipment = currentWarrantyEquipment(existing);
  return buildWarrantyCertificatePdf(readiness.snapshot, { preview: true });
}

export async function updateWarrantyCoverage(input: {
  receiptId: string; actorId: string; reason: string;
  status?: string;
  replacement?: { index: number; brand: string; modelCapacity: string; serialNumbers: string; replacementDate: string; claimReference: string };
}) {
  return prisma.$transaction(async tx => {
    const certificate = await tx.warrantyCertificate.findFirst({ where: { receiptId: input.receiptId, status: "ISSUED" }, orderBy: { version: "desc" }, include: { history: { orderBy: { createdAt: "asc" } } } });
    if (!certificate) throw new Error("An issued warranty certificate is required.");
    let data: Prisma.InputJsonValue;
    if (input.replacement) {
      if (certificate.coverageStatus === "VOID") throw new Error("A void warranty cannot receive replacement equipment.");
      const { index, brand, modelCapacity, serialNumbers, replacementDate, claimReference } = input.replacement;
      const originalEquipment = currentWarrantyEquipment(certificate)[index];
      if (!originalEquipment) throw new Error("Select a valid installed equipment record.");
      await tx.warrantyCertificate.update({ where: { id: certificate.id }, data: { updatedAt: new Date() } });
      data = { index, originalEquipment, replacementEquipment: { ...originalEquipment, brand, modelCapacity, serialNumbers }, replacementDate, claimReference };
    } else {
      if (!input.status || !["ACTIVE", "EXPIRED", "VOID", "REPLACED", "UNDER_CLAIM"].includes(input.status)) throw new Error("Select a valid warranty status.");
      data = { previousStatus: certificate.coverageStatus, status: input.status };
      await tx.warrantyCertificate.update({ where: { id: certificate.id }, data: { coverageStatus: input.status } });
    }
    return tx.warrantyHistory.create({ data: { certificateId: certificate.id, action: input.replacement ? "REPLACEMENT" : "STATUS_CHANGED", reason: input.reason, actorId: input.actorId, data } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
