import { noStoreJson, requireRole, getActorId } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;
  const { unitCost } = await req.json().catch(() => ({} as any));
  if (unitCost == null) return noStoreJson({ error: "unitCost required" }, { status: 400 });
  const row = await (prisma as any).orderCost.create({ data: { orderItemId: params.id, unitCost: Number(unitCost), costSource: "override" } });
  const actorId = await getActorId();
  if (actorId) await (prisma as any).actionLog.create({ data: { actorId, entity: "OrderCost", entityId: row.id, action: "OVERRIDE", before: null, after: row } });
  return noStoreJson({ ok: true, id: params.id });
}
