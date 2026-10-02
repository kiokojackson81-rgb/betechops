import { z } from "zod";
import { getActorId, noStoreJson, requireRole } from "@/lib/api";
import { getSerializedLppAccountDetail, refundLpp } from "@/lib/lipaPolePoleService";

export const dynamic = "force-dynamic";

const schema = z.object({
  amount: z.coerce.number().positive(),
  refundMethod: z.string().trim().min(2).max(120),
  refundReference: z.string().trim().max(255).optional().nullable(),
  reason: z.string().trim().min(3).max(1000),
});

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? await getActorId();
  try {
    const { id } = await context.params;
    await refundLpp({ lipaPolePoleId: id, createdById: actorId, approvedById: actorId, ...parsed.data });
    return noStoreJson({ ok: true, ...(await getSerializedLppAccountDetail(id)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record refund";
    return noStoreJson({ error: message }, { status: message === "LPP_NOT_FOUND" ? 404 : 400 });
  }
}
