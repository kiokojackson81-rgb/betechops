import { noStoreJson, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { guardTransition } from "@/lib/returns";

export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  const authz = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!authz.ok) return authz.res;
  const ret = await (prisma as any).returnCase.findUnique({ where: { id: params.id } });
  if (!ret) return noStoreJson({ error: "Return not found" }, { status: 404 });
  const can = guardTransition(ret.status as any, "received", { role: (authz.role as any) });
  if (!can.ok) return noStoreJson({ error: can.reason }, { status: 400 });
  const before = ret;
  const updated = await (prisma as any).returnCase.update({ where: { id: params.id }, data: { status: "received" } });
  await (prisma as any).actionLog.create({ data: { actorId: (authz.session as any)?.user?.id || "", entity: "ReturnCase", entityId: params.id, action: "RECEIVED", before, after: updated } });
  return noStoreJson({ ok: true, id: params.id, status: updated.status });
}
