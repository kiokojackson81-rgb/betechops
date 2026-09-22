import { commissioningPaymentState } from "@/lib/commissioningPayment";
import { projectEquipmentDefaults } from "@/lib/commissioningEquipment";
import { isReadyToIssue } from "@/lib/commissioningValidation";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  appendCommissioningAudit,
  findAccessibleCommissioningSession,
  projectSummary,
} from "@/lib/commissioning";
import { TERMS_URL } from "@/lib/publicLinks";
import { issueAutomaticCompletionCertificate } from "@/lib/professionalCommissioning";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ParamsContext = { params: Promise<{ token: string }> | { token: string } };

const draftSchema = z.object({
  lastStep: z.string().trim().min(1).max(80),
  progress: z.number().int().min(0).max(100),
  data: z.record(z.string(), z.unknown()),
});

async function publicSession(session: NonNullable<Awaited<ReturnType<typeof findAccessibleCommissioningSession>>>) {
  const defaults = await equipmentDefaults(session);
  const sessionData = asRecord(session.data);
  const site = asRecord(sessionData.site);
  const installation = asRecord(sessionData.installation);
  return {
    isCertifyingProfessional: false,
    professionalReviewComment: session.professionalReviewComment,
    status: session.status,
    readOnly: session.status !== "DRAFT" && session.status !== "RETURNED_FOR_CORRECTION",
    expiresAt: session.expiresAt,
    lastAccessedAt: session.lastAccessedAt,
    lastStep: session.lastStep,
    progress: session.progress,
    issuedAt: session.issuedAt,
    certificateNo: session.certificateNo,
    technicianName: String(sessionData.installerName || session.technician?.name || (asRecord(session.assignment).names as string[] | undefined)?.join(" / ") || "Installer / agent"),
    technicianSignatureUrl: session.technician?.technicalProfile?.signatureUrl || null,
    project: projectSummary(session.receipt),
    payment: commissioningPaymentState(session.receipt.order),
    data: {
      ...sessionData,
      installerName: String(sessionData.installerName || session.technician?.name || (asRecord(session.assignment).names as string[] | undefined)?.join(" / ") || ""),
      equipment: { ...defaults, ...asRecord(sessionData.equipment) },
      site: {
        county: asRecord(session.receipt.data).county || asRecord(session.receipt.order?.metadata).county || "",
        gps: asRecord(session.receipt.data).gps || asRecord(session.receipt.data).gpsCoordinates || "",
        ...site,
        premises: String(site.premises || "").trim() || "Residential",
      },
      installation: {
        ...installation,
        type: String(installation.type || "").trim() || "New Installation",
        systemConfiguration: String(installation.systemConfiguration || "").trim() || "Hybrid",
      },
    },
  };
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function equipmentDefaults(session: NonNullable<Awaited<ReturnType<typeof findAccessibleCommissioningSession>>>) {
  const metadata = asRecord(session.receipt.order?.metadata);
  const quoteId = metadata.quoteRequestId || asRecord(session.receipt.data).quoteRequestId;
  let quotation: unknown = {};
  if (typeof quoteId === "string" && quoteId) {
    const rows = await prisma.$queryRaw<Array<{ quotationData: unknown }>>`SELECT "quotationData" FROM "QuoteRequest" WHERE "id" = ${quoteId} LIMIT 1`;
    quotation = rows[0]?.quotationData;
  }
  return projectEquipmentDefaults(session.receipt.data, quotation, metadata);
}

function hasTermsAcceptance(data: Record<string, unknown>) {
  return asRecord(data.termsAcceptance).accepted === true;
}


export async function GET(_req: NextRequest, context: ParamsContext) {
  const { token } = await context.params;
  const session = await findAccessibleCommissioningSession(token);
  if (!session) return NextResponse.json({ error: "This commissioning link is invalid, revoked, or expired." }, { status: 404 });
  await prisma.commissioningSession.update({ where: { id: session.id }, data: { lastAccessedAt: new Date() } });
  return NextResponse.json({ session: await publicSession(session) });
}

export async function PATCH(req: NextRequest, context: ParamsContext) {
  const { token } = await context.params;
  const session = await findAccessibleCommissioningSession(token);
  if (!session) return NextResponse.json({ error: "This commissioning link is invalid, revoked, or expired." }, { status: 404 });
  if (session.status !== "DRAFT" && session.status !== "RETURNED_FOR_CORRECTION") return NextResponse.json({ error: "This commissioning record is awaiting professional review or has already been issued." }, { status: 409 });
  const parsed = draftSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid commissioning draft" }, { status: 400 });
  const now = new Date();
  const acceptedTerms = hasTermsAcceptance(parsed.data.data);
  const project = projectSummary(session.receipt);
  const incomingSignatures = asRecord(parsed.data.data.signatures);
  const savedSessionData = asRecord(session.data);
  const savedSignatures = asRecord(savedSessionData.signatures);
  const customerJustSigned = Boolean(incomingSignatures.customer) && !Boolean(savedSignatures.customer);
  const acceptedAt = acceptedTerms
    ? customerJustSigned ? now : session.customerTermsAcceptedAt ?? now
    : null;
  const nextData = {
    ...parsed.data.data,
    equipment: { ...await equipmentDefaults(session), ...asRecord(parsed.data.data.equipment) },
    signatures: {
      ...incomingSignatures,
      technicianSignedAt: incomingSignatures.technician ? (incomingSignatures.technician === savedSignatures.technician ? savedSignatures.technicianSignedAt || now.toISOString() : now.toISOString()) : null,
    },
    termsAcceptance: {
      ...asRecord(parsed.data.data.termsAcceptance),
      accepted: acceptedTerms,
      acceptedAt: acceptedAt?.toISOString() ?? null,
      termsVersionUrl: TERMS_URL,
      termsUrl: TERMS_URL,
      acceptedByCustomerName: project.customerName,
      customerName: project.customerName,
      certificateId: session.certificateNo ?? null,
      projectId: project.reference,
    },
    terms_accepted: acceptedTerms,
    terms_accepted_at: acceptedAt?.toISOString() ?? null,
    terms_version_url: TERMS_URL,
    terms_url: TERMS_URL,
    accepted_by_customer_name: project.customerName,
    customer_name: project.customerName,
    certificate_id: session.certificateNo ?? null,
    project_id: project.reference,
  };
  const updated = await prisma.commissioningSession.update({
    where: { id: session.id, status: session.status, updatedAt: session.updatedAt },
    data: {
      lastStep: parsed.data.lastStep,
      progress: parsed.data.progress,
      data: nextData as Prisma.InputJsonValue,
      customerTermsAcceptedAt: acceptedAt,
      customerSignedAt: incomingSignatures.customer ? (incomingSignatures.customer === savedSignatures.customer ? session.customerSignedAt || now : now) : null,
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
  if (!["DRAFT", "RETURNED_FOR_CORRECTION", "AWAITING_PROFESSIONAL_REVIEW"].includes(session.status)) return NextResponse.json({ error: "Certificate Issued — View Only" }, { status: 409 });
  const payload = await req.json().catch(() => ({}));
  if (payload?.action !== "issue") return NextResponse.json({ error: "Unsupported commissioning action" }, { status: 400 });
  const data = session.data && typeof session.data === "object" && !Array.isArray(session.data)
    ? session.data as Record<string, unknown>
    : {};
  const validation = isReadyToIssue(data);
  if (!validation.ready) return NextResponse.json({ error: "Complete equipment serials, system configuration, evidence, passing tests, handover, terms acceptance and signatures before issuing.", validation }, { status: 400 });
  try {
    const issued = await issueAutomaticCompletionCertificate({ sessionId: session.id, origin: new URL(req.url).origin, source: "PUBLIC_LINK", paymentDecision: payload.paymentDecision });
    return NextResponse.json({ ok: true, status: issued.updated.status, certificateNo: issued.updated.certificateNo, issuedAt: issued.updated.issuedAt, delivery: issued.delivery, warranty: issued.warranty, message: "Certificates issued using the configured supervisor signature and stamp." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to issue certificates." }, { status: 409 });
  }
}
