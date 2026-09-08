import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  appendCommissioningAudit,
  commissioningExpiry,
  commissioningUrl,
  createCommissioningToken,
  decryptCommissioningToken,
  encryptCommissioningToken,
  hashCommissioningToken,
  projectSummary,
} from "@/lib/commissioning";
import { ensureCustomerCertificateToken, sendCustomerCertificateDelivery } from "@/lib/commissioningDelivery";

export const dynamic = "force-dynamic";

type ParamsContext = { params: Promise<{ id: string }> | { id: string } };

const schema = z.object({
  action: z.enum(["create", "resend", "regenerate", "revoke", "reassign", "deliver-certificate"]),
  technicianId: z.string().trim().min(1).optional(),
});

const staffSelect = { id: true, name: true, isActive: true } as const;

async function receiptForCommissioning(id: string) {
  return prisma.receipt.findUnique({
    where: { id },
    select: {
      id: true,
      receiptNumber: true,
      data: true,
      order: { select: { orderNumber: true, customerName: true, metadata: true } },
      commissioningSession: {
        include: { technician: { select: { id: true, name: true } } },
      },
    },
  });
}

function adminSessionView(receipt: NonNullable<Awaited<ReturnType<typeof receiptForCommissioning>>>) {
  const session = receipt.commissioningSession;
  return {
    project: projectSummary(receipt),
    session: session
      ? {
          id: session.id,
          status: session.status,
          technician: session.technician,
          progress: session.progress,
          lastStep: session.lastStep,
          expiresAt: session.expiresAt,
          lastAccessedAt: session.lastAccessedAt,
          issuedAt: session.issuedAt,
          certificateNo: session.certificateNo,
          revokedAt: session.revokedAt,
        }
      : null,
  };
}

export async function GET(_req: NextRequest, context: ParamsContext) {
  const guard = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!guard.ok) return guard.res;
  const { id } = await context.params;
  const receipt = await receiptForCommissioning(id);
  if (!receipt) return NextResponse.json({ error: "Project receipt not found" }, { status: 404 });
  return NextResponse.json(adminSessionView(receipt));
}

export async function POST(req: NextRequest, context: ParamsContext) {
  const guard = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!guard.ok) return guard.res;
  const { id } = await context.params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid commissioning action" }, { status: 400 });

  const receipt = await receiptForCommissioning(id);
  if (!receipt) return NextResponse.json({ error: "Project receipt not found" }, { status: 404 });
  const actorId = String((guard.session?.user as { id?: string } | undefined)?.id || "").trim() || null;
  const existing = receipt.commissioningSession;
  const action = parsed.data.action;

  if (action === "deliver-certificate") {
    if (!existing || existing.status !== "ISSUED") {
      return NextResponse.json({ error: "Issue the commissioning certificate before sending it to the customer." }, { status: 409 });
    }
    const createdToken = await ensureCustomerCertificateToken(existing.id);
    const customerToken = createdToken || decryptCommissioningToken(existing.customerTokenCiphertext || "");
    const link = `${new URL(req.url).origin}/certificate/${customerToken}`;
    const delivery = await sendCustomerCertificateDelivery({ sessionId: existing.id, certificateUrl: link, actorId });
    return NextResponse.json({ ok: true, link, delivery, message: "Certificate delivery has been sent to the customer channels available on the project." });
  }

  if (action === "revoke") {
    if (!existing) return NextResponse.json({ error: "No commissioning link exists for this project" }, { status: 404 });
    await prisma.commissioningSession.update({
      where: { id: existing.id },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        audit: appendCommissioningAudit(existing.audit, { at: new Date().toISOString(), action: "LINK_REVOKED", actorId }),
      },
    });
    return NextResponse.json({ ok: true, message: "Commissioning link revoked." });
  }

  if (existing?.status === "ISSUED" && ["regenerate", "reassign"].includes(action)) {
    return NextResponse.json({ error: "This certificate is issued and its technician link is view-only." }, { status: 409 });
  }

  const needsTechnician = !existing || action === "reassign";
  const technicianId = parsed.data.technicianId || existing?.technicianId || undefined;
  if (needsTechnician && !technicianId) {
    return NextResponse.json({ error: "Choose the assigned technician first." }, { status: 400 });
  }
  const technician = technicianId ? await prisma.user.findUnique({ where: { id: technicianId }, select: staffSelect }) : null;
  if (technicianId && (!technician || !technician.isActive)) {
    return NextResponse.json({ error: "The selected technician is unavailable." }, { status: 400 });
  }

  // Create/send/resend deliberately return the same URL. They never rotate a token.
  if (["create", "resend"].includes(action) && existing && existing.status === "DRAFT" && existing.expiresAt > new Date()) {
    if (parsed.data.technicianId && parsed.data.technicianId !== existing.technicianId) {
      return NextResponse.json({ error: "Use Reassign technician to invalidate the old link and authorize another technician." }, { status: 409 });
    }
    return NextResponse.json({
      ok: true,
      reused: true,
      link: commissioningUrl(decryptCommissioningToken(existing.tokenCiphertext), new URL(req.url).origin),
      message: "Use the existing commissioning link; no new token was generated.",
      session: adminSessionView(receipt).session,
    });
  }

  const token = createCommissioningToken();
  const tokenHash = hashCommissioningToken(token);
  const tokenCiphertext = encryptCommissioningToken(token);
  const createdAt = new Date();
  const event = action === "reassign" ? "TECHNICIAN_REASSIGNED_AND_TOKEN_REPLACED" : existing ? "TOKEN_REGENERATED" : "LINK_CREATED";
  const nextSession = existing
    ? await prisma.commissioningSession.update({
        where: { id: existing.id },
        data: {
          technicianId: technicianId ?? null,
          tokenHash,
          tokenCiphertext,
          status: "DRAFT",
          revokedAt: null,
          expiresAt: commissioningExpiry(),
          audit: appendCommissioningAudit(existing.audit, {
            at: createdAt.toISOString(), action: event, actorId,
            detail: { technicianId: technicianId ?? null },
          }),
        },
        include: { technician: { select: { id: true, name: true } } },
      })
    : await prisma.commissioningSession.create({
        data: {
          receiptId: id,
          technicianId: technicianId ?? null,
          tokenHash,
          tokenCiphertext,
          expiresAt: commissioningExpiry(),
          audit: [{ at: createdAt.toISOString(), action: event, actorId, detail: { technicianId: technicianId ?? null } }],
        },
        include: { technician: { select: { id: true, name: true } } },
      });
  const origin = new URL(req.url).origin;
  return NextResponse.json({
    ok: true,
    link: commissioningUrl(token, origin),
    tokenCreated: true,
    session: {
      id: nextSession.id, status: nextSession.status, technician: nextSession.technician,
      progress: nextSession.progress, lastStep: nextSession.lastStep, expiresAt: nextSession.expiresAt,
    },
  });
}
