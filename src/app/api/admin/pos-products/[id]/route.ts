import { noStoreJson, requireRoleOrBrendah, getActorId } from "@/lib/api";
import { resolveProductActivityActor } from "@/lib/productActivityActor";
import { prisma } from "@/lib/prisma";
import { getProductTableCapabilities } from "@/lib/productTableCapabilities";
import { resolveCanonicalProductBrand } from "@/lib/productBrands";
import { productCatalogueConfigurationSchema } from "@/lib/productCataloguePolicy";
import { recomputeOrderEconomics } from "@/lib/recomputeOrderEconomics";
import { canonicalReceiptNumber } from "@/lib/receiptGuard";
import { recalcMarketingEntry, recalcSupportEntry } from "@/lib/marketingReceiptCleanup";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";

const MAX_SKU_LENGTH = 80;
const productStatusEnum = z.enum(["ACTIVE", "INACTIVE"]);
const availabilityTypeEnum = z.enum(["SHOP", "WAREHOUSE", "ORDER_ON_REQUEST", "OUT_OF_STOCK"]);

const updateSchema = z.object({
  sku: z.string().trim().min(1).max(255).optional(),
  name: z.string().trim().min(1).max(255).optional(),
  category: z.string().trim().min(1).max(120).optional(),
  sellingPrice: z.coerce.number().min(0).optional(),
  lastBuyingPrice: z.coerce.number().min(0).nullable().optional(),
  defaultWarranty: z.string().trim().max(50).nullable().optional(),
  variableCost: z.boolean().optional(),
  isActive: z.boolean().optional(),
  commissionEnabled: z.boolean().optional(),
  commissionAmount: z.coerce.number().min(0).nullable().optional(),
  commissionRequiresApproval: z.boolean().optional(),
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
  ecommerceVisible: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  status: productStatusEnum.optional(),
  availabilityType: availabilityTypeEnum.optional(),
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
  posEnabled: z.boolean().optional(),
  catalogueConfiguration: productCatalogueConfigurationSchema.nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.availabilityType) {
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
  }
});

function normalizeSku(input: string) {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SKU_LENGTH);
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
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

function sanitizeBrendahProductUpdate(data: z.infer<typeof updateSchema>): z.infer<typeof updateSchema> {
  const nextAvailabilityType = data.availabilityType ?? "SHOP";
  return {
    sku: data.sku,
    name: data.name,
    sellingPrice: data.sellingPrice,
    brand: data.brand,
    shortDescription: data.shortDescription,
    description: data.description,
    specifications: data.specifications,
    warrantyPeriod: data.warrantyPeriod,
    warrantyNotes: data.warrantyNotes,
    mainImageUrl: data.mainImageUrl,
    imageExtractedText: data.imageExtractedText,
    galleryImageUrls: data.galleryImageUrls,
    brandImageUrl: data.brandImageUrl,
    tiktokVideoUrl: data.tiktokVideoUrl,
    ecommerceVisible: true,
    isFeatured: false,
    status: "ACTIVE" as const,
    availabilityType: nextAvailabilityType,
    pickupDelayDays: nextAvailabilityType === "WAREHOUSE" ? 1 : 0,
    showInShop: Boolean(data.ecommerceVisible ?? data.showInShop ?? true),
    shopCategory: data.shopCategory,
    shopSubcategory: data.shopSubcategory,
    shopShortDescription: data.shopShortDescription,
    shopWarranty: data.shopWarranty,
    shopSpecs: data.shopSpecs,
    shopImageUrl: data.shopImageUrl,
    shopBrand: data.shopBrand,
    isActive: true,
  };
}

const JSONB_PRODUCT_COLUMNS = new Set(["specifications", "galleryImageUrls", "catalogueConfiguration"]);

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

async function resolveId(context: ParamsContext) {
  return "params" in context && typeof (context as { params: Promise<{ id: string }> }).params?.then === "function"
    ? (await (context as { params: Promise<{ id: string }> }).params).id
    : (context as { params: { id: string } }).params.id;
}

async function getExistingProductRecord(id: string, capabilities: Awaited<ReturnType<typeof getProductTableCapabilities>>) {
  const rows = capabilities.schemaMode === "modern"
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
          WHERE "id" = $1
          LIMIT 1
        `,
        id,
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
          WHERE "id" = $1
          LIMIT 1
        `,
        id,
      );

  return rows[0] ?? null;
}

