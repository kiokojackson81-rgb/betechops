import { noStoreJson, requireRole } from "@/lib/api";

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;
  const { from, to, shopId } = await req.json().catch(() => ({} as any));
  // TODO: run recompute now or enqueue background job
  return noStoreJson({ ok: true, accepted: true, window: { from, to }, shopId: shopId || null });
}
