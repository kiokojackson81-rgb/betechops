import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appendCommissioningAudit, findCustomerCertificateSession, projectSummary } from "@/lib/commissioning";

export const dynamic = "force-dynamic";
type ParamsContext = { params: Promise<{ token: string }> | { token: string } };

export async function GET(_req: NextRequest, context: ParamsContext) {
  const { token } = await context.params;
  const session = await findCustomerCertificateSession(token);
  if (!session) return NextResponse.json({ error: "This certificate link is invalid or unavailable." }, { status: 404 });
  return NextResponse.json({
    certificateNo: session.certificateNo,
    issuedAt: session.issuedAt,
    technicianName: session.technician?.name || "Betech technician",
    project: projectSummary(session.receipt),
    acknowledgedAt: session.customerAcknowledgedAt,
    termsAcceptedAt: session.customerTermsAcceptedAt,
  });
}

export async function POST(req: NextRequest, context: ParamsContext) {
  const { token } = await context.params;
  const session = await findCustomerCertificateSession(token);
  if (!session) return NextResponse.json({ error: "This certificate link is invalid or unavailable." }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  if (!body?.installationCompleted || !body?.termsAccepted) {
    return NextResponse.json({ error: "Confirm installation completion and accept the installation terms first." }, { status: 400 });
  }
  const now = new Date();
  await prisma.commissioningSession.update({
    where: { id: session.id },
    data: {
      customerAcknowledgedAt: now,
      customerTermsAcceptedAt: now,
      audit: appendCommissioningAudit(session.audit, { at: now.toISOString(), action: "CUSTOMER_ACCEPTED_COMPLETION_AND_TERMS" }),
    },
  });
  return NextResponse.json({ ok: true, acknowledgedAt: now, termsAcceptedAt: now });
}
