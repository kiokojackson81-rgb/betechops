import "server-only";

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
    receipt: { select: { id: true; receiptNumber: true; data: true; order: { select: { orderNumber: true; customerName: true; customerPhone: true; customerEmail: true; metadata: true } } } };
  };
}>;

const asRecord = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const choose = (record: Record<string, unknown>, keys: string[]) => keys.map((key) => text(record[key])).find(Boolean) || "Not recorded";
const isoDate = (date: Date) => date.toISOString();

function expiryDate(start: Date, years: number) {
  const expiry = new Date(start);
  expiry.setUTCFullYear(expiry.getUTCFullYear() + years);
  expiry.setUTCDate(expiry.getUTCDate() - 1);
  return expiry.toISOString();
}

function extractEquipment(data: unknown, start: Date): WarrantyEquipment[] {
  const equipment = asRecord(asRecord(data).equipment);
  const panelQuantity = choose(equipment, ["panelQuantity", "panelQty", "panelCount"]);
  const panelModel = choose(equipment, ["panelModel"]);
  const panelRating = choose(equipment, ["panelRating", "panelWatts", "panelWattage"]);
  const panelModelCapacity = [panelModel, panelRating !== "Not recorded" ? panelRating : "", panelQuantity !== "Not recorded" ? `Quantity: ${panelQuantity}` : ""].filter(Boolean).join(" · ") || "Not recorded";
  return [
    { equipment: "Solar Panels", brand: choose(equipment, ["panelBrand"]), modelCapacity: panelModelCapacity, serialNumbers: choose(equipment, ["panelSerial", "panelSerialNumbers", "panelReference"]), warrantyYears: 25, warrantyStartDate: isoDate(start), warrantyExpiryDate: expiryDate(start, 25) },
    { equipment: "Inverter", brand: choose(equipment, ["inverterBrand"]), modelCapacity: [choose(equipment, ["inverterModel"]), choose(equipment, ["inverterCapacity", "inverterRating"])].filter((value) => value !== "Not recorded").join(" · ") || "Not recorded", serialNumbers: choose(equipment, ["inverterSerial", "inverterSerialNumber"]), warrantyYears: 5, warrantyStartDate: isoDate(start), warrantyExpiryDate: expiryDate(start, 5) },
    { equipment: "Lithium Battery", brand: choose(equipment, ["batteryBrand"]), modelCapacity: [choose(equipment, ["batteryModel"]), choose(equipment, ["batteryCapacity", "batteryRating"]), choose(equipment, ["batteryQuantity", "batteryQty"])].filter((value) => value !== "Not recorded").join(" · ") || "Not recorded", serialNumbers: choose(equipment, ["batterySerial", "batterySerialNumbers", "batterySerialNumber"]), warrantyYears: 10, warrantyStartDate: isoDate(start), warrantyExpiryDate: expiryDate(start, 10) },
  ];
}

function sourceSnapshot(session: CommissioningSource, certificateNo: string, verificationUrl: string, issuedAt: Date): WarrantyCertificateSnapshot {
  const summary = projectSummary(session.receipt);
  const certificateData = asRecord(session.data);
  const installation = asRecord(certificateData.installation);
  const commissioningDate = session.issuedAt || issuedAt;
  return {
    certificateNo,
    completionCertificateNo: session.certificateNo || "Not recorded",
    projectReference: summary.reference,
    customerName: summary.customerName,
    customerPhone: session.receipt.order?.customerPhone || "Not recorded",
    installationLocation: summary.location,
    installationType: choose(installation, ["type", "installationType"]) === "Not recorded" ? "New solar installation" : choose(installation, ["type", "installationType"]),
    systemConfiguration: choose(installation, ["systemConfiguration", "configuration", "systemType"]) === "Not recorded" ? summary.system : choose(installation, ["systemConfiguration", "configuration", "systemType"]),
    technicianName: session.technician?.name || "Assigned technician",
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
      receipt: { select: { id: true, receiptNumber: true, data: true, order: { select: { orderNumber: true, customerName: true, customerPhone: true, customerEmail: true, metadata: true } } } },
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
    orderBy: [{ version: "desc" }, { issuedAt: "desc" }],
  });
  return includeHistory ? certificates : certificates.find((certificate) => certificate.status === "ISSUED") || null;
}

export async function issueWarrantyCertificate(input: { receiptId: string; issuedById?: string | null; issuedByName?: string | null; origin: string; reissue?: boolean }) {
  const session = await commissioningSource(input.receiptId);
  if (!session || session.status !== "ISSUED" || !session.certificateNo || !session.issuedAt) {
    throw new Error("Issue a commissioned and verified Certificate of Completion before generating the warranty certificate.");
  }
  const existing = await getWarrantyCertificate(input.receiptId);
  if (existing && !input.reissue) return { certificate: existing, reused: true };

  const issuedAt = new Date();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const certificateNo = await nextCertificateNumber(issuedAt);
    const verificationToken = createCommissioningToken();
    const verificationUrl = `${input.origin.replace(/\/$/, "")}/verify/warranty/${verificationToken}`;
    const snapshot = sourceSnapshot(session, certificateNo, verificationUrl, issuedAt);
    const pdf = await buildWarrantyCertificatePdf(snapshot);
    const hash = createHash("sha256").update(pdf).digest("hex");
    if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("Warranty document storage is not configured.");
    const blob = await put(`warranty-certificates/${session.receipt.id}/${certificateNo}.pdf`, pdf, { access: "public", contentType: "application/pdf", addRandomSuffix: false, token: process.env.BLOB_READ_WRITE_TOKEN });
    try {
      const certificate = await prisma.$transaction(async (tx) => {
        const version = (await tx.warrantyCertificate.count({ where: { receiptId: input.receiptId } })) + 1;
        const created = await tx.warrantyCertificate.create({
          data: {
            receiptId: input.receiptId,
            commissioningSessionId: session.id,
            certificateNo,
            version,
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
        if (existing) await tx.warrantyCertificate.update({ where: { id: existing.id }, data: { status: WarrantyCertificateStatus.SUPERSEDED, supersededAt: issuedAt, supersededById: created.id } });
        await tx.commissioningSession.update({ where: { id: session.id }, data: { audit: appendCommissioningAudit(session.audit, { at: issuedAt.toISOString(), action: input.reissue ? "WARRANTY_CERTIFICATE_REISSUED" : "WARRANTY_CERTIFICATE_ISSUED", actorId: input.issuedById || null, detail: { certificateNo, completionCertificateNo: session.certificateNo, version } }) } });
        return created;
      });
      return { certificate, reused: false };
    } catch (error) {
      if (attempt === 2 || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    }
  }
  throw new Error("Unable to allocate a warranty certificate number.");
}

export async function warrantyPdfBytes(certificate: { pdfUrl: string }) {
  const response = await fetch(certificate.pdfUrl, { cache: "no-store" });
  if (!response.ok) throw new Error("The issued warranty PDF could not be retrieved.");
  return Buffer.from(await response.arrayBuffer());
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
  return prisma.warrantyCertificate.findUnique({ where: { verificationTokenHash: hashCommissioningToken(token) } });
}
