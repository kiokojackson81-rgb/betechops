import type { NextRequest } from "next/server";
import { noStoreJson, requireRole } from "@/lib/api";
import type { ReturnStatus } from '@/lib/returns';
import { prisma } from "@/lib/prisma";
import { guardTransition } from "@/lib/returns";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const authz = await requireRole(["ADMIN"]);
  if (!authz.ok) return authz.res;
  const body = (await req.json().catch(() => ({}))) as { resolution?: string; orderItemId?: string; amount?: number | string; commissionImpact?: string; notes?: string };
  const { resolution, orderItemId, amount, commissionImpact, notes } = body;
  if (!resolution) return noStoreJson({ error: "resolution required" }, { status: 400 });
  const ret = await prisma.returnCase.findUnique({ where: { id } });
  if (!ret) return noStoreJson({ error: "Return not found" }, { status: 404 });
  if (ret.status !== "received") return noStoreJson({ error: "Cannot resolve before received" }, { status: 400 });
  const can = guardTransition("received" as unknown as ReturnStatus, "resolved", { role: String(authz.role) as 'ADMIN' | 'SUPERVISOR' | 'ATTENDANT', received: true });
  if (!can.ok) return noStoreJson({ error: can.reason }, { status: 400 });
  const before = ret;
  let adjId: string | undefined;
  if (orderItemId && amount) {
    const adj = await prisma.returnAdjustment.create({
      data: { returnCaseId: id, orderItemId, amount: Number(amount), commissionImpact: commissionImpact || "reverse", notes: notes || null },
    });
    adjId = adj.id;
  }
  const updated = await prisma.returnCase.update({ where: { id }, data: { status: "resolved", resolution } });
  const actorId = (authz.session as any)?.user?.id || '';
  await prisma.actionLog.create({ data: { actorId, entity: "ReturnCase", entityId: id, action: "RESOLVE", before, after: { ...updated, adjustmentId: adjId } } });
  return noStoreJson({ ok: true, id, status: updated.status, adjustmentId: adjId });
}
