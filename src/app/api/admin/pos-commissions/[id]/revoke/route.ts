import { noStoreJson, requireRoleOrBrendah, getActorId } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

async function resolveId(context: ParamsContext) {
  return "params" in context && typeof (context as { params: Promise<{ id: string }> }).params?.then === "function"
    ? (await (context as { params: Promise<{ id: string }> }).params).id
    : (context as { params: { id: string } }).params.id;
}

export async function POST(_req: Request, context: ParamsContext) {
  const auth = await requireRoleOrBrendah(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const id = await resolveId(context);
  const existing = await prisma.commissionEarning.findUnique({ where: { id } });
  if (!existing) return noStoreJson({ error: "Commission entry not found" }, { status: 404 });
  if (!["RELEASED", "APPROVED"].includes(existing.status)) {
    return noStoreJson({ error: "Only released/approved commissions can be revoked" }, { status: 400 });
  }

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? (await getActorId());
  const detail = ((existing.calcDetail as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
  const now = new Date().toISOString();
  const nextStatus = detail?.requiresApproval === false ? "PENDING" : "PENDING_APPROVAL";

  const updated = await prisma.commissionEarning.update({
    where: { id },
    data: {
      status: nextStatus,
      calcDetail: {
        ...detail,
        revokedAt: now,
        revokedById: actorId,
        revokedFromStatus: existing.status,
      },
    },
  });

  if (actorId) {
    await prisma.actionLog.create({
      data: {
        actorId,
        entity: "CommissionEarning",
        entityId: updated.id,
        action: "POS_COMMISSION_REVOKE",
        before: existing,
        after: updated,
      },
    });
  }

  return noStoreJson({ ok: true, item: updated });
}
