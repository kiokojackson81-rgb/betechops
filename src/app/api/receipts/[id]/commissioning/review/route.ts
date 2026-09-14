import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { appendCommissioningAudit, projectSummary } from "@/lib/commissioning";
import { activeLicensedProfessional, issueAutomaticCompletionCertificate } from "@/lib/professionalCommissioning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type ParamsContext = { params: Promise<{ id: string }> | { id: string } };
const schema = z.object({ action: z.enum(["approve", "return"]), step: z.enum(["panels", "array", "inverter", "battery", "final-photos", "commissioning", "handover", "review"]).optional(), reason: z.string().trim().max(1200).optional() });

async function findSession(receiptId: string) {
  return prisma.commissioningSession.findUnique({
    where: { receiptId },
    include: { technician: { select: { id: true, name: true } }, receipt: { select: { receiptNumber: true, data: true, order: { select: { orderNumber: true, customerName: true, metadata: true } } } } },
  });
}

export async function GET(_request: NextRequest, context: ParamsContext) {
  const guard = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!guard.ok) return guard.res;
  const reviewer = guard.session?.user as { id?: string; role?: string } | undefined;
  const configured = await activeLicensedProfessional();
  if (!["ADMIN", "SUPERVISOR"].includes(reviewer?.role || "") && (!configured.active || !configured.professional.userId || configured.professional.userId !== reviewer?.id)) return NextResponse.json({ error: "Professional review access is restricted." }, { status: 403 });
  const { id } = await context.params;
  const session = await findSession(id);
  if (!session) return NextResponse.json({ error: "Commissioning session not found." }, { status: 404 });
  const { professional, active } = await activeLicensedProfessional();
  return NextResponse.json({ ok: true, session: { id: session.id, status: session.status, progress: session.progress, technician: session.technician, project: projectSummary(session.receipt), data: session.data, customerAcceptedAt: session.customerTermsAcceptedAt, technicianSignedAt: session.technicianSignedAt, professionalApprovedAt: session.professionalApprovedAt, professionalReviewComment: session.professionalReviewComment }, professional: { ...professional, active } });
}

export async function POST(request: NextRequest, context: ParamsContext) {
  const guard = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!guard.ok) return guard.res;
  const reviewer = guard.session?.user as { id?: string; role?: string } | undefined;
  const configured = await activeLicensedProfessional();
  if (!["ADMIN", "SUPERVISOR"].includes(reviewer?.role || "") && (!configured.active || !configured.professional.userId || configured.professional.userId !== reviewer?.id)) return NextResponse.json({ error: "Professional review access is restricted." }, { status: 403 });
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid professional review action." }, { status: 400 });
  const session = await findSession(id);
  if (!session) return NextResponse.json({ error: "Commissioning session not found." }, { status: 404 });
  if (session.status !== "AWAITING_PROFESSIONAL_REVIEW") return NextResponse.json({ error: "This project is not awaiting professional review." }, { status: 409 });
  const user = guard.session?.user as { id?: string; name?: string | null; email?: string | null } | undefined;
  if (parsed.data.action === "return") {
    if (!parsed.data.reason) return NextResponse.json({ error: "Enter a correction reason before returning the project to the technician." }, { status: 400 });
    const updated = await prisma.commissioningSession.update({ where: { id: session.id, status: "AWAITING_PROFESSIONAL_REVIEW", updatedAt: session.updatedAt }, data: { status: "RETURNED_FOR_CORRECTION", lastStep: parsed.data.step || "review", expiresAt: new Date(Date.now() + 30 * 86400000), professionalReviewComment: parsed.data.reason, audit: appendCommissioningAudit(session.audit, { at: new Date().toISOString(), action: "RETURNED_TO_TECHNICIAN_FOR_CORRECTION", actorId: user?.id || null, detail: { reason: parsed.data.reason, step: parsed.data.step || "review" } }) } });
    return NextResponse.json({ ok: true, status: updated.status, message: "Returned to the assigned technician for correction." });
  }
  try {
  const issued = await issueAutomaticCompletionCertificate({ sessionId: session.id, origin: new URL(request.url).origin, actorId: user?.id || null, source: "STAFF_ACTION" });
  return NextResponse.json({ ok: true, status: issued.updated.status, certificateNo: issued.updated.certificateNo, issuedAt: issued.updated.issuedAt, delivery: issued.delivery, warranty: issued.warranty });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to certify installation." }, { status: 409 }); }
}
