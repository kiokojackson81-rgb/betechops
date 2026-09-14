import { prepareProjectDocuments } from "@/lib/projectDocuments";
import { ensureCustomerCertificateToken, sendCustomerCertificateDelivery } from "@/lib/commissioningDelivery";
import { activeLicensedProfessional } from "@/lib/professionalCommissioning";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api";
import { getWarrantyCertificate, issueWarrantyCertificate, warrantyReadiness, previewWarrantyCertificate, updateWarrantyCoverage } from "@/lib/warrantyCertificates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParamsContext = { params: Promise<{ id: string }> | { id: string } };
const bodySchema = z.object({
  action: z.enum(["generate", "reissue", "send", "status", "replace"]),
  reason: z.string().trim().min(1).max(1200).optional(),
  status: z.enum(["ACTIVE", "EXPIRED", "VOID", "REPLACED", "UNDER_CLAIM"]).optional(),
  warrantyYears: z.array(z.number().positive().max(50)).max(51).optional(),
  replacement: z.object({ index: z.number().int().min(0).max(50), brand: z.string().trim().min(1).max(100), modelCapacity: z.string().trim().min(1).max(200), serialNumbers: z.string().trim().min(1).max(2000), replacementDate: z.string().date(), claimReference: z.string().trim().min(1).max(200) }).optional(),
});

export async function GET(_request: NextRequest, context: ParamsContext) {
  const guard = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!guard.ok) return guard.res;
  const viewer = guard.session?.user as { id?: string; role?: string } | undefined;
  if (!["ADMIN", "SUPERVISOR"].includes(viewer?.role || "")) {
    const configured = await activeLicensedProfessional();
    if (!configured.active || !configured.professional.userId || configured.professional.userId !== viewer?.id) return NextResponse.json({ error: "Certificate management is restricted." }, { status: 403 });
  }
  const { id } = await context.params;
  if (new URL(_request.url).searchParams.get("preview") === "1") {
    try {
      const pdf = await previewWarrantyCertificate(id);
      return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=warranty-preview.pdf", "Cache-Control": "no-store" } });
    } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to preview warranty." }, { status: 409 }); }
  }
  const [certificates, readiness] = await Promise.all([getWarrantyCertificate(id, true), warrantyReadiness(id)]);
  return NextResponse.json({ ok: true, certificates, readiness });
}

export async function POST(request: NextRequest, context: ParamsContext) {
  const guard = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!guard.ok) return guard.res;
  const viewer = guard.session?.user as { id?: string; role?: string } | undefined;
  if (!["ADMIN", "SUPERVISOR"].includes(viewer?.role || "")) {
    const configured = await activeLicensedProfessional();
    if (!configured.active || !configured.professional.userId || configured.professional.userId !== viewer?.id) return NextResponse.json({ error: "Certificate management is restricted." }, { status: 403 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid warranty certificate action." }, { status: 400 });
  const { id } = await context.params;
  const user = guard.session?.user as { id?: string; name?: string | null; email?: string | null } | undefined;
  const actor = { issuedById: user?.id || null, issuedByName: user?.name || user?.email || "Betech administrator" };
  try {
    if (parsed.data.action === "status" || parsed.data.action === "replace") {
      if (!user?.id || !parsed.data.reason || (parsed.data.action === "replace" ? !parsed.data.replacement : !parsed.data.status)) return NextResponse.json({ error: "Complete all fields and enter a reason." }, { status: 400 });
      const history = await updateWarrantyCoverage({ receiptId: id, actorId: user.id, reason: parsed.data.reason, status: parsed.data.action === "status" ? parsed.data.status : undefined, replacement: parsed.data.action === "replace" ? parsed.data.replacement : undefined });
      return NextResponse.json({ ok: true, history });
    }
    if (parsed.data.action === "send") {
      const certificate = await getWarrantyCertificate(id);
      if (!certificate) return NextResponse.json({ error: "Generate the warranty certificate before sending it." }, { status: 409 });
      await prepareProjectDocuments({ sessionId: certificate.commissioningSessionId, origin: new URL(request.url).origin, actorId: actor.issuedById });
      const token = await ensureCustomerCertificateToken(certificate.commissioningSessionId);
      const delivery = await sendCustomerCertificateDelivery({ sessionId: certificate.commissioningSessionId, certificateUrl: `${new URL(request.url).origin}/certificate/${token}`, actorId: actor.issuedById, manual: true });
      return NextResponse.json({ ok: delivery.status === "SENT", certificate, delivery, error: delivery.error }, { status: delivery.status === "FAILED" ? 502 : 200 });
    }
    if (parsed.data.action === "reissue" && !parsed.data.reason) return NextResponse.json({ error: "Enter the reason for reissuing the warranty certificate." }, { status: 400 });
    const issued = await issueWarrantyCertificate({ receiptId: id, origin: new URL(request.url).origin, reissue: parsed.data.action === "reissue", reason: parsed.data.reason, warrantyYears: parsed.data.warrantyYears, ...actor });
    return NextResponse.json({ ok: true, ...issued });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to issue the warranty certificate." }, { status: 409 });
  }
}