async function findDuplicateSku(id: string, sku: string, capabilities: Awaited<ReturnType<typeof getProductTableCapabilities>>) {
  const rows = capabilities.schemaMode === "modern"
    ? await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM "Product" WHERE "sku" = $1 AND "id" <> $2 LIMIT 1`,
        sku,
        id,
      )
    : await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM "Product" WHERE COALESCE("key", '') = $1 AND "id" <> $2 LIMIT 1`,
        sku,
        id,
      );

  return rows[0] ?? null;
}

export async function PATCH(req: Request, context: ParamsContext) {
  const auth = await requireRoleOrBrendah(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const capabilities = await getProductTableCapabilities(prisma);
  const id = await resolveId(context);
  const existing = await getExistingProductRecord(id, capabilities);
  if (!existing) return noStoreJson({ error: "Product not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  }

  const actorId = await resolveProductActivityActor({
    request: req,
    role: auth.role,
    sessionUserId: (auth.session?.user as { id?: string } | undefined)?.id,
    fallbackActorId: await getActorId(),
  });
  const data = auth.isBrendah ? sanitizeBrendahProductUpdate(parsed.data) : parsed.data;
  const canonicalBrand =
    data.brand !== undefined ? await resolveCanonicalProductBrand(prisma, capabilities, data.brand) : undefined;
  const canonicalShopBrand =
    data.shopBrand !== undefined || data.brand !== undefined
      ? await resolveCanonicalProductBrand(prisma, capabilities, data.brand ?? data.shopBrand)
      : undefined;
  const nextVariableCost = data.variableCost ?? Boolean(existing.variableCost);
  const nextLastBuyingPrice = data.lastBuyingPrice !== undefined ? data.lastBuyingPrice : Number(existing.lastBuyingPrice ?? 0) || null;
  const nextStatus = data.status ?? String(existing.status || (Boolean(existing.isActive) ? "ACTIVE" : "INACTIVE")).toUpperCase();
  const normalizedAvailabilityType = data.availabilityType ?? String(existing.availabilityType || "SHOP").toUpperCase();
  const normalizedPickupDelayDays = normalizedAvailabilityType === "WAREHOUSE" ? 1 : 0;
  const nextSku = data.sku ? normalizeSku(data.sku) : undefined;
  if (nextSku) {
    const duplicate = await findDuplicateSku(id, nextSku, capabilities);
    if (duplicate) return noStoreJson({ error: "SKU already exists" }, { status: 409 });
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];
  const pushSet = (column: string, value: unknown) => {
    values.push(value);
    const castSuffix = JSONB_PRODUCT_COLUMNS.has(column) ? "::jsonb" : "";
    setClauses.push(`"${column}" = $${values.length}${castSuffix}`);
  };

  if (capabilities.schemaMode === "modern") {
    if (nextSku !== undefined) pushSet("sku", nextSku);
    if (data.name !== undefined) pushSet("name", data.name);
    if (data.category !== undefined) pushSet("category", data.category);
    if (data.sellingPrice !== undefined) pushSet("sellingPrice", data.sellingPrice);
    if (data.lastBuyingPrice !== undefined || data.variableCost !== undefined) {
      pushSet("lastBuyingPrice", nextVariableCost ? null : nextLastBuyingPrice);
    }
    if (data.defaultWarranty !== undefined) pushSet("defaultWarranty", normalizeOptionalText(data.defaultWarranty));
    if (data.variableCost !== undefined) pushSet("variableCost", data.variableCost);
    if (data.isActive !== undefined || data.status !== undefined) pushSet("isActive", nextStatus === "ACTIVE" && Boolean(data.isActive ?? existing.isActive));
    // Product-level commission has been retired. Keep the columns disabled for
    // backwards compatibility while historical commission ledgers remain intact.
    pushSet("commissionEnabled", false);
    pushSet("commissionAmount", null);
    pushSet("commissionRequiresApproval", false);
  } else {
    if (nextSku !== undefined) pushSet("key", nextSku);
    if (data.name !== undefined) pushSet("name", data.name);
    if (data.category !== undefined) pushSet("unit", data.category);
    if (data.sellingPrice !== undefined) pushSet("sellPrice", data.sellingPrice);
    if (data.isActive !== undefined || data.status !== undefined) pushSet("active", nextStatus === "ACTIVE" && Boolean(data.isActive ?? existing.isActive));
  }

  if (capabilities.brand && data.brand !== undefined) pushSet("brand", canonicalBrand ?? null);
  if (capabilities.shortDescription && data.shortDescription !== undefined) pushSet("shortDescription", normalizeOptionalText(data.shortDescription));
  if (capabilities.description && data.description !== undefined) pushSet("description", normalizeOptionalText(data.description));
  if (capabilities.specifications && data.specifications !== undefined) pushSet("specifications", normalizeSpecifications(data.specifications));
  if (capabilities.warrantyPeriod && data.warrantyPeriod !== undefined) pushSet("warrantyPeriod", normalizeOptionalText(data.warrantyPeriod));
  if (capabilities.warrantyNotes && data.warrantyNotes !== undefined) pushSet("warrantyNotes", normalizeOptionalText(data.warrantyNotes));
  if (capabilities.mainImageUrl && data.mainImageUrl !== undefined) pushSet("mainImageUrl", normalizeOptionalText(data.mainImageUrl));
  if (capabilities.imageExtractedText && data.imageExtractedText !== undefined) pushSet("imageExtractedText", normalizeOptionalText(data.imageExtractedText));
  if (capabilities.galleryImageUrls && data.galleryImageUrls !== undefined) pushSet("galleryImageUrls", normalizeJsonStringArray(data.galleryImageUrls));
  if (capabilities.brandImageUrl && data.brandImageUrl !== undefined) pushSet("brandImageUrl", normalizeOptionalText(data.brandImageUrl));
  if (capabilities.tiktokVideoUrl && data.tiktokVideoUrl !== undefined) pushSet("tiktokVideoUrl", normalizeOptionalText(data.tiktokVideoUrl));
  if (capabilities.ecommerceVisible && data.ecommerceVisible !== undefined) pushSet("ecommerceVisible", data.ecommerceVisible);
  if (capabilities.isFeatured && data.isFeatured !== undefined) pushSet("isFeatured", data.isFeatured);
  if (capabilities.status && data.status !== undefined) pushSet("status", nextStatus);
  if (capabilities.availabilityType && data.availabilityType !== undefined) pushSet("availabilityType", normalizedAvailabilityType);
  if (capabilities.pickupDelayDays && (data.pickupDelayDays !== undefined || data.availabilityType !== undefined)) {
    pushSet("pickupDelayDays", normalizedPickupDelayDays);
  }
  if (capabilities.productType && data.productType !== undefined) pushSet("productType", normalizeOptionalText(data.productType));
  if (capabilities.posEnabled && data.posEnabled !== undefined) pushSet("posEnabled", data.posEnabled);
  if (capabilities.catalogueConfiguration && data.catalogueConfiguration !== undefined) {
    pushSet("catalogueConfiguration", data.catalogueConfiguration ? JSON.stringify(data.catalogueConfiguration) : null);
  }

  if (capabilities.showInShop && (data.showInShop !== undefined || data.ecommerceVisible !== undefined)) {
    pushSet("showInShop", Boolean(data.ecommerceVisible ?? data.showInShop));
  }
  if (capabilities.shopCategory && data.shopCategory !== undefined) pushSet("shopCategory", normalizeOptionalText(data.shopCategory));
  if (capabilities.shopSubcategory && data.shopSubcategory !== undefined) pushSet("shopSubcategory", normalizeOptionalText(data.shopSubcategory));
  if (capabilities.shopShortDescription && (data.shopShortDescription !== undefined || data.shortDescription !== undefined)) {
    pushSet("shopShortDescription", normalizeOptionalText(data.shortDescription ?? data.shopShortDescription));
  }
  if (capabilities.shopWarranty && (data.shopWarranty !== undefined || data.warrantyPeriod !== undefined)) {
    pushSet("shopWarranty", normalizeOptionalText(data.warrantyPeriod ?? data.shopWarranty));
  }
  if (capabilities.shopSpecs && (data.shopSpecs !== undefined || data.specifications !== undefined)) {
    pushSet("shopSpecs", normalizeOptionalText(Array.isArray(data.specifications) ? data.specifications.join(", ") : data.specifications ?? data.shopSpecs));
  }
  if (capabilities.shopImageUrl && (data.shopImageUrl !== undefined || data.mainImageUrl !== undefined)) {
    pushSet("shopImageUrl", normalizeOptionalText(data.mainImageUrl ?? data.shopImageUrl));
  }
  if (capabilities.shopBrand && (data.shopBrand !== undefined || data.brand !== undefined)) {
    pushSet("shopBrand", canonicalShopBrand ?? null);
  }

  if (!setClauses.length) {
    return noStoreJson({ ok: true, item: existing, backfill: { items: 0, orders: 0 } });
  }

  values.push(id);
  const updated = (await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `UPDATE "Product" SET ${setClauses.join(", ")} WHERE "id" = $${values.length} RETURNING *`,
    ...values,
  ))[0];

  let backfilledItems = 0;
  let recomputedOrders = 0;
  let synchronizedReceiptItems = 0;
  if (capabilities.schemaMode === "modern") {
    const nextBuyingPrice = Number(updated.lastBuyingPrice ?? 0);
    if (Number.isFinite(nextBuyingPrice) && nextBuyingPrice > 0) {
      const itemsMissingCosts = await prisma.orderItem.findMany({
        where: {
          productId: id,
          orderCosts: { none: {} },
        },
        select: {
          id: true,
          orderId: true,
          quantity: true,
          order: { select: { orderNumber: true } },
        },
      });

      if (itemsMissingCosts.length > 0) {
        await prisma.orderCost.createMany({
          data: itemsMissingCosts.map((item) => ({
            orderItemId: item.id,
            unitCost: nextBuyingPrice,
            costSource: "product_catalog_sync",
          })),
        });
        backfilledItems = itemsMissingCosts.length;

        const touchedOrderIds = Array.from(new Set(itemsMissingCosts.map((item) => item.orderId).filter(Boolean)));
        for (const orderId of touchedOrderIds) {
          await recomputeOrderEconomics(orderId);
        }
        recomputedOrders = touchedOrderIds.length;

        const receiptNumbers = Array.from(
          new Set(
            itemsMissingCosts.flatMap((item) => {
              const raw = item.order.orderNumber?.trim() ?? "";
              const canonical = canonicalReceiptNumber(raw) ?? "";
              return [raw, canonical].filter(Boolean);
            }),
          ),
        );
        if (receiptNumbers.length > 0) {
          const productNames = Array.from(
            new Set([String(existing.name ?? "").trim(), String(updated.name ?? "").trim()].filter(Boolean)),
          );
          const [supportReceipts, marketingReceipts] = await Promise.all([
            prisma.supportReceipt.findMany({
              where: { receiptNumber: { in: receiptNumbers } },
              include: { items: true },
            }),
            prisma.marketingReceipt.findMany({
              where: { receiptNumber: { in: receiptNumbers } },
              include: { items: true },
            }),
          ]);
          const normalizeName = (value: string) =>
            value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
          const normalizedProductNames = new Set(productNames.map(normalizeName));
          const quantityByReceipt = new Map<string, number>();
          for (const item of itemsMissingCosts) {
            const raw = item.order.orderNumber?.trim() ?? "";
            const quantity = Math.max(1, Number(item.quantity ?? 1));
            if (raw) quantityByReceipt.set(raw, quantity);
            const canonical = canonicalReceiptNumber(raw);
            if (canonical) quantityByReceipt.set(canonical, quantity);
          }

          for (const receipt of supportReceipts) {
            const totalCost = Math.round(nextBuyingPrice * (quantityByReceipt.get(receipt.receiptNumber ?? "") ?? 1));
            const matchingItems = receipt.items.filter(
              (item) => Number(item.buyingPrice ?? 0) <= 0 && normalizedProductNames.has(normalizeName(item.productName)),
            );
            for (const item of matchingItems) {
              await prisma.supportReceiptItem.update({
                where: { id: item.id },
                data: { buyingPrice: totalCost, pricedAt: new Date() },
              });
              item.buyingPrice = totalCost;
              synchronizedReceiptItems += 1;
            }
            if (matchingItems.length > 0) {
              const buyingTotal = receipt.items.reduce((sum, item) => sum + Number(item.buyingPrice ?? 0), 0);
              await prisma.supportReceipt.update({ where: { id: receipt.id }, data: { buyingTotal } });
              await recalcSupportEntry(prisma, receipt.dailyEntryId);
            }
          }

          for (const receipt of marketingReceipts) {
            const totalCost = Math.round(nextBuyingPrice * (quantityByReceipt.get(receipt.receiptNumber ?? "") ?? 1));
            const matchingItems = receipt.items.filter(
              (item) => Number(item.buyingPrice ?? 0) <= 0 && normalizedProductNames.has(normalizeName(item.productName)),
            );
            for (const item of matchingItems) {
              await prisma.marketingReceiptItem.update({ where: { id: item.id }, data: { buyingPrice: totalCost } });
              item.buyingPrice = totalCost;
              synchronizedReceiptItems += 1;
            }
            if (matchingItems.length > 0) {
              const buyingTotal = receipt.items.reduce((sum, item) => sum + Number(item.buyingPrice ?? 0), 0);
              await prisma.marketingReceipt.update({ where: { id: receipt.id }, data: { buyingTotal } });
              await recalcMarketingEntry(prisma, receipt.dailyEntryId);
            }
          }
        }
      }
    }
  }

  if (actorId) {
    await prisma.actionLog.create({
      data: {
        actorId,
        entity: "Product",
        entityId: String(updated.id),
        action: "POS_PRODUCT_UPDATE",
        before: existing as Prisma.InputJsonValue,
        after: updated as Prisma.InputJsonValue,
      },
    });
  }

  return noStoreJson({
    ok: true,
    item: updated,
    backfill: {
      items: backfilledItems,
      orders: recomputedOrders,
      receiptItems: synchronizedReceiptItems,
    },
  });
}

export async function DELETE(_: Request, context: ParamsContext) {
  const auth = await requireRoleOrBrendah(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const capabilities = await getProductTableCapabilities(prisma);
  const id = await resolveId(context);
  const existing = await getExistingProductRecord(id, capabilities);
  if (!existing) return noStoreJson({ error: "Product not found" }, { status: 404 });

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? (await getActorId());
  const linkedOrderItems = await prisma.orderItem.count({ where: { productId: id } });

  if (linkedOrderItems > 0) {
    const archived =
      capabilities.schemaMode === "modern"
        ? existing.isActive
          ? await prisma.product.update({
              where: { id },
              data: { isActive: false },
            })
          : existing
        : (await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
            `UPDATE "Product" SET "active" = FALSE WHERE "id" = $1 RETURNING *`,
            id,
          ))[0];

    if (actorId) {
      await prisma.actionLog.create({
        data: {
          actorId,
          entity: "Product",
          entityId: String(existing.id),
          action: "POS_PRODUCT_ARCHIVE",
          before: existing as Prisma.InputJsonValue,
          after: archived as Prisma.InputJsonValue,
        },
      });
    }

    return noStoreJson({
      ok: true,
      archived: true,
      item: archived,
      message: capabilities.schemaMode === "modern" && existing.isActive
        ? "Product archived. Historical POS receipts remain unchanged."
        : "Product is already archived. Historical POS receipts remain unchanged.",
    });
  }

  try {
    if (capabilities.schemaMode === "modern") {
      await prisma.product.delete({
        where: { id },
      });
    } else {
      await prisma.$executeRawUnsafe(`DELETE FROM "Product" WHERE "id" = $1`, id);
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2003" || error.code === "P2014")
    ) {
      return noStoreJson(
        { error: "This product is linked to historical receipts. Archive it instead so receipts remain unchanged." },
        { status: 409 },
      );
    }
    throw error;
  }

  if (actorId) {
    await prisma.actionLog.create({
      data: {
          actorId,
          entity: "Product",
          entityId: String(existing.id),
          action: "POS_PRODUCT_DELETE",
          before: existing as Prisma.InputJsonValue,
      },
    });
  }

  return noStoreJson({ ok: true });
}
