import type { NextRequest } from "next/server";
import { noStoreJson, requireRole, getActorId } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;
  const { unitCost } = await req.json().catch(() => ({} as any));
  if (unitCost == null) return noStoreJson({ error: "unitCost required" }, { status: 400 });
  const row = await prisma.orderCost.create({ data: { orderItemId: id, unitCost: Number(unitCost), costSource: "override" } });
  const actorId = await getActorId();
  if (actorId) await prisma.actionLog.create({ data: { actorId, entity: "OrderCost", entityId: row.id, action: "OVERRIDE", before: undefined, after: row } });
  return noStoreJson({ ok: true, id });
}
