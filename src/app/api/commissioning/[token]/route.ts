import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  appendCommissioningAudit,
  certificateNumber,
  findAccessibleCommissioningSession,
  projectSummary,
} from "@/lib/commissioning";
import { ensureCustomerCertificateToken, sendCustomerCertificateDelivery } from "@/lib/commissioningDelivery";
import { TERMS_URL } from "@/lib/publicLinks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ParamsContext = { params: Promise<{ token: string }> | { token: string } };

const draftSchema = z.object({
  lastStep: z.string().trim().min(1).max(80),
  progress: z.number().int().min(0).max(100),
  data: z.record(z.string(), z.unknown()),
});

function publicSession(session: NonNullable<Awaited<ReturnType<typeof findAccessibleCommissioningSession>>>) {
  return {
    status: session.status,
    readOnly: session.status === "ISSUED",
    expiresAt: session.expiresAt,
    lastAccessedAt: session.lastAccessedAt,
    lastStep: session.lastStep,
    progress: session.progress,
    issuedAt: session.issuedAt,
    certificateNo: session.certificateNo,
    technicianName: session.technician?.name || "Assigned technician",
    project: projectSummary(session.receipt),
    data: session.data && typeof session.data === "object" && !Array.isArray(session.data) ? session.data : {},
  };
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function hasTermsAcceptance(data: Record<string, unknown>) {
  return asRecord(data.termsAcceptance).accepted === true;
}

function isReadyToIssue(data: Record<string, unknown>) {
  const evidence = data.evidence && typeof data.evidence === "object" ? data.evidence as Record<string, unknown> : {};
  const signatures = data.signatures && typeof data.signatures === "object" ? data.signatures as Record<string, unknown> : {};
  const checklist = data.checklist && typeof data.checklist === "object" ? data.checklist as Record<string, unknown> : {};
  const handover = data.handover && typeof data.handover === "object" ? data.handover as Record<string, unknown> : {};
  const requiredEvidence = ["panelLabel", "panelArray", "inverterLabel", "inverterInstallation", "batteryLabel", "batteryInstallation"];
  const requiredChecklist = ["Inverter powers ON", "PV charging detected", "Battery charging", "Battery discharging", "Grid input detected", "Backup/changeover tested", "Protection devices installed", "Earthing connected", "Monitoring configured", "Customer training completed"];
  const requiredHandover = ["System operation", "Shutdown/startup", "Monitoring", "Warranty", "Load limitations", "Maintenance", "Fault reporting"];
  const missingEvidence = requiredEvidence.filter((key) => !Array.isArray(evidence[key]) || !(evidence[key] as unknown[]).length);
  const missingChecklist = requiredChecklist.filter((key) => !checklist[key]);
  const missingHandover = requiredHandover.filter((key) => handover[key] !== true);
  return {
    ready: missingEvidence.length === 0 && missingChecklist.length === 0 && missingHandover.length === 0 && hasTermsAcceptance(data) && Boolean(signatures.customer) && Boolean(signatures.technician),
    missingEvidence,
    missingChecklist,
    missingHandover,
    termsAccepted: hasTermsAcceptance(data),
    missingSignatures: [!signatures.customer ? "customer" : null, !signatures.technician ? "technician" : null].filter(Boolean),
    checklistComplete: missingChecklist.length === 0,
  };
}

export async function GET(_req: NextRequest, context: ParamsContext) {
  const { token } = await context.params;
  const session = await findAccessibleCommissioningSession(token);
  if (!session) return NextResponse.json({ error: "This commissioning link is invalid, revoked, or expired." }, { status: 404 });
  await prisma.commissioningSession.update({ where: { id: session.id }, data: { lastAccessedAt: new Date() } });
  return NextResponse.json({ session: publicSession(session) });
}

export async function PATCH(req: NextRequest, context: ParamsContext) {
  const { token } = await context.params;
  const session = await findAccessibleCommissioningSession(token);
  if (!session) return NextResponse.json({ error: "This commissioning link is invalid, revoked, or expired." }, { status: 404 });
  if (session.status !== "DRAFT") return NextResponse.json({ error: "Certificate Issued — View Only" }, { status: 409 });
  const parsed = draftSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid commissioning draft" }, { status: 400 });
  const now = new Date();
  const acceptedTerms = hasTermsAcceptance(parsed.data.data);
  const project = projectSummary(session.receipt);
  const acceptedAt = acceptedTerms
    ? session.customerTermsAcceptedAt ?? now
    : null;
  const nextData = {
    ...parsed.data.data,
    termsAcceptance: {
      ...asRecord(parsed.data.data.termsAcceptance),
      accepted: acceptedTerms,
      acceptedAt: acceptedAt?.toISOString() ?? null,
      termsVersionUrl: TERMS_URL,
      acceptedByCustomerName: project.customerName,
      certificateId: session.certificateNo ?? null,
      projectId: project.reference,
    },
    terms_accepted: acceptedTerms,
    terms_accepted_at: acceptedAt?.toISOString() ?? null,
    terms_version_url: TERMS_URL,
    accepted_by_customer_name: project.customerName,
    certificate_id: session.certificateNo ?? null,
    project_id: project.reference,
  };
  const updated = await prisma.commissioningSession.update({
    where: { id: session.id },
    data: {
      lastStep: parsed.data.lastStep,
      progress: parsed.data.progress,
      data: nextData as Prisma.InputJsonValue,
      customerTermsAcceptedAt: acceptedAt,
      lastAccessedAt: now,
      audit: acceptedTerms && !session.customerTermsAcceptedAt
        ? appendCommissioningAudit(session.audit, { at: now.toISOString(), action: "CUSTOMER_TERMS_ACCEPTED", detail: { termsVersionUrl: TERMS_URL, customerName: project.customerName, projectId: project.reference } })
        : undefined,
    },
  });
  return NextResponse.json({ ok: true, savedAt: updated.updatedAt });
}

export async function POST(req: NextRequest, context: ParamsContext) {
  const { token } = await context.params;
  const session = await findAccessibleCommissioningSession(token);
  if (!session) return NextResponse.json({ error: "This commissioning link is invalid, revoked, or expired." }, { status: 404 });
  if (session.status === "ISSUED") return NextResponse.json({ error: "Certificate Issued — View Only" }, { status: 409 });
  const payload = await req.json().catch(() => ({}));
  if (payload?.action !== "issue") return NextResponse.json({ error: "Unsupported commissioning action" }, { status: 400 });
  const data = session.data && typeof session.data === "object" && !Array.isArray(session.data)
    ? session.data as Record<string, unknown>
    : {};
  const validation = isReadyToIssue(data);
  if (!validation.ready) return NextResponse.json({ error: "Complete the required evidence, checklist, customer handover, Terms & Conditions acceptance, and signatures before issuing.", validation }, { status: 400 });
  const reference = projectSummary(session.receipt).reference;
  const issuedAt = new Date();
  const certificateNo = certificateNumber(reference);
  const acceptedAt = session.customerTermsAcceptedAt ?? issuedAt;
  const certificateData = {
    ...data,
    termsAcceptance: {
      ...asRecord(data.termsAcceptance),
      accepted: true,
      acceptedAt: acceptedAt.toISOString(),
      termsVersionUrl: TERMS_URL,
      acceptedByCustomerName: projectSummary(session.receipt).customerName,
      certificateId: certificateNo,
      projectId: reference,
    },
    terms_accepted: true,
    terms_accepted_at: acceptedAt.toISOString(),
    terms_version_url: TERMS_URL,
    accepted_by_customer_name: projectSummary(session.receipt).customerName,
    certificate_id: certificateNo,
    project_id: reference,
  };
  const updated = await prisma.commissioningSession.update({
    where: { id: session.id },
    data: {
      status: "ISSUED",
      issuedAt,
      progress: 100,
      certificateNo,
      customerTermsAcceptedAt: acceptedAt,
      data: certificateData as Prisma.InputJsonValue,
      audit: appendCommissioningAudit(session.audit, { at: issuedAt.toISOString(), action: "CERTIFICATE_ISSUED", detail: { technicianId: session.technicianId, certificateNo, termsVersionUrl: TERMS_URL } }),
    },
  });
  let delivery: unknown = null;
  try {
    const customerToken = await ensureCustomerCertificateToken(updated.id);
    if (customerToken) {
      delivery = await sendCustomerCertificateDelivery({
        sessionId: updated.id,
        certificateUrl: `${new URL(req.url).origin}/certificate/${customerToken}`,
        actorId: session.technicianId,
      });
    }
  } catch (error) {
    console.error("[commissioning] certificate issued but customer delivery failed", error);
    delivery = { error: "Certificate issued, but automatic customer delivery needs attention." };
  }
  return NextResponse.json({ ok: true, status: updated.status, certificateNo: updated.certificateNo, issuedAt: updated.issuedAt, delivery });
}
