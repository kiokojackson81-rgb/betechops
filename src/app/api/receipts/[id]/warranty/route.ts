import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api";
import { deliverWarrantyCertificate, getWarrantyCertificate, issueWarrantyCertificate } from "@/lib/warrantyCertificates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParamsContext = { params: Promise<{ id: string }> | { id: string } };
const bodySchema = z.object({ action: z.enum(["generate", "reissue", "send"]) });

export async function GET(_request: NextRequest, context: ParamsContext) {
  const guard = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!guard.ok) return guard.res;
  const { id } = await context.params;
  const certificates = await getWarrantyCertificate(id, true);
  return NextResponse.json({ ok: true, certificates });
}

export async function POST(request: NextRequest, context: ParamsContext) {
  const guard = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!guard.ok) return guard.res;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid warranty certificate action." }, { status: 400 });
  const { id } = await context.params;
  const user = guard.session?.user as { id?: string; name?: string | null; email?: string | null } | undefined;
  const actor = { issuedById: user?.id || null, issuedByName: user?.name || user?.email || "Betech administrator" };
  try {
    if (parsed.data.action === "send") {
      const certificate = await getWarrantyCertificate(id);
      if (!certificate) return NextResponse.json({ error: "Generate the warranty certificate before sending it." }, { status: 409 });
      const delivery = await deliverWarrantyCertificate({ certificateId: certificate.id, accountUrl: `${new URL(request.url).origin}/account/projects/${id}`, actorId: actor.issuedById });
      return NextResponse.json({ ok: true, certificate, delivery });
    }
    const issued = await issueWarrantyCertificate({ receiptId: id, origin: new URL(request.url).origin, reissue: parsed.data.action === "reissue", ...actor });
    return NextResponse.json({ ok: true, ...issued });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to issue the warranty certificate." }, { status: 409 });
  }
}
