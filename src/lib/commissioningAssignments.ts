import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendCommissioningAudit, commissioningExpiry, commissioningUrl, createCommissioningToken, decryptCommissioningToken, encryptCommissioningToken, hashCommissioningToken, projectSummary } from "@/lib/commissioning";
import { readReceiptProjectFlow } from "@/lib/receiptProjects";
import { technicianCommissioningSms } from "@/lib/projectDocumentMessages";
import { sendCommissioningSms } from "@/lib/commissioningSms";

const record = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export async function syncCommissioningAssignment(tx: Prisma.TransactionClient, receiptId: string, technicianId: string | null, actorId?: string | null) {
  const existing = await tx.commissioningSession.findUnique({ where: { receiptId } });
  if (existing?.status === "ISSUED") return existing;
  if (!technicianId) {
    if (existing && existing.status !== "REVOKED") return tx.commissioningSession.update({ where: { id: existing.id }, data: { status: "REVOKED", revokedAt: new Date(), technicianId: null } });
    return existing;
  }
  if (existing?.technicianId === technicianId) return existing;
  const technician = await tx.user.findUnique({ where: { id: technicianId }, select: { isActive: true } });
  if (!technician?.isActive) throw new Error("The assigned technician account is inactive.");
  const token = createCommissioningToken();
  const credentials = { technicianId, tokenHash: hashCommissioningToken(token), tokenCiphertext: encryptCommissioningToken(token), expiresAt: commissioningExpiry() };
  if (!existing) return tx.commissioningSession.create({ data: { receiptId, ...credentials, audit: [{ at: new Date().toISOString(), action: "ASSIGNMENT_COMMISSIONING_LINK_CREATED", actorId: actorId || null }] } });
  const data = record(existing.data);
  return tx.commissioningSession.update({ where: { id: existing.id, updatedAt: existing.updatedAt }, data: {
    ...credentials, status: "DRAFT", revokedAt: null, technicianSignedAt: null, lastStep: "panels", professionalReviewComment: null,
    data: { ...data, signatures: { ...record(data.signatures), technician: "", technicianSignedAt: null } } as Prisma.InputJsonValue,
    audit: appendCommissioningAudit(existing.audit, { at: new Date().toISOString(), action: "TECHNICIAN_REASSIGNED_AND_TOKEN_REPLACED", actorId: actorId || null, detail: { previousTechnicianId: existing.technicianId, technicianId } }),
  } });
}

export async function technicianMessagePreview(receiptId: string, origin: string) {
  const session = await prisma.commissioningSession.findUnique({ where: { receiptId }, include: {
    technician: { select: { name: true, phone: true, whatsappNumber: true, technicalProfile: { select: { phoneNumber: true } } } },
    receipt: { select: { receiptNumber: true, data: true, order: { select: { orderNumber: true, customerName: true, metadata: true } } } },
  } });
  if (!session || session.status === "REVOKED" || session.status === "ISSUED" || !session.technicianId) throw new Error("An active commissioning assignment is required before sending the technician link.");
  const summary = projectSummary(session.receipt);
  const name = session.technician?.name || "Technician";
  const link = commissioningUrl(decryptCommissioningToken(session.tokenCiphertext), origin);
  const phone = session.technician?.technicalProfile?.phoneNumber || session.technician?.phone || session.technician?.whatsappNumber || "";
  return { session, name, phone, link, message: technicianCommissioningSms({ name, reference: summary.reference, customer: summary.customerName, location: summary.location, link }) };
}

export async function sendTechnicianCommissioningLink(input: { receiptId: string; origin: string; manual?: boolean; actorId?: string | null }) {
  const preview = await technicianMessagePreview(input.receiptId, input.origin);
  // Resending preserves the token and saved progress, including returned corrections.
  if (preview.session.expiresAt <= new Date()) await prisma.commissioningSession.update({ where: { id: preview.session.id }, data: { expiresAt: commissioningExpiry() } });
  return sendCommissioningSms({ sessionId: preview.session.id, kind: "TECHNICIAN_LINK", recipientName: preview.name, phone: preview.phone, message: preview.message, automaticKey: `technician:${preview.session.id}:${preview.session.tokenHash}`, manual: input.manual, actorId: input.actorId });
}

export async function notifyAssignedCommissioningTechnician(receiptId: string, actorId?: string | null) {
  const session = await prisma.$transaction(async tx => {
    const receipt = await tx.receipt.findUnique({ where: { id: receiptId }, select: { data: true } });
    const flow = readReceiptProjectFlow(record(receipt?.data).projectFlow);
    const technicianId = flow?.handlerStaffIds[0] || flow?.handlerStaffId || null;
    return syncCommissioningAssignment(tx, receiptId, technicianId, actorId);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (!session || session.status === "ISSUED" || session.status === "REVOKED") return null;
  const origin = process.env.NEXT_PUBLIC_BASE_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://ops.betech.co.ke";
  return sendTechnicianCommissioningLink({ receiptId, actorId, origin });
}
