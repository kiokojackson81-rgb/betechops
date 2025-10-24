import { noStoreJson, requireRole, getActorId } from "@/lib/api";
import { z } from "zod";
import { recomputeCommissions } from "@/lib/commissionRecompute";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.ok) return auth.res;
  const schema = z.object({
    shopId: z.string().optional().nullable(),
    from: z.coerce.date(),
    to: z.coerce.date(),
  });
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  const { shopId, from, to } = parsed.data;

  const res = await recomputeCommissions({ shopId: shopId || undefined, window: { from, to } });
  const actorId = await getActorId();
  await prisma.actionLog.create({ data: { actorId: actorId || "", entity: "CommissionEarning", entityId: "batch", action: "RECOMPUTE", before: undefined, after: res } });
  return noStoreJson({ ok: true, ...res });
}
