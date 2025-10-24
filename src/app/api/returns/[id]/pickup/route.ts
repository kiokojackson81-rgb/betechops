import type { NextRequest } from "next/server";
import { noStoreJson, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { resolveShopScope } from "@/lib/scope";
import { guardTransition } from "@/lib/returns";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const authz = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!authz.ok) return authz.res;
  const { scheduledAt, carrier, tracking, assignedTo, notes } = await req.json().catch(() => ({} as any));
  if (!scheduledAt || !carrier || !assignedTo) return noStoreJson({ error: "scheduledAt, carrier, assignedTo required" }, { status: 400 });

  const ret = await prisma.returnCase.findUnique({ where: { id } });
  if (!ret) return noStoreJson({ error: "Return not found" }, { status: 404 });

  const scope = await resolveShopScope();
  if (scope.role !== "ADMIN" as any && scope.shopIds && !scope.shopIds.includes(ret.shopId)) {
    return noStoreJson({ error: "Forbidden" }, { status: 403 });
  }

  const can = guardTransition(ret.status as any, "pickup_scheduled", { role: (scope.role as any) });
  if (!can.ok) return noStoreJson({ error: can.reason }, { status: 400 });

  const before = ret;
  const pickup = await prisma.returnPickup.create({
    data: { returnCaseId: id, scheduledAt: new Date(scheduledAt), carrier, tracking: tracking || null, assignedTo, notes: notes || null },
  });
  const updated = await prisma.returnCase.update({ where: { id }, data: { status: "pickup_scheduled" } });
  await prisma.actionLog.create({ data: { actorId: assignedTo, entity: "ReturnCase", entityId: id, action: "PICKUP_SCHEDULED", before, after: { ...updated, pickupId: pickup.id } } });
  return noStoreJson({ ok: true, id, status: updated.status, pickupId: pickup.id });
}
