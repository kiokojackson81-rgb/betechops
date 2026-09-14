import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendCommissioningAudit, commissioningExpiry, commissioningUrl, createCommissioningToken, decryptCommissioningToken, encryptCommissioningToken, hashCommissioningToken, projectSummary } from "@/lib/commissioning";
import { readReceiptProjectFlow } from "@/lib/receiptProjects";
import { technicianCommissioningSms } from "@/lib/projectDocumentMessages";
import { sendCommissioningSms } from "@/lib/commissioningSms";

const record = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export async function syncCommissioningAssignment(tx: Prisma.TransactionClient, receiptId: string, technicianId: string | null, actorId?: string | null, assignees?: { staffIds: string[]; externalAgentIds: string[] }) {
  const existing = await tx.commissioningSession.findUnique({ where: { receiptId } });
  if (existing?.status === "ISSUED") return existing;
  const staffIds = [...new Set(assignees?.staffIds || (technicianId ? [technicianId] : []))];
  const externalAgentIds = [...new Set(assignees?.externalAgentIds || [])];
  const assignment = { staffIds, externalAgentIds, names: [] as string[] };
  const previous = record(existing?.assignment);
  const unchanged = JSON.stringify([...(Array.isArray(previous.staffIds) ? previous.staffIds : existing?.technicianId ? [existing.technicianId] : [])].sort()) === JSON.stringify([...staffIds].sort()) && JSON.stringify([...(Array.isArray(previous.externalAgentIds) ? previous.externalAgentIds : [])].sort()) === JSON.stringify([...externalAgentIds].sort());
  if (!staffIds.length && !externalAgentIds.length) {
    if (existing && existing.status !== "REVOKED") return tx.commissioningSession.update({ where: { id: existing.id }, data: { status: "REVOKED", revokedAt: new Date(), technicianId: null, assignment } });
    return existing;
  }
  if (existing && unchanged) return existing;
  for (const id of staffIds) {
    const technician = await tx.user.findUnique({ where: { id }, select: { isActive: true, name: true } });
    if (!technician?.isActive) throw new Error("The assigned technician account is inactive.");
    assignment.names.push(technician.name || "Technician");
  }
  for (const id of externalAgentIds) {
    const agent = await tx.projectExternalAgent.findUnique({ where: { id }, select: { isActive: true, name: true } });
    if (!agent?.isActive) throw new Error("The assigned agent is inactive.");
    assignment.names.push(agent.name);
  }
  const token = createCommissioningToken();
  const credentials = { assignment, technicianId: staffIds[0] || null, tokenHash: hashCommissioningToken(token), tokenCiphertext: encryptCommissioningToken(token), expiresAt: commissioningExpiry() };
  if (!existing) return tx.commissioningSession.create({ data: { receiptId, ...credentials, audit: [{ at: new Date().toISOString(), action: "ASSIGNMENT_COMMISSIONING_LINK_CREATED", actorId: actorId || null }] } });
  const data = record(existing.data);
  return tx.commissioningSession.update({ where: { id: existing.id, updatedAt: existing.updatedAt }, data: {
    ...credentials, status: "DRAFT", revokedAt: null, technicianSignedAt: null, lastStep: "panels", professionalReviewComment: null,
    data: { ...data, installerName: "", signatures: { ...record(data.signatures), technician: "", technicianSignedAt: null } } as Prisma.InputJsonValue,
    audit: appendCommissioningAudit(existing.audit, { at: new Date().toISOString(), action: "TECHNICIAN_REASSIGNED_AND_TOKEN_REPLACED", actorId: actorId || null, detail: { previousTechnicianId: existing.technicianId, technicianId } }),
  } });
}

