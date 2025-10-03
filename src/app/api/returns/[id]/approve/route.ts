import { noStoreJson, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { resolveShopScope } from "@/lib/scope";
import { guardTransition } from "@/lib/returns";
// session is provided by requireRole; no need to import auth directly
import { Role } from "@prisma/client";

export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  const authz = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!authz.ok) return authz.res;

  const session = authz.session;
  const email = (session?.user as { email?: string } | undefined)?.email?.toLowerCase() || "";
  const actor = email ? await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } }) : null;
  if (!actor) return noStoreJson({ error: "Actor not found" }, { status: 401 });

  const ret = await (prisma as any).returnCase.findUnique({ where: { id: params.id }, include: { evidence: true } });
  if (!ret) return noStoreJson({ error: "Return not found" }, { status: 404 });

  // Scope check for non-admins
  const scope = await resolveShopScope();
  if (scope.role !== Role.ADMIN && scope.shopIds && !scope.shopIds.includes(ret.shopId)) {
    return noStoreJson({ error: "Forbidden" }, { status: 403 });
  }

  const can = guardTransition(ret.status as any, "approved", { role: (actor.role as any) });
  if (!can.ok) return noStoreJson({ error: can.reason }, { status: 400 });

  const before = ret;
  const updated = await (prisma as any).returnCase.update({ where: { id: ret.id }, data: { status: "approved", approvedBy: actor.id } });
  await (prisma as any).actionLog.create({ data: { actorId: actor.id, entity: "ReturnCase", entityId: ret.id, action: "APPROVE", before, after: updated } });
  return noStoreJson({ ok: true, id: ret.id, status: updated.status });
}
