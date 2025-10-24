import type { NextRequest } from "next/server";
import { noStoreJson, requireRole } from "@/lib/api";
import type { ReturnStatus } from '@/lib/returns';
import { prisma } from "@/lib/prisma";
import { guardTransition } from "@/lib/returns";
import { getEvidencePolicy } from "@/lib/config";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const authz = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!authz.ok) return authz.res;
  const body = (await req.json().catch(() => ({}))) as { to?: string; category?: string; evidence?: unknown[] };
  const { to, category, evidence } = body;
  if (!to) return noStoreJson({ error: "to required" }, { status: 400 });
  const ret = await prisma.returnCase.findUnique({ where: { id }, include: { evidence: true } });
  if (!ret) return noStoreJson({ error: "Return not found" }, { status: 404 });
  const policy = await getEvidencePolicy();
  const can = guardTransition(ret.status as unknown as ReturnStatus, String(to) as unknown as ReturnStatus, {
    role: String(authz.role) as 'ADMIN' | 'SUPERVISOR' | 'ATTENDANT',
    evidence: (evidence as any) || (ret.evidence as any),
    category: category || undefined,
    policy,
    received: ret.status === "received" || String(to) === "resolved",
  });
  if (!can.ok) return noStoreJson({ error: can.reason }, { status: 400 });
  const before = ret;
  const updated = await prisma.returnCase.update({ where: { id }, data: { status: String(to) } });
  await prisma.actionLog.create({ data: { actorId: (authz.session as any)?.user?.id || "", entity: "ReturnCase", entityId: id, action: "STATE", before, after: updated } });
  return noStoreJson({ ok: true, id, status: updated.status });
}
