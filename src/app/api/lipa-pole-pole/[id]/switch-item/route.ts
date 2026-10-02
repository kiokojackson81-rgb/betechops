import { z } from "zod";
import { getActorId, noStoreJson, requireRole } from "@/lib/api";
import { getSerializedLppAccountDetail, switchLppItem } from "@/lib/lipaPolePoleService";

export const dynamic = "force-dynamic";

const schema = z.object({
  productId: z.string().trim().min(1),
  description: z.string().trim().min(2).max(500),
  quantity: z.coerce.number().int().min(1).max(1000),
  unitPrice: z.coerce.number().positive(),
  serial: z.string().trim().max(255).optional().nullable(),
  warranty: z.string().trim().max(255).optional().nullable(),
  reason: z.string().trim().min(3).max(1000),
});

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? await getActorId();
  try {
    const { id } = await context.params;
    await switchLppItem({ lipaPolePoleId: id, changedById: actorId, ...parsed.data });
    return noStoreJson({ ok: true, ...(await getSerializedLppAccountDetail(id)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to switch item";
    return noStoreJson({ error: message }, { status: message === "LPP_NOT_FOUND" ? 404 : 400 });
  }
}