export async function technicianMessagePreview(receiptId: string, origin: string, recipientId?: string) {
  const session = await prisma.commissioningSession.findUnique({ where: { receiptId }, include: {
    technician: { select: { name: true, phone: true, whatsappNumber: true, technicalProfile: { select: { phoneNumber: true } } } },
    receipt: { select: { receiptNumber: true, data: true, order: { select: { orderNumber: true, customerName: true, metadata: true } } } },
  } });
  if (!session || session.status === "REVOKED" || session.status === "ISSUED") throw new Error("An active commissioning assignment is required before sending the technician link.");
  const summary = projectSummary(session.receipt);
  const assigned = record(session.assignment);
  const staffIds = Array.isArray(assigned.staffIds) ? assigned.staffIds.map(String) : session.technicianId ? [session.technicianId] : [];
  const agentIds = Array.isArray(assigned.externalAgentIds) ? assigned.externalAgentIds.map(String) : [];
  const [staff, agents] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: staffIds }, isActive: true }, select: { id: true, name: true, phone: true, whatsappNumber: true, technicalProfile: { select: { phoneNumber: true } } } }),
    prisma.projectExternalAgent.findMany({ where: { id: { in: agentIds }, isActive: true }, select: { id: true, name: true, whatsappNumber: true } }),
  ]);
  const link = commissioningUrl(decryptCommissioningToken(session.tokenCiphertext), origin);
  const recipients = [
    ...staff.map(user => ({ id: `staff:${user.id}`, name: user.name || "Technician", phone: user.technicalProfile?.phoneNumber || user.phone || user.whatsappNumber || "" })),
    ...agents.map(agent => ({ id: `agent:${agent.id}`, name: agent.name, phone: agent.whatsappNumber || "" })),
  ].map(recipient => ({ ...recipient, message: technicianCommissioningSms({ name: recipient.name, reference: summary.reference, customer: summary.customerName, location: summary.location, link }) }));
  const recipient = recipientId ? recipients.find(item => item.id === recipientId) : recipients[0];
  if (!recipient) throw new Error("Assign an active technician or agent before sending the link.");
  return { session, ...recipient, link, recipients };
}

export async function sendTechnicianCommissioningLink(input: { receiptId: string; origin: string; manual?: boolean; recipientId?: string; actorId?: string | null }) {
  const preview = await technicianMessagePreview(input.receiptId, input.origin, input.recipientId);
  // Resending preserves the token and saved progress, including returned corrections.
  if (preview.session.expiresAt <= new Date()) await prisma.commissioningSession.update({ where: { id: preview.session.id }, data: { expiresAt: commissioningExpiry() } });
  return sendCommissioningSms({ sessionId: preview.session.id, kind: "TECHNICIAN_LINK", recipientName: preview.name, phone: preview.phone, message: preview.message, automaticKey: `technician:${preview.session.id}:${preview.session.tokenHash}:${preview.id}`, manual: input.manual, actorId: input.actorId });
}

export async function notifyAssignedCommissioningTechnician(receiptId: string, actorId?: string | null) {
  const session = await prisma.$transaction(async tx => {
    const receipt = await tx.receipt.findUnique({ where: { id: receiptId }, select: { data: true } });
    const flow = readReceiptProjectFlow(record(receipt?.data).projectFlow);
    const technicianId = flow?.handlerStaffIds[0] || flow?.handlerStaffId || null;
    return syncCommissioningAssignment(tx, receiptId, technicianId, actorId, { staffIds: flow?.handlerStaffIds || [], externalAgentIds: flow?.externalAgentIds || [] });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (!session || session.status === "ISSUED" || session.status === "REVOKED") return null;
  const origin = process.env.NEXT_PUBLIC_BASE_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://ops.betech.co.ke";
  const preview = await technicianMessagePreview(receiptId, origin);
  const results: Awaited<ReturnType<typeof sendTechnicianCommissioningLink>>[] = [];
  for (const recipient of preview.recipients) results.push(await sendTechnicianCommissioningLink({ receiptId, actorId, origin, recipientId: recipient.id }));
  return results;
}
