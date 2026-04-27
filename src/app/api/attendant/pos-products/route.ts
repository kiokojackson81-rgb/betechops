import { noStoreJson, requireRoleOrBrendah, getActorId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const productSchema = z.object({
  name: z.string().trim().min(1).max(255),
  sellingPrice: z.coerce.number().min(0),
});

function slugifySku(input: string) {
  const normalized = input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || `POS-${Date.now().toString(36).toUpperCase()}`;
}

export async function GET(req: Request) {
  const auth = await requireRoleOrBrendah(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const includeInactive = ["1", "true", "yes"].includes((searchParams.get("includeInactive") || "").toLowerCase());
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") || "100")));

  const items = await prisma.product.findMany({
    where: {
      category: "pos",
      ...(includeInactive ? {} : { isActive: true }),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { sku: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    take: limit,
  });

  return noStoreJson({ items });
}

export async function POST(req: Request) {
  const auth = await requireRoleOrBrendah(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  }

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? (await getActorId());
  const data = parsed.data;
  const skuBase = slugifySku(data.name);

  let sku = skuBase;
  let suffix = 1;
  while (await prisma.product.findUnique({ where: { sku }, select: { id: true } })) {
    sku = `${skuBase}-${suffix}`;
    suffix += 1;
  }

  const created = await prisma.product.create({
    data: {
      sku,
      name: data.name,
      category: "pos",
      sellingPrice: data.sellingPrice,
      isActive: true,
    },
  });

  if (actorId) {
    await prisma.actionLog.create({
      data: {
        actorId,
        entity: "Product",
        entityId: created.id,
        action: "POS_PRODUCT_CREATE",
        after: created,
      },
    });
  }

  return noStoreJson({ ok: true, item: created }, { status: 201 });
}
