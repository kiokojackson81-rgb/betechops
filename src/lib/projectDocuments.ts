import { encryptDocument } from "@/lib/documentEncryption";
import "server-only";
import { createHash } from "crypto";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { buildCommissioningCertificatePdf } from "@/lib/commissioningCertificate";
import { buildReceiptSnapshot } from "@/app/receipts/buildSnapshot";
import { generateReceiptPdf } from "@/workers/receiptSender";
import { getWarrantyCertificate, issueWarrantyCertificate } from "@/lib/warrantyCertificates";
import { ensureCustomerCertificateToken } from "@/lib/commissioning";

async function storePdf(sessionId: string, kind: string, bytes: Buffer) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("Project document storage is not configured.");
  const blob = await put(`project-documents/${sessionId}/${kind}.pdf`, encryptDocument(bytes), { access: "public", contentType: "application/octet-stream", addRandomSuffix: true });
  return { url: blob.url, sha256: createHash("sha256").update(bytes).digest("hex") };
}

/** Idempotent preparation: an admin can retry a failed generation without reissuing successful documents. */
export async function prepareProjectDocuments(input: { sessionId: string; origin: string; actorId?: string | null }) {
  const claimed = await prisma.commissioningSession.updateMany({ where: {
    id: input.sessionId, status: "ISSUED", OR: [{ documentsPreparingAt: null }, { documentsPreparingAt: { lt: new Date(Date.now() - 10 * 60000) } }],
  }, data: { documentsPreparingAt: new Date(), documentsError: null } });
  if (!claimed.count) throw new Error("Documents are already being prepared, or the completion certificate has not been issued.");
  try {
    await ensureCustomerCertificateToken(input.sessionId);
    const session = await prisma.commissioningSession.findUniqueOrThrow({ where: { id: input.sessionId }, include: {
      technician: { select: { name: true } }, receipt: { include: { order: { include: { items: { include: { product: { select: { name: true } } } }, attendant: { select: { name: true } } } }, issuedBy: { select: { name: true } } } },
    } });
    if (!session.completionPdfUrl) {
      const stored = await storePdf(session.id, "completion", await buildCommissioningCertificatePdf(session));
      await prisma.commissioningSession.update({ where: { id: session.id }, data: { completionPdfUrl: stored.url, completionPdfSha256: stored.sha256 } });
    }
    if (!session.projectReceiptPdfUrl) {
      const bytes = await generateReceiptPdf(buildReceiptSnapshot(session.receipt), { hideStamp: false, htmlLabel: "project-documents" });
      if (!bytes?.length) throw new Error("Receipt PDF generation failed. Retry document preparation.");
      const stored = await storePdf(session.id, "receipt", bytes);
      await prisma.commissioningSession.update({ where: { id: session.id }, data: { projectReceiptPdfUrl: stored.url, projectReceiptPdfSha256: stored.sha256 } });
    }
    const existing = await getWarrantyCertificate(session.receiptId);
    const warranty = existing || (await issueWarrantyCertificate({ receiptId: session.receiptId, origin: input.origin, issuedById: input.actorId })).certificate;
    await prisma.commissioningSession.update({ where: { id: session.id }, data: { documentsReadyAt: session.documentsReadyAt || new Date(), documentsPreparingAt: null, documentsError: null } });
    return { warrantyCertificateNo: warranty.certificateNo };
  } catch (error) {
    await prisma.commissioningSession.update({ where: { id: input.sessionId }, data: { documentsPreparingAt: null, documentsError: error instanceof Error ? error.message : "Document generation failed." } });
    throw error;
  }
}
