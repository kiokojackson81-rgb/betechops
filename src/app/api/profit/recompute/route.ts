import { noStoreJson, requireRole, getActorId } from "@/lib/api";
import { recomputeProfit } from "@/lib/profitRecompute";
import { z } from "zod";

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;
  const body = await req.json().catch(() => ({}));
  const schema = z.object({ from: z.string().optional(), to: z.string().optional(), shopId: z.string().nullable().optional() });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  const now = new Date();
  const fromAt = parsed.data.from ? new Date(parsed.data.from) : new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const toAt = parsed.data.to ? new Date(parsed.data.to) : now;
  if (isNaN(fromAt.getTime()) || isNaN(toAt.getTime())) return noStoreJson({ error: "invalid from/to" }, { status: 400 });
  const actorId = await getActorId();
  const { snapshots } = await recomputeProfit({ from: fromAt, to: toAt, shopId: parsed.data.shopId || undefined, actorId });
  return noStoreJson({ ok: true, window: { from: fromAt.toISOString(), to: toAt.toISOString() }, shopId: parsed.data.shopId || null, snapshots });
}
