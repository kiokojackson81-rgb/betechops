import { noStoreJson, requireRole, getActorId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const MAX_SKU_LENGTH = 80;

type PosCatalogueCapabilities = {
  schemaMode: "modern" | "legacy";
  showInShop: boolean;
  shopCategory: boolean;
  shopTitle: boolean;
  shopShortDescription: boolean;
  imageUrl: boolean;
  brand: boolean;
  warranty: boolean;
  specs: boolean;
};

const productSchema = z.object({
  sku: z.string().trim().min(1).max(255).optional(),
  name: z.string().trim().min(1).max(255),
  category: z.string().trim().min(1).max(120).default("pos"),
  sellingPrice: z.coerce.number().min(0),
  lastBuyingPrice: z.coerce.number().min(0).nullable().optional(),
  defaultWarranty: z.string().trim().max(50).nullable().optional(),
  variableCost: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  commissionEnabled: z.boolean().optional().default(false),
  commissionAmount: z.coerce.number().min(0).nullable().optional(),
  commissionRequiresApproval: z.boolean().optional().default(false),
  showInShop: z.boolean().optional(),
  shopCategory: z.string().trim().max(120).nullable().optional(),
  shopTitle: z.string().trim().max(255).nullable().optional(),
  shopShortDescription: z.string().trim().max(1000).nullable().optional(),
  imageUrl: z.string().trim().max(500).nullable().optional(),
  brand: z.string().trim().max(120).nullable().optional(),
}).superRefine((data, ctx) => {
  if (!data.variableCost && !(Number(data.lastBuyingPrice ?? 0) > 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["lastBuyingPrice"],
      message: "Buying price is required for fixed-cost products",
    });
  }
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

async function getProductTableCapabilities(): Promise<{
  available: Set<string>;
  capabilities: PosCatalogueCapabilities;
}> {
  const columns = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'Product' ORDER BY ordinal_position`,
  );
  const available = new Set(columns.map((entry) => entry.column_name));
  const isModern = available.has("sku");

  return {
    available,
    capabilities: {
      schemaMode: isModern ? "modern" : "legacy",
      showInShop: available.has("showInShop"),
      shopCategory: available.has("shopCategory"),
      shopTitle: available.has("shopTitle"),
      shopShortDescription: available.has("shopShortDescription"),
      imageUrl: available.has("imageUrl"),
      brand: available.has("brand"),
      warranty: available.has("defaultWarranty"),
      specs: available.has("shopShortDescription"),
    },
  };
}

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const includeInactive = ["1", "true", "yes"].includes((searchParams.get("includeInactive") || "").toLowerCase());
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") || "100")));
  const { available, capabilities } = await getProductTableCapabilities();
  const qPattern = `%${q.replace(/[%_]/g, "\\$&")}%`;

  const products = available.has("sku")
    ? await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `
          SELECT
            "id",
            "sku",
            "name",
            COALESCE("category", 'pos') AS "category",
            COALESCE("sellingPrice", 0) AS "sellingPrice",
            "lastBuyingPrice",
            "defaultWarranty",
            COALESCE("variableCost", false) AS "variableCost",
            COALESCE("isActive", true) AS "isActive",
            COALESCE("commissionEnabled", false) AS "commissionEnabled",
            "commissionAmount",
            COALESCE("commissionRequiresApproval", false) AS "commissionRequiresApproval",
            ${capabilities.showInShop ? `COALESCE("showInShop", false)` : `NULL::boolean`} AS "showInShop",
            ${capabilities.shopCategory ? `"shopCategory"` : `NULL::text`} AS "shopCategory",
            ${capabilities.shopTitle ? `"shopTitle"` : `NULL::text`} AS "shopTitle",
            ${capabilities.shopShortDescription ? `"shopShortDescription"` : `NULL::text`} AS "shopShortDescription",
            ${capabilities.imageUrl ? `"imageUrl"` : `NULL::text`} AS "imageUrl",
            ${capabilities.brand ? `"brand"` : `NULL::text`} AS "brand"
          FROM "Product"
          WHERE ($1::boolean = true OR COALESCE("isActive", true) = true)
            AND (
              $2::text = ''
              OR "name" ILIKE $3
              OR "sku" ILIKE $3
              OR COALESCE("category", '') ILIKE $3
            )
          ORDER BY COALESCE("isActive", true) DESC, "name" ASC
          LIMIT $4
        `,
        includeInactive,
        q,
        qPattern,
        limit,
      )
    : await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `
          SELECT
            "id",
            COALESCE("key", "id") AS "sku",
            "name",
            COALESCE("unit", 'pos') AS "category",
            COALESCE("sellPrice", 0) AS "sellingPrice",
            NULL::double precision AS "lastBuyingPrice",
            NULL::text AS "defaultWarranty",
            false AS "variableCost",
            COALESCE("active", true) AS "isActive",
            false AS "commissionEnabled",
            NULL::numeric AS "commissionAmount",
            false AS "commissionRequiresApproval",
            ${capabilities.showInShop ? `COALESCE("showInShop", false)` : `NULL::boolean`} AS "showInShop",
            ${capabilities.shopCategory ? `"shopCategory"` : `NULL::text`} AS "shopCategory",
            ${capabilities.shopTitle ? `"shopTitle"` : `NULL::text`} AS "shopTitle",
            ${capabilities.shopShortDescription ? `"shopShortDescription"` : `NULL::text`} AS "shopShortDescription",
            ${capabilities.imageUrl ? `"imageUrl"` : `NULL::text`} AS "imageUrl",
            ${capabilities.brand ? `"brand"` : `NULL::text`} AS "brand"
          FROM "Product"
          WHERE ($1::boolean = true OR COALESCE("active", true) = true)
            AND (
              $2::text = ''
              OR "name" ILIKE $3
              OR COALESCE("key", '') ILIKE $3
              OR COALESCE("unit", '') ILIKE $3
            )
          ORDER BY COALESCE("active", true) DESC, "name" ASC
          LIMIT $4
        `,
        includeInactive,
        q,
        qPattern,
        limit,
      );

  return noStoreJson({ items: products, capabilities });
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
  // TODO: Persist shop-specific catalogue fields only after the Product table is upgraded safely.
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
      lastBuyingPrice: data.variableCost ? null : data.lastBuyingPrice ?? null,
      defaultWarranty: data.defaultWarranty?.trim() || null,
      variableCost: data.variableCost,
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
