import type { NextRequest } from "next/server";
import { noStoreJson, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { guardTransition } from "@/lib/returns";

export async function PATCH(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const authz = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!authz.ok) return authz.res;
  const ret = await prisma.returnCase.findUnique({ where: { id } });
  if (!ret) return noStoreJson({ error: "Return not found" }, { status: 404 });
  const can = guardTransition(ret.status as any, "received", { role: (authz.role as any) });
  if (!can.ok) return noStoreJson({ error: can.reason }, { status: 400 });
  const before = ret;
  const updated = await prisma.returnCase.update({ where: { id }, data: { status: "received" } });
  await prisma.actionLog.create({ data: { actorId: (authz.session as any)?.user?.id || "", entity: "ReturnCase", entityId: id, action: "RECEIVED", before, after: updated } });
  return noStoreJson({ ok: true, id, status: updated.status });
}
