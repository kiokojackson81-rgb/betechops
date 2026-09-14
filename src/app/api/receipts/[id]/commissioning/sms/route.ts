import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getBranding } from "@/lib/branding";
import { decryptCommissioningToken, ensureCustomerCertificateToken } from "@/lib/commissioning";
import { technicianMessagePreview, sendTechnicianCommissioningLink } from "@/lib/commissioningAssignments";
import { customerProjectDocumentsSms } from "@/lib/projectDocumentMessages";
import { prepareProjectDocuments } from "@/lib/projectDocuments";
import { sendCustomerCertificateDelivery } from "@/lib/commissioningDelivery";
import { getWarrantyCertificate } from "@/lib/warrantyCertificates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

async function guardManager() {
  const guard = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!guard.ok) return guard;
  const user = guard.session?.user as { id?: string; role?: string };
  if (user.role !== "ATTENDANT") return guard;
  const branding = await getBranding();
  if (branding.licensedProfessional.active && branding.licensedProfessional.userId === user.id) return guard;
  return { ok: false as const, res: NextResponse.json({ error: "Certificate messaging access is restricted." }, { status: 403 }) };
}

export async function GET(request: NextRequest, { params }: Context) {
  const guard = await guardManager();
  if (!guard.ok) return guard.res;
  const { id } = await params;
  const session = await prisma.commissioningSession.findUnique({ where: { receiptId: id }, include: { receipt: { select: { receiptNumber: true, order: { select: { orderNumber: true, customerName: true, customerPhone: true } } } }, smsLogs: { orderBy: { createdAt: "desc" }, take: 50 } } });
  if (!session) return NextResponse.json({ error: "Assign a technician or create the commissioning link first." }, { status: 409 });
  const origin = request.nextUrl.origin;
  let recipients: Array<{ id: string; name: string; phone: string; message: string }> = [];
  let technician: { name: string; phone: string; message: string } | null = null;
  try { const preview = await technicianMessagePreview(id, origin); recipients = preview.recipients; technician = { name: preview.name, phone: preview.phone, message: preview.message }; } catch { /* No technician SMS after issuance or revocation. */ }
  const customerLink = session.customerTokenCiphertext ? `${origin}/certificate/${decryptCommissioningToken(session.customerTokenCiphertext)}` : null;
  const customer = session.status === "ISSUED" ? {
    name: session.receipt.order?.customerName || "Customer", phone: session.receipt.order?.customerPhone || "",
    message: customerLink ? customerProjectDocumentsSms({ name: session.receipt.order?.customerName || "Customer", reference: session.receipt.receiptNumber || session.receipt.order?.orderNumber || "Project", link: customerLink }) : null,
    ready: Boolean(customerLink && session.documentsReadyAt && session.projectReceiptPdfUrl && session.completionPdfUrl && await getWarrantyCertificate(id)),
  } : null;
  return NextResponse.json({ technician, recipients, customer, error: session.documentsError, history: session.smsLogs.map(log => ({ id: log.id, kind: log.kind, recipientName: log.recipientName, phone: log.phone, message: log.message, status: log.status, providerId: log.providerId, error: log.error, createdAt: log.createdAt, sentAt: log.sentAt })) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest, { params }: Context) {
  const guard = await guardManager();
  if (!guard.ok) return guard.res;
  const { id } = await params;
  const parsed = z.object({ action: z.enum(["technician", "customer", "prepare"]), recipientId: z.string().optional() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid SMS action." }, { status: 400 });
  const actorId = (guard.session?.user as { id?: string })?.id;
  try {
    if (parsed.data.action === "technician") {
      const delivery = await sendTechnicianCommissioningLink({ receiptId: id, origin: request.nextUrl.origin, manual: true, actorId, recipientId: parsed.data.recipientId });
      return NextResponse.json({ ok: delivery.status === "SENT", delivery, error: delivery.error }, { status: delivery.status === "FAILED" ? 502 : 200 });
    }
    const session = await prisma.commissioningSession.findUnique({ where: { receiptId: id } });
    if (!session || session.status !== "ISSUED") throw new Error("Professional certification is required before preparing customer documents.");
    if (parsed.data.action === "prepare") {
      await prepareProjectDocuments({ sessionId: session.id, origin: request.nextUrl.origin, actorId });
      return NextResponse.json({ ok: true, message: "Documents are ready. Preview and send the customer SMS." });
    }
    const token = await ensureCustomerCertificateToken(session.id);
    const delivery = await sendCustomerCertificateDelivery({ sessionId: session.id, certificateUrl: `${request.nextUrl.origin}/certificate/${token}`, actorId, manual: true });
    return NextResponse.json({ ok: delivery.status === "SENT", delivery, error: delivery.error }, { status: delivery.status === "FAILED" ? 502 : 200 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to send SMS." }, { status: 409 }); }
}
