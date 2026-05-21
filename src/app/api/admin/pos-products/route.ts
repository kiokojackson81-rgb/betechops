import { noStoreJson, requireRole, getActorId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getProductTableCapabilities } from "@/lib/productTableCapabilities";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";

const MAX_SKU_LENGTH = 80;

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
  shopShortDescription: z.string().trim().max(1000).nullable().optional(),
  shopWarranty: z.string().trim().max(255).nullable().optional(),
  shopSpecs: z.string().trim().max(2000).nullable().optional(),
  shopImageUrl: z.string().trim().max(500).nullable().optional(),
  shopBrand: z.string().trim().max(120).nullable().optional(),
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

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

async function findExistingSku(capabilities: Awaited<ReturnType<typeof getProductTableCapabilities>>, sku: string) {
  if (capabilities.schemaMode === "modern") {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "Product" WHERE "sku" = $1 LIMIT 1`,
      sku,
    );
    return rows[0] ?? null;
  }

  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT "id" FROM "Product" WHERE COALESCE("key", '') = $1 LIMIT 1`,
    sku,
  );
  return rows[0] ?? null;
}

function buildShopInsertFragments(capabilities: Awaited<ReturnType<typeof getProductTableCapabilities>>, data: z.infer<typeof productSchema>) {
  const columns: string[] = [];
  const values: unknown[] = [];

  if (capabilities.showInShop) {
    columns.push(`"showInShop"`);
    values.push(Boolean(data.showInShop));
  }
  if (capabilities.shopCategory) {
    columns.push(`"shopCategory"`);
    values.push(normalizeOptionalText(data.shopCategory));
  }
  if (capabilities.shopShortDescription) {
    columns.push(`"shopShortDescription"`);
    values.push(normalizeOptionalText(data.shopShortDescription));
  }
  if (capabilities.shopWarranty) {
    columns.push(`"shopWarranty"`);
    values.push(normalizeOptionalText(data.shopWarranty));
  }
  if (capabilities.shopSpecs) {
    columns.push(`"shopSpecs"`);
    values.push(normalizeOptionalText(data.shopSpecs));
  }
  if (capabilities.shopImageUrl) {
    columns.push(`"shopImageUrl"`);
    values.push(normalizeOptionalText(data.shopImageUrl));
  }
  if (capabilities.shopBrand) {
    columns.push(`"shopBrand"`);
    values.push(normalizeOptionalText(data.shopBrand));
  }

  return { columns, values };
}

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const includeInactive = ["1", "true", "yes"].includes((searchParams.get("includeInactive") || "").toLowerCase());
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") || "100")));
  const capabilities = await getProductTableCapabilities(prisma);
  const qPattern = `%${q.replace(/[%_]/g, "\\$&")}%`;

  const items = capabilities.schemaMode === "modern"
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
            ${capabilities.shopShortDescription ? `"shopShortDescription"` : `NULL::text`} AS "shopShortDescription",
            ${capabilities.shopWarranty ? `"shopWarranty"` : `NULL::text`} AS "shopWarranty",
            ${capabilities.shopSpecs ? `"shopSpecs"` : `NULL::text`} AS "shopSpecs",
            ${capabilities.shopImageUrl ? `"shopImageUrl"` : `NULL::text`} AS "shopImageUrl",
            ${capabilities.shopBrand ? `"shopBrand"` : `NULL::text`} AS "shopBrand"
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
            ${capabilities.shopShortDescription ? `"shopShortDescription"` : `NULL::text`} AS "shopShortDescription",
            ${capabilities.shopWarranty ? `"shopWarranty"` : `NULL::text`} AS "shopWarranty",
            ${capabilities.shopSpecs ? `"shopSpecs"` : `NULL::text`} AS "shopSpecs",
            ${capabilities.shopImageUrl ? `"shopImageUrl"` : `NULL::text`} AS "shopImageUrl",
            ${capabilities.shopBrand ? `"shopBrand"` : `NULL::text`} AS "shopBrand"
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

  return noStoreJson({ items, capabilities });
}

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  }

  const capabilities = await getProductTableCapabilities(prisma);
  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? (await getActorId());
  const data = parsed.data;
  const skuBase = slugifySku(data.sku || data.name);

  let sku = skuBase;
  let suffix = 1;
  while (await findExistingSku(capabilities, sku)) {
    sku = withSkuSuffix(skuBase, suffix);
    suffix += 1;
  }

  const shopFragments = buildShopInsertFragments(capabilities, data);
  const created = capabilities.schemaMode === "modern"
    ? (await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `
          INSERT INTO "Product" (
            "sku",
            "name",
            "category",
            "sellingPrice",
            "lastBuyingPrice",
            "defaultWarranty",
            "variableCost",
            "isActive",
            "commissionEnabled",
            "commissionAmount",
            "commissionRequiresApproval"
            ${shopFragments.columns.length ? `, ${shopFragments.columns.join(", ")}` : ""}
          )
          VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
            ${shopFragments.values.map((_, index) => `,$${12 + index}`).join("")}
          )
          RETURNING *
        `,
        sku,
        data.name,
        data.category,
        data.sellingPrice,
        data.variableCost ? null : data.lastBuyingPrice ?? null,
        normalizeOptionalText(data.defaultWarranty),
        Boolean(data.variableCost),
        Boolean(data.isActive),
        Boolean(data.commissionEnabled),
        data.commissionEnabled ? data.commissionAmount ?? 0 : null,
        data.commissionEnabled ? Boolean(data.commissionRequiresApproval) : false,
        ...shopFragments.values,
      ))[0]
    : (await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `
          INSERT INTO "Product" (
            "key",
            "name",
            "unit",
            "sellPrice",
            "active"
            ${shopFragments.columns.length ? `, ${shopFragments.columns.join(", ")}` : ""}
          )
          VALUES (
            $1,$2,$3,$4,$5
            ${shopFragments.values.map((_, index) => `,$${6 + index}`).join("")}
          )
          RETURNING *
        `,
        sku,
        data.name,
        data.category,
        data.sellingPrice,
        Boolean(data.isActive),
        ...shopFragments.values,
      ))[0];

  if (actorId) {
    await prisma.actionLog.create({
      data: {
        actorId,
        entity: "Product",
        entityId: String(created.id),
        action: "POS_PRODUCT_CREATE",
        after: created as Prisma.InputJsonValue,
      },
    });
  }

  return noStoreJson({ ok: true, item: created, capabilities }, { status: 201 });
}
