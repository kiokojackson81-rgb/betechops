import { noStoreJson, requireRole, getActorId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.ok) return auth.res;
  const body = await req.json().catch(() => ({}));
  const schema = z.object({
    scope: z.enum(["sku", "category", "shop", "global"]),
    shopId: z.string().optional().nullable(),
    sku: z.string().optional().nullable(),
    category: z.string().optional().nullable(),
    type: z.enum(["percent_profit", "percent_gross", "flat_per_item"]),
    rateDecimal: z.number().min(0),
    effectiveFrom: z.coerce.date(),
    effectiveTo: z.coerce.date().optional().nullable(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  const actorId = await getActorId();
  const data = parsed.data;
  const created = await prisma.commissionRule.create({
    data: {
      scope: data.scope,
      shopId: data.scope === "shop" ? (data.shopId || null) : null,
      sku: data.scope === "sku" ? (data.sku || null) : null,
      category: data.scope === "category" ? (data.category || null) : null,
      type: data.type,
      rateDecimal: data.rateDecimal,
      effectiveFrom: data.effectiveFrom,
      effectiveTo: data.effectiveTo || null,
      createdBy: actorId || "unknown",
    },
  });
  await prisma.actionLog.create({ data: { actorId: actorId || "", entity: "CommissionRule", entityId: created.id, action: "CREATE", before: undefined, after: created } });
  return noStoreJson({ ok: true, rule: created }, { status: 201 });
}
