import { noStoreJson, requireRole, getActorId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { deriveDefaultCommissionConfigFromUser } from "@/lib/userCommissionConfig";
import { PosTotalsMode, SalesCommissionMode } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const params = await (ctx.params as any);
  const userId = params?.id;
  if (!userId) return noStoreJson({ error: "Missing id" }, { status: 400 });

  const existing = await prisma.userCommissionConfig.findUnique({ where: { userId } });
  if (existing) return noStoreJson({ ok: true, config: existing });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, attendantCategory: true },
  });
  if (!user) return noStoreJson({ error: "User not found" }, { status: 404 });

  const derived = deriveDefaultCommissionConfigFromUser(user);
  const created = await prisma.userCommissionConfig.create({
    data: { userId: user.id, ...derived },
  });
  return noStoreJson({ ok: true, config: created });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const params = await (ctx.params as any);
  const userId = params?.id;
  if (!userId) return noStoreJson({ error: "Missing id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const schema = z.object({
    posTotalsMode: z.nativeEnum(PosTotalsMode).optional(),
    salesCommissionMode: z.nativeEnum(SalesCommissionMode).optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });

  const next = parsed.data;
  const updated = await prisma.userCommissionConfig.upsert({
    where: { userId },
    update: {
      ...(next.posTotalsMode ? { posTotalsMode: next.posTotalsMode } : {}),
      ...(next.salesCommissionMode ? { salesCommissionMode: next.salesCommissionMode } : {}),
    },
    create: {
      userId,
      posTotalsMode: next.posTotalsMode ?? PosTotalsMode.NONE,
      salesCommissionMode: next.salesCommissionMode ?? SalesCommissionMode.DEFAULT_TIERS,
    },
  });

  const actorId = await getActorId();
  if (actorId) {
    await prisma.actionLog.create({
      data: {
        actorId,
        entity: "UserCommissionConfig",
        entityId: updated.id,
        action: "UPSERT",
        before: undefined,
        after: updated as any,
      },
    });
  }

  return noStoreJson({ ok: true, config: updated });
}

