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
  if (auth.isBrendah) return noStoreJson({ error: "Not authorized to reject commissions" }, { status: 403 });

  const id = await resolveId(context);
  const existing = await prisma.commissionEarning.findUnique({ where: { id } });
  if (!existing) return noStoreJson({ error: "Commission entry not found" }, { status: 404 });

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? (await getActorId());
  const detail = ((existing.calcDetail as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;

  const updated = await prisma.commissionEarning.update({
    where: { id },
    data: {
      status: "REJECTED",
      calcDetail: {
        ...detail,
        rejectedAt: new Date().toISOString(),
        rejectedById: actorId,
      },
    },
  });

  if (actorId) {
    await prisma.actionLog.create({
      data: {
        actorId,
        entity: "CommissionEarning",
        entityId: updated.id,
        action: "POS_COMMISSION_REJECT",
        before: existing,
        after: updated,
      },
    });
  }

  return noStoreJson({ ok: true, item: updated });
}
