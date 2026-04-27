import { noStoreJson, requireRole, getActorId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const MAX_SKU_LENGTH = 80;

const productSchema = z.object({
  sku: z.string().trim().min(1).max(255).optional(),
  name: z.string().trim().min(1).max(255),
  category: z.string().trim().min(1).max(120).default("pos"),
  sellingPrice: z.coerce.number().min(0),
  lastBuyingPrice: z.coerce.number().min(0).nullable().optional(),
  isActive: z.boolean().optional().default(true),
  commissionEnabled: z.boolean().optional().default(false),
  commissionAmount: z.coerce.number().min(0).nullable().optional(),
  commissionRequiresApproval: z.boolean().optional().default(false),
});

function slugifySku(input: string) {
  const normalized = input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SKU_LENGTH);
  return normalized || `POS-${Date.now().toString(36).toUpperCase()}`.slice(0, MAX_SKU_LENGTH);
}

function withSkuSuffix(base: string, suffix: number) {
  const suffixText = `-${suffix}`;
  return `${base.slice(0, Math.max(1, MAX_SKU_LENGTH - suffixText.length))}${suffixText}`;
}

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const includeInactive = ["1", "true", "yes"].includes((searchParams.get("includeInactive") || "").toLowerCase());
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") || "100")));

  const products = await prisma.product.findMany({
    where: {
      ...(includeInactive ? {} : { isActive: true }),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { sku: { contains: q, mode: "insensitive" } },
              { category: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    take: limit,
  });

  return noStoreJson({ items: products });
}

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  }

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? (await getActorId());
  const data = parsed.data;
  const skuBase = slugifySku(data.sku || data.name);

  let sku = skuBase;
  let suffix = 1;
  while (await prisma.product.findUnique({ where: { sku }, select: { id: true } })) {
    sku = withSkuSuffix(skuBase, suffix);
    suffix += 1;
  }

  const created = await prisma.product.create({
    data: {
      sku,
      name: data.name,
      category: data.category,
      sellingPrice: data.sellingPrice,
      lastBuyingPrice: data.lastBuyingPrice ?? null,
      isActive: data.isActive,
      commissionEnabled: data.commissionEnabled,
      commissionAmount: data.commissionEnabled ? data.commissionAmount ?? 0 : null,
      commissionRequiresApproval: data.commissionEnabled ? data.commissionRequiresApproval : false,
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
