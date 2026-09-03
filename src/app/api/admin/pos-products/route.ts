import { noStoreJson, requireRoleOrBrendah, getActorId } from "@/lib/api";
import { resolveProductActivityActor } from "@/lib/productActivityActor";
import { prisma } from "@/lib/prisma";
import { getProductTableCapabilities } from "@/lib/productTableCapabilities";
import { resolveCanonicalProductBrand } from "@/lib/productBrands";
import { productCatalogueConfigurationSchema } from "@/lib/productCataloguePolicy";
import { isGeneralShopCategory } from "@/app/shop/shopCatalogConfig";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { z } from "zod";

export const dynamic = "force-dynamic";

const MAX_SKU_LENGTH = 80;
const productStatusEnum = z.enum(["ACTIVE", "INACTIVE"]);
const availabilityTypeEnum = z.enum(["SHOP", "WAREHOUSE", "ORDER_ON_REQUEST", "OUT_OF_STOCK"]);

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
  brand: z.string().trim().max(120).nullable().optional(),
  shortDescription: z.string().trim().max(3000).nullable().optional(),
  description: z.string().trim().max(10000).nullable().optional(),
  specifications: z.union([z.string().trim().max(5000), z.array(z.string().trim().max(500)).max(30)]).nullable().optional(),
  warrantyPeriod: z.string().trim().max(120).nullable().optional(),
  warrantyNotes: z.string().trim().max(1000).nullable().optional(),
  mainImageUrl: z.string().trim().max(500).nullable().optional(),
  imageExtractedText: z.string().trim().max(12000).nullable().optional(),
  galleryImageUrls: z.array(z.string().trim().max(500)).max(12).nullable().optional(),
  brandImageUrl: z.string().trim().max(500).nullable().optional(),
  tiktokVideoUrl: z.string().trim().max(500).nullable().optional(),
  purchaseLink: z.string().trim().url().max(500).nullable().optional(),
  ecommerceVisible: z.boolean().optional().default(true),
  isFeatured: z.boolean().optional().default(false),
  status: productStatusEnum.optional().default("ACTIVE"),
  availabilityType: availabilityTypeEnum.optional().default("SHOP"),
  pickupDelayDays: z.coerce.number().int().min(0).max(1).optional(),
  showInShop: z.boolean().optional(),
  shopCategory: z.string().trim().max(120).nullable().optional(),
  shopSubcategory: z.string().trim().max(120).nullable().optional(),
  shopShortDescription: z.string().trim().max(3000).nullable().optional(),
  shopWarranty: z.string().trim().max(255).nullable().optional(),
  shopSpecs: z.string().trim().max(2000).nullable().optional(),
  shopImageUrl: z.string().trim().max(500).nullable().optional(),
  shopBrand: z.string().trim().max(120).nullable().optional(),
  productType: z.string().trim().max(120).nullable().optional(),
  posEnabled: z.boolean().optional().default(true),
  catalogueConfiguration: productCatalogueConfigurationSchema.nullable().optional(),
}).superRefine((data, ctx) => {
  const expectedPickupDelay = data.availabilityType === "WAREHOUSE" ? 1 : 0;
  if (data.pickupDelayDays !== undefined && data.pickupDelayDays !== expectedPickupDelay) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["pickupDelayDays"],
      message: data.availabilityType === "WAREHOUSE"
        ? "Warehouse products must use a 1 day pickup delay"
        : "This availability type must use a 0 day pickup delay",
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

function isManualProductSku(value: unknown) {
  return /^manual(?:[-_]|$)/i.test(String(value ?? "").trim());
}

function hasWebsiteImage(mainImageUrl: unknown, shopImageUrl: unknown) {
  return Boolean(String(mainImageUrl ?? "").trim() || String(shopImageUrl ?? "").trim());
}

function normalizeSpecifications(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) {
    const list = value.map((entry) => entry.trim()).filter(Boolean);
    return list.length ? JSON.stringify(list) : null;
  }

  const normalized = normalizeOptionalText(value);
  if (!normalized) return null;

  const list = normalized
    .split(/\r?\n|[,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  return JSON.stringify(list.length ? list : [normalized]);
}

function normalizeJsonStringArray(value: string[] | null | undefined) {
  if (!Array.isArray(value)) return null;
  const list = value.map((entry) => entry.trim()).filter(Boolean);
  return list.length ? JSON.stringify(list) : null;
}

const JSONB_PRODUCT_COLUMNS = new Set(["specifications", "galleryImageUrls", "catalogueConfiguration"]);

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

function buildShopInsertFragments(
  capabilities: Awaited<ReturnType<typeof getProductTableCapabilities>>,
  data: z.infer<typeof productSchema>,
  brands?: { brand: string | null; shopBrand: string | null },
) {
  const columns: string[] = [];
  const values: unknown[] = [];
  const casts: string[] = [];
  const pushColumn = (column: string, value: unknown) => {
    columns.push(`"${column}"`);
    values.push(value);
    casts.push(JSONB_PRODUCT_COLUMNS.has(column) ? "::jsonb" : "");
  };
  const normalizedStatus = data.status ?? (data.isActive ? "ACTIVE" : "INACTIVE");
  const normalizedAvailabilityType = data.availabilityType ?? "SHOP";
  const pickupDelayDays = normalizedAvailabilityType === "WAREHOUSE" ? 1 : 0;

  if (capabilities.brand) {
    pushColumn("brand", brands?.brand ?? normalizeOptionalText(data.brand));
  }
  if (capabilities.shortDescription) {
    pushColumn("shortDescription", normalizeOptionalText(data.shortDescription));
  }
  if (capabilities.description) {
    pushColumn("description", normalizeOptionalText(data.description));
  }
  if (capabilities.specifications) {
    pushColumn("specifications", normalizeSpecifications(data.specifications));
  }
  if (capabilities.warrantyPeriod) {
    pushColumn("warrantyPeriod", normalizeOptionalText(data.warrantyPeriod));
  }
  if (capabilities.warrantyNotes) {
    pushColumn("warrantyNotes", normalizeOptionalText(data.warrantyNotes));
  }
  if (capabilities.mainImageUrl) {
    pushColumn("mainImageUrl", normalizeOptionalText(data.mainImageUrl));
  }
  if (capabilities.imageExtractedText) {
    pushColumn("imageExtractedText", normalizeOptionalText(data.imageExtractedText));
  }
  if (capabilities.galleryImageUrls) {
    pushColumn("galleryImageUrls", normalizeJsonStringArray(data.galleryImageUrls));
  }
  if (capabilities.brandImageUrl) {
    pushColumn("brandImageUrl", normalizeOptionalText(data.brandImageUrl));
  }
  if (capabilities.tiktokVideoUrl) {
    pushColumn("tiktokVideoUrl", normalizeOptionalText(data.tiktokVideoUrl));
  }
  if (capabilities.purchaseLink) {
    pushColumn("purchaseLink", normalizeOptionalText(data.purchaseLink));
  }
  if (capabilities.ecommerceVisible) {
    pushColumn("ecommerceVisible", Boolean(data.ecommerceVisible));
  }
  if (capabilities.isFeatured) {
    pushColumn("isFeatured", Boolean(data.isFeatured));
  }
  if (capabilities.status) {
    pushColumn("status", normalizedStatus);
  }
  if (capabilities.availabilityType) {
    pushColumn("availabilityType", normalizedAvailabilityType);
  }
  if (capabilities.pickupDelayDays) {
    pushColumn("pickupDelayDays", pickupDelayDays);
  }
  if (capabilities.productType) {
    pushColumn("productType", normalizeOptionalText(data.productType));
  }
  if (capabilities.posEnabled) {
    pushColumn("posEnabled", Boolean(data.posEnabled));
  }
  if (capabilities.catalogueConfiguration) {
    pushColumn("catalogueConfiguration", data.catalogueConfiguration ? JSON.stringify(data.catalogueConfiguration) : null);
  }

  if (capabilities.showInShop) {
    pushColumn("showInShop", Boolean(data.ecommerceVisible ?? data.showInShop));
  }
  if (capabilities.shopCategory) {
    pushColumn("shopCategory", normalizeOptionalText(data.shopCategory));
  }
  if (capabilities.shopSubcategory) {
    pushColumn("shopSubcategory", normalizeOptionalText(data.shopSubcategory));
  }
  if (capabilities.shopShortDescription) {
    pushColumn("shopShortDescription", normalizeOptionalText(data.shortDescription ?? data.shopShortDescription));
  }
  if (capabilities.shopWarranty) {
    pushColumn("shopWarranty", normalizeOptionalText(data.warrantyPeriod ?? data.shopWarranty));
  }
  if (capabilities.shopSpecs) {
    pushColumn("shopSpecs", normalizeOptionalText(Array.isArray(data.specifications) ? data.specifications.join(", ") : data.specifications ?? data.shopSpecs));
  }
  if (capabilities.shopImageUrl) {
    pushColumn("shopImageUrl", normalizeOptionalText(data.mainImageUrl ?? data.shopImageUrl));
  }
  if (capabilities.shopBrand) {
    pushColumn("shopBrand", brands?.shopBrand ?? normalizeOptionalText(data.brand ?? data.shopBrand));
  }

  return { columns, values, casts };
}

function buildModernSystemInsertFragments(capabilities: Awaited<ReturnType<typeof getProductTableCapabilities>>) {
  const columns: string[] = ['"id"'];
  const values: unknown[] = [randomUUID()];
  const casts: string[] = [""];
  const now = new Date();

  if (capabilities.available.has("minStockLevel")) {
    columns.push('"minStockLevel"');
    values.push(5);
    casts.push("");
  }
  if (capabilities.available.has("stockQuantity")) {
    columns.push('"stockQuantity"');
    values.push(0);
    casts.push("");
  }
  if (capabilities.available.has("createdAt")) {
    columns.push('"createdAt"');
    values.push(now);
    casts.push("");
  }
  if (capabilities.available.has("updatedAt")) {
    columns.push('"updatedAt"');
    values.push(now);
    casts.push("");
  }

  return { columns, values, casts };
}

function sanitizeBrendahProductCreate(data: z.infer<typeof productSchema>): z.infer<typeof productSchema> {
  return {
    ...data,
    category: "pos",
    lastBuyingPrice: data.lastBuyingPrice ?? null,
    defaultWarranty: null,
    variableCost: false,
    isActive: true,
    commissionEnabled: false,
    commissionAmount: null,
    commissionRequiresApproval: false,
    ecommerceVisible: true,
    isFeatured: false,
    status: "ACTIVE",
    availabilityType: data.availabilityType ?? "SHOP",
    pickupDelayDays: (data.availabilityType ?? "SHOP") === "WAREHOUSE" ? 1 : 0,
    showInShop: Boolean(data.ecommerceVisible ?? data.showInShop ?? true),
  };
}

export async function GET(req: Request) {
  const auth = await requireRoleOrBrendah(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const includeInactive = ["1", "true", "yes"].includes((searchParams.get("includeInactive") || "").toLowerCase());
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") || "100")));
  const capabilities = await getProductTableCapabilities(prisma);
  const qPattern = `%${q.replace(/[%_]/g, "\\$&")}%`;
  const qLower = q.toLowerCase();
  const qStartsPattern = `${q.replace(/[%_]/g, "\\$&")}%`;

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
            ${capabilities.brand ? `"brand"` : `NULL::text`} AS "brand",
            ${capabilities.shortDescription ? `"shortDescription"` : `NULL::text`} AS "shortDescription",
            ${capabilities.description ? `"description"` : `NULL::text`} AS "description",
            ${capabilities.specifications ? `"specifications"` : `NULL::jsonb`} AS "specifications",
            ${capabilities.warrantyPeriod ? `"warrantyPeriod"` : `NULL::text`} AS "warrantyPeriod",
            ${capabilities.warrantyNotes ? `"warrantyNotes"` : `NULL::text`} AS "warrantyNotes",
            ${capabilities.mainImageUrl ? `"mainImageUrl"` : `NULL::text`} AS "mainImageUrl",
            ${capabilities.imageExtractedText ? `"imageExtractedText"` : `NULL::text`} AS "imageExtractedText",
            ${capabilities.galleryImageUrls ? `"galleryImageUrls"` : `NULL::jsonb`} AS "galleryImageUrls",
            ${capabilities.brandImageUrl ? `"brandImageUrl"` : `NULL::text`} AS "brandImageUrl",
            ${capabilities.tiktokVideoUrl ? `"tiktokVideoUrl"` : `NULL::text`} AS "tiktokVideoUrl",
            ${capabilities.purchaseLink ? `"purchaseLink"` : `NULL::text`} AS "purchaseLink",
            ${capabilities.ecommerceVisible ? `COALESCE("ecommerceVisible", false)` : `NULL::boolean`} AS "ecommerceVisible",
            ${capabilities.isFeatured ? `COALESCE("isFeatured", false)` : `NULL::boolean`} AS "isFeatured",
            ${capabilities.status ? `COALESCE("status", CASE WHEN COALESCE("isActive", true) THEN 'ACTIVE' ELSE 'INACTIVE' END)` : `NULL::text`} AS "status",
            ${capabilities.availabilityType ? `COALESCE("availabilityType", 'SHOP')` : `NULL::text`} AS "availabilityType",
            ${capabilities.pickupDelayDays ? `COALESCE("pickupDelayDays", 0)` : `NULL::int`} AS "pickupDelayDays",
            ${capabilities.productType ? `"productType"` : `NULL::text`} AS "productType",
            ${capabilities.posEnabled ? `COALESCE("posEnabled", true)` : `TRUE`} AS "posEnabled",
            ${capabilities.catalogueConfiguration ? `"catalogueConfiguration"` : `NULL::jsonb`} AS "catalogueConfiguration",
            ${capabilities.showInShop ? `COALESCE("showInShop", false)` : `NULL::boolean`} AS "showInShop",
            ${capabilities.shopCategory ? `"shopCategory"` : `NULL::text`} AS "shopCategory",
            ${capabilities.shopSubcategory ? `"shopSubcategory"` : `NULL::text`} AS "shopSubcategory",
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
          ORDER BY
            CASE
              WHEN $2::text = '' THEN 0
              WHEN LOWER("name") = $4 THEN 0
              WHEN LOWER(COALESCE("sku", '')) = $4 THEN 1
              WHEN LOWER("name") LIKE LOWER($5) THEN 2
              WHEN LOWER(COALESCE("sku", '')) LIKE LOWER($5) THEN 3
              WHEN LOWER(COALESCE("category", '')) LIKE LOWER($5) THEN 4
              ELSE 5
            END,
            COALESCE("isActive", true) DESC,
            ${capabilities.available.has("createdAt") ? `"createdAt" DESC,` : ""}
            "name" ASC
          LIMIT $6
        `,
        includeInactive,
        q,
        qPattern,
        qLower,
        qStartsPattern,
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
            ${capabilities.brand ? `"brand"` : `NULL::text`} AS "brand",
            ${capabilities.shortDescription ? `"shortDescription"` : `NULL::text`} AS "shortDescription",
            ${capabilities.description ? `"description"` : `NULL::text`} AS "description",
            ${capabilities.specifications ? `"specifications"` : `NULL::jsonb`} AS "specifications",
            ${capabilities.warrantyPeriod ? `"warrantyPeriod"` : `NULL::text`} AS "warrantyPeriod",
            ${capabilities.warrantyNotes ? `"warrantyNotes"` : `NULL::text`} AS "warrantyNotes",
            ${capabilities.mainImageUrl ? `"mainImageUrl"` : `NULL::text`} AS "mainImageUrl",
            ${capabilities.imageExtractedText ? `"imageExtractedText"` : `NULL::text`} AS "imageExtractedText",
            ${capabilities.galleryImageUrls ? `"galleryImageUrls"` : `NULL::jsonb`} AS "galleryImageUrls",
            ${capabilities.brandImageUrl ? `"brandImageUrl"` : `NULL::text`} AS "brandImageUrl",
            ${capabilities.tiktokVideoUrl ? `"tiktokVideoUrl"` : `NULL::text`} AS "tiktokVideoUrl",
            ${capabilities.purchaseLink ? `"purchaseLink"` : `NULL::text`} AS "purchaseLink",
            ${capabilities.ecommerceVisible ? `COALESCE("ecommerceVisible", false)` : `NULL::boolean`} AS "ecommerceVisible",
            ${capabilities.isFeatured ? `COALESCE("isFeatured", false)` : `NULL::boolean`} AS "isFeatured",
            ${capabilities.status ? `COALESCE("status", CASE WHEN COALESCE("active", true) THEN 'ACTIVE' ELSE 'INACTIVE' END)` : `NULL::text`} AS "status",
            ${capabilities.availabilityType ? `COALESCE("availabilityType", 'SHOP')` : `NULL::text`} AS "availabilityType",
            ${capabilities.pickupDelayDays ? `COALESCE("pickupDelayDays", 0)` : `NULL::int`} AS "pickupDelayDays",
            ${capabilities.productType ? `"productType"` : `NULL::text`} AS "productType",
            ${capabilities.posEnabled ? `COALESCE("posEnabled", true)` : `TRUE`} AS "posEnabled",
            ${capabilities.catalogueConfiguration ? `"catalogueConfiguration"` : `NULL::jsonb`} AS "catalogueConfiguration",
            ${capabilities.showInShop ? `COALESCE("showInShop", false)` : `NULL::boolean`} AS "showInShop",
            ${capabilities.shopCategory ? `"shopCategory"` : `NULL::text`} AS "shopCategory",
            ${capabilities.shopSubcategory ? `"shopSubcategory"` : `NULL::text`} AS "shopSubcategory",
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
          ORDER BY
            CASE
              WHEN $2::text = '' THEN 0
              WHEN LOWER("name") = $4 THEN 0
              WHEN LOWER(COALESCE("key", '')) = $4 THEN 1
              WHEN LOWER("name") LIKE LOWER($5) THEN 2
              WHEN LOWER(COALESCE("key", '')) LIKE LOWER($5) THEN 3
              WHEN LOWER(COALESCE("unit", '')) LIKE LOWER($5) THEN 4
              ELSE 5
            END,
            COALESCE("active", true) DESC,
            ${capabilities.available.has("createdAt") ? `"createdAt" DESC,` : ""}
            "name" ASC
          LIMIT $6
        `,
        includeInactive,
        q,
        qPattern,
        qLower,
        qStartsPattern,
        limit,
      );

  return noStoreJson({ items, capabilities });
}

export async function POST(req: Request) {
  const auth = await requireRoleOrBrendah(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  }

  const capabilities = await getProductTableCapabilities(prisma);
  const actorId = await resolveProductActivityActor({
    request: req,
    role: auth.role,
    sessionUserId: (auth.session?.user as { id?: string } | undefined)?.id,
    fallbackActorId: await getActorId(),
  });
  const parsedData = auth.isBrendah ? sanitizeBrendahProductCreate(parsed.data) : parsed.data;
  const data = isGeneralShopCategory(parsedData.shopCategory)
    ? { ...parsedData, productType: "WAREHOUSE_PRODUCT" }
    : parsedData;
  const canonicalBrand = await resolveCanonicalProductBrand(prisma, capabilities, data.brand);
  const canonicalShopBrand = await resolveCanonicalProductBrand(prisma, capabilities, data.brand ?? data.shopBrand);
  const skuBase = slugifySku(data.sku || data.name);

  let sku = skuBase;
  let suffix = 1;
  while (await findExistingSku(capabilities, sku)) {
    sku = withSkuSuffix(skuBase, suffix);
    suffix += 1;
  }

  const websiteEligible = !isManualProductSku(sku) && hasWebsiteImage(data.mainImageUrl, data.shopImageUrl);
  const publicationData: z.infer<typeof productSchema> = {
    ...data,
    isActive: true,
    status: "ACTIVE",
    posEnabled: true,
    ecommerceVisible: websiteEligible,
    showInShop: websiteEligible,
    isFeatured: websiteEligible && Boolean(data.isFeatured),
  };

  const shopFragments = buildShopInsertFragments(capabilities, publicationData, {
    brand: canonicalBrand,
    shopBrand: canonicalShopBrand,
  });
  const systemFragments = capabilities.schemaMode === "modern" ? buildModernSystemInsertFragments(capabilities) : null;
  const created = capabilities.schemaMode === "modern"
    ? (await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `
          INSERT INTO "Product" (
            ${systemFragments?.columns.join(", ")},
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
            ${systemFragments?.values.map((_, index) => `$${index + 1}${systemFragments.casts[index] || ""}`).join(", ")},
            $${(systemFragments?.values.length ?? 0) + 1},
            $${(systemFragments?.values.length ?? 0) + 2},
            $${(systemFragments?.values.length ?? 0) + 3},
            $${(systemFragments?.values.length ?? 0) + 4},
            $${(systemFragments?.values.length ?? 0) + 5},
            $${(systemFragments?.values.length ?? 0) + 6},
            $${(systemFragments?.values.length ?? 0) + 7},
            $${(systemFragments?.values.length ?? 0) + 8},
            $${(systemFragments?.values.length ?? 0) + 9},
            $${(systemFragments?.values.length ?? 0) + 10},
            $${(systemFragments?.values.length ?? 0) + 11}
            ${shopFragments.values.map((_, index) => `,$${(systemFragments?.values.length ?? 0) + 12 + index}${shopFragments.casts[index] || ""}`).join("")}
          )
          RETURNING *
        `,
        ...(systemFragments?.values ?? []),
        sku,
        data.name,
        data.category,
        data.sellingPrice,
        data.variableCost ? null : data.lastBuyingPrice ?? null,
        normalizeOptionalText(data.defaultWarranty),
        Boolean(data.variableCost),
        true,
        false,
        null,
        false,
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
            ${shopFragments.values.map((_, index) => `,$${6 + index}${shopFragments.casts[index] || ""}`).join("")}
          )
          RETURNING *
        `,
        sku,
        data.name,
        data.category,
        data.sellingPrice,
        true,
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
