import { noStoreJson, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { guardTransition } from "@/lib/returns";
import { getEvidencePolicy } from "@/lib/config";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const authz = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!authz.ok) return authz.res;
  const { to, category, evidence } = await req.json().catch(() => ({} as any));
  if (!to) return noStoreJson({ error: "to required" }, { status: 400 });
  const ret = await (prisma as any).returnCase.findUnique({ where: { id: params.id }, include: { evidence: true } });
  if (!ret) return noStoreJson({ error: "Return not found" }, { status: 404 });
  const policy = await getEvidencePolicy();
  const can = guardTransition(ret.status as any, String(to) as any, {
    role: (authz.role as any),
    evidence: evidence || ret.evidence,
    category: category || undefined,
    policy,
    received: ret.status === "received" || String(to) === "resolved",
  });
  if (!can.ok) return noStoreJson({ error: can.reason }, { status: 400 });
  const before = ret;
  const updated = await (prisma as any).returnCase.update({ where: { id: params.id }, data: { status: String(to) } });
  await (prisma as any).actionLog.create({ data: { actorId: (authz.session as any)?.user?.id || "", entity: "ReturnCase", entityId: params.id, action: "STATE", before, after: updated } });
  return noStoreJson({ ok: true, id: params.id, status: updated.status });
}
