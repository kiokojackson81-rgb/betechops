import { getWarrantyCertificate } from "@/lib/warrantyCertificates";
import { PROJECT_DOCUMENT_ORDER, PROJECT_DOCUMENT_LABELS } from "@/lib/projectDocumentMessages";
import { ensureReviewInvitationForReceipt, getReferralRewardPreviewForReceipt } from "@/lib/reviewsReferrals";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appendCommissioningAudit, findCustomerCertificateSession, projectSummary } from "@/lib/commissioning";

export const dynamic = "force-dynamic";
type ParamsContext = { params: Promise<{ token: string }> | { token: string } };

export async function GET(_req: NextRequest, context: ParamsContext) {
  const { token } = await context.params;
  const session = await findCustomerCertificateSession(token);
  if (!session) return NextResponse.json({ error: "This certificate link is invalid or unavailable." }, { status: 404 });
  const warranty = await getWarrantyCertificate(session.receiptId);
  const review = await ensureReviewInvitationForReceipt(session.receiptId, {
    completedAt: session.issuedAt || undefined,
    deliveryMode: "project",
  }).catch(() => null);
  const referralReward = review?.reviewUrl
    ? await getReferralRewardPreviewForReceipt(session.receiptId).catch(() => null)
    : null;
  const available = { receipt: Boolean(session.projectReceiptPdfUrl), completion: Boolean(session.completionPdfUrl), warranty: Boolean(warranty) };
  return NextResponse.json({
    status: "COMPLETED",
    documentsReady: PROJECT_DOCUMENT_ORDER.every(kind => available[kind]),
    documents: PROJECT_DOCUMENT_ORDER.map(kind => ({ kind, label: PROJECT_DOCUMENT_LABELS[kind], available: available[kind], url: `/api/certificate/${encodeURIComponent(token)}/documents/${kind}` })),
    certificateNo: session.certificateNo,
    issuedAt: session.issuedAt,
    technicianName: session.technician?.name || "Betech technician",
    project: projectSummary(session.receipt),
    acknowledgedAt: session.customerAcknowledgedAt,
    termsAcceptedAt: session.customerTermsAcceptedAt,
    reviewUrl: review?.reviewUrl || null,
    referralReward,
  }, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" } });
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
      customerAcknowledgedAt: session.customerAcknowledgedAt || now,
      customerTermsAcceptedAt: session.customerTermsAcceptedAt || now,
      audit: appendCommissioningAudit(session.audit, { at: now.toISOString(), action: "CUSTOMER_ACCEPTED_COMPLETION_AND_TERMS" }),
    },
  });
  return NextResponse.json({ ok: true, acknowledgedAt: now, termsAcceptedAt: now });
}
