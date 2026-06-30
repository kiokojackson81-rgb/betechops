import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getProductTableCapabilities } from "@/lib/productTableCapabilities";
import type { ShopProduct, ShopProductVisualType } from "@/app/shop/shopData";
import {
  expandShopSearchQuery,
  getShopSubcategoryDefinition,
  normalizeShopCategorySlug,
  resolveShopSubcategory,
  SHOP_CATEGORY_DEFINITIONS,
} from "@/app/shop/shopCatalogConfig";
import {
  getProductAvailabilityMessage,
  getProductCheckoutAvailabilityMessage,
  normalizeAvailabilityType,
} from "@/app/shop/shopAvailability";
import { sanitizeProductDescription, sanitizeProductSpecificationLines } from "@/lib/productDescriptionFormatting";

type OpsCatalogueProduct = {
  id: string;
  sku: string;
  name: string;
  category: string;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  sellingPrice: number;
  defaultWarranty: string | null;
  minStockLevel: number;
  stockQuantity: number;
  isActive: boolean;
  brand?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  specifications?: unknown;
  warrantyPeriod?: string | null;
  warrantyNotes?: string | null;
  mainImageUrl?: string | null;
  imageExtractedText?: string | null;
  galleryImageUrls?: unknown;
  brandImageUrl?: string | null;
  tiktokVideoUrl?: string | null;
  ecommerceVisible?: boolean | null;
  isFeatured?: boolean | null;
  status?: string | null;
  availabilityType?: string | null;
  pickupDelayDays?: number | null;
  showInShop?: boolean | null;
  shopCategory?: string | null;
  shopSubcategory?: string | null;
  shopShortDescription?: string | null;
  shopWarranty?: string | null;
  shopSpecs?: string | null;
  shopImageUrl?: string | null;
  shopBrand?: string | null;
  commissionEnabled?: boolean | null;
  commissionAmount?: number | null;
  commissionRequiresApproval?: boolean | null;
};

type ShopCategoryDefinition = {
  slug: string;
  title: string;
  keywords: string[];
  visualType: ShopProductVisualType;
  image: string;
};

const SHOP_CATALOGUE_REVALIDATE_SECONDS = 600;

export type ShopProductMappingField =
  | "category"
  | "price"
  | "brand"
  | "image"
  | "warranty"
  | "specs";

export type ShopProductMappingWarning = {
  field: ShopProductMappingField;
  message: string;
};

export type ShopProductRejectionReason =
  | "rejected: non-solar keyword/category"
  | "rejected: invalid price"
  | "rejected: missing product image"
  | "rejected: missing required display name"
  | "rejected: inactive status";

export type ShopProductMappingPreview = {
  product: ShopProduct | null;
  opsProductId: string;
  rawName: string;
  rawCategory: string;
  normalizedCategory: string;
  showInShopValue: boolean | null;
  shopCategoryValue: string | null;
  shopSubcategoryValue: string | null;
  warnings: ShopProductMappingWarning[];
  includedInCatalog: boolean;
  rejectionReasons: string[];
  source: "ops";
};

const OPS_SHOP_CATEGORY_MAP: ShopCategoryDefinition[] = [
  ...SHOP_CATEGORY_DEFINITIONS.map((category): ShopCategoryDefinition => ({
    slug: category.value,
    title: category.label,
    keywords: category.keywords,
    visualType: category.visualType,
    image: category.image,
  })),
  {
    slug: "uncategorized",
    title: "Uncategorized",
    keywords: [],
    visualType: "kit",
    image: "/agents/product-accessories-clean.png",
  },
];

const KNOWN_BRANDS = [
  "ALLTOP",
  "Felicity Solar",
  "Growatt",
  "JA Solar",
  "Jinko Solar",
  "MUST",
  "Ritar",
  "SRNE",
  "Vision",
] as const;

const SOLAR_ALLOW_KEYWORDS = [
  "solar",
  "panel",
  "inverter",
  "battery",
  "lithium",
  "controller",
  "charge controller",
  "full kit",
  "solar kit",
  "all in one",
  "water heater",
  "water pump",
  "pump",
  "flood light",
  "solar light",
  "cable",
  "breaker",
  "connector",
  "accessories",
  "mounting",
  "dc bulb",
  "ac/dc",
  "pv",
] as const;

const NON_SOLAR_BLOCK_KEYWORDS = [
  "beef",
  "goat",
  "liver",
  "meat",
  "steak",
  "mutura",
  "food",
  "butchery",
  "chicken",
  "pork",
  "sausage",
] as const;

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function compactUnique(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
}

async function queryOpsCatalogueProducts(whereClause = "", params: unknown[] = []) {
  const capabilities = await getProductTableCapabilities(prisma);
  const available = capabilities.available;

  if (capabilities.schemaMode === "modern") {
    return prisma.$queryRawUnsafe<OpsCatalogueProduct[]>(
      `
      SELECT
        "id",
        "sku",
        "name",
        COALESCE("category", 'Accessories') AS "category",
        ${available.has("createdAt") ? `"createdAt"` : `NULL::timestamp`} AS "createdAt",
        ${available.has("updatedAt") ? `"updatedAt"` : `NULL::timestamp`} AS "updatedAt",
        COALESCE("sellingPrice", 0) AS "sellingPrice",
        "defaultWarranty",
        COALESCE("minStockLevel", 0) AS "minStockLevel",
        COALESCE("stockQuantity", 0) AS "stockQuantity",
        COALESCE("isActive", true) AS "isActive",
        ${available.has("brand") ? `"brand"` : `NULL::text`} AS "brand",
        ${available.has("shortDescription") ? `"shortDescription"` : `NULL::text`} AS "shortDescription",
        ${available.has("description") ? `"description"` : `NULL::text`} AS "description",
        ${available.has("specifications") ? `"specifications"` : `NULL::jsonb`} AS "specifications",
        ${available.has("warrantyPeriod") ? `"warrantyPeriod"` : `NULL::text`} AS "warrantyPeriod",
        ${available.has("warrantyNotes") ? `"warrantyNotes"` : `NULL::text`} AS "warrantyNotes",
        ${available.has("mainImageUrl") ? `"mainImageUrl"` : `NULL::text`} AS "mainImageUrl",
        ${available.has("imageExtractedText") ? `"imageExtractedText"` : `NULL::text`} AS "imageExtractedText",
        ${available.has("galleryImageUrls") ? `"galleryImageUrls"` : `NULL::jsonb`} AS "galleryImageUrls",
        ${available.has("brandImageUrl") ? `"brandImageUrl"` : `NULL::text`} AS "brandImageUrl",
        ${available.has("tiktokVideoUrl") ? `"tiktokVideoUrl"` : `NULL::text`} AS "tiktokVideoUrl",
        ${available.has("ecommerceVisible") ? `COALESCE("ecommerceVisible", false)` : `NULL::boolean`} AS "ecommerceVisible",
        ${available.has("isFeatured") ? `COALESCE("isFeatured", false)` : `NULL::boolean`} AS "isFeatured",
        ${available.has("status") ? `"status"` : `NULL::text`} AS "status",
        ${available.has("availabilityType") ? `"availabilityType"` : `NULL::text`} AS "availabilityType",
        ${available.has("pickupDelayDays") ? `COALESCE("pickupDelayDays", 0)` : `NULL::int`} AS "pickupDelayDays",
        ${available.has("showInShop") ? `COALESCE("showInShop", false)` : `NULL::boolean`} AS "showInShop",
        ${available.has("shopCategory") ? `"shopCategory"` : `NULL::text`} AS "shopCategory",
        ${available.has("shopSubcategory") ? `"shopSubcategory"` : `NULL::text`} AS "shopSubcategory",
        ${available.has("shopShortDescription") ? `"shopShortDescription"` : `NULL::text`} AS "shopShortDescription",
        ${available.has("shopWarranty") ? `"shopWarranty"` : `NULL::text`} AS "shopWarranty",
        ${available.has("shopSpecs") ? `"shopSpecs"` : `NULL::text`} AS "shopSpecs",
        ${available.has("shopImageUrl") ? `"shopImageUrl"` : `NULL::text`} AS "shopImageUrl",
        ${available.has("shopBrand") ? `"shopBrand"` : `NULL::text`} AS "shopBrand",
        ${available.has("commissionEnabled") ? `COALESCE("commissionEnabled", false)` : `NULL::boolean`} AS "commissionEnabled",
        ${available.has("commissionAmount") ? `"commissionAmount"` : `NULL::numeric`} AS "commissionAmount",
        ${available.has("commissionRequiresApproval") ? `COALESCE("commissionRequiresApproval", false)` : `NULL::boolean`} AS "commissionRequiresApproval"
      FROM "Product"
      WHERE COALESCE("isActive", true) = true
      ${whereClause}
      ORDER BY "name" ASC
    `,
      ...params,
    );
  }

  if (available.has("key") && available.has("sellPrice")) {
    return prisma.$queryRawUnsafe<OpsCatalogueProduct[]>(
      `
      SELECT
        "id",
        COALESCE("key", "id") AS "sku",
        "name",
        COALESCE("unit", 'Accessories') AS "category",
        ${available.has("createdAt") ? `"createdAt"` : `NULL::timestamp`} AS "createdAt",
        ${available.has("updatedAt") ? `"updatedAt"` : `NULL::timestamp`} AS "updatedAt",
        COALESCE("sellPrice", 0) AS "sellingPrice",
        NULL::text AS "defaultWarranty",
        0 AS "minStockLevel",
        0 AS "stockQuantity",
        COALESCE("active", true) AS "isActive",
        ${available.has("brand") ? `"brand"` : `NULL::text`} AS "brand",
        ${available.has("shortDescription") ? `"shortDescription"` : `NULL::text`} AS "shortDescription",
        ${available.has("description") ? `"description"` : `NULL::text`} AS "description",
        ${available.has("specifications") ? `"specifications"` : `NULL::jsonb`} AS "specifications",
        ${available.has("warrantyPeriod") ? `"warrantyPeriod"` : `NULL::text`} AS "warrantyPeriod",
        ${available.has("warrantyNotes") ? `"warrantyNotes"` : `NULL::text`} AS "warrantyNotes",
        ${available.has("mainImageUrl") ? `"mainImageUrl"` : `NULL::text`} AS "mainImageUrl",
        ${available.has("imageExtractedText") ? `"imageExtractedText"` : `NULL::text`} AS "imageExtractedText",
        ${available.has("galleryImageUrls") ? `"galleryImageUrls"` : `NULL::jsonb`} AS "galleryImageUrls",
        ${available.has("brandImageUrl") ? `"brandImageUrl"` : `NULL::text`} AS "brandImageUrl",
        ${available.has("tiktokVideoUrl") ? `"tiktokVideoUrl"` : `NULL::text`} AS "tiktokVideoUrl",
        ${available.has("ecommerceVisible") ? `COALESCE("ecommerceVisible", false)` : `NULL::boolean`} AS "ecommerceVisible",
        ${available.has("isFeatured") ? `COALESCE("isFeatured", false)` : `NULL::boolean`} AS "isFeatured",
        ${available.has("status") ? `"status"` : `NULL::text`} AS "status",
        ${available.has("availabilityType") ? `"availabilityType"` : `NULL::text`} AS "availabilityType",
        ${available.has("pickupDelayDays") ? `COALESCE("pickupDelayDays", 0)` : `NULL::int`} AS "pickupDelayDays",
        ${available.has("showInShop") ? `COALESCE("showInShop", false)` : `NULL::boolean`} AS "showInShop",
        ${available.has("shopCategory") ? `"shopCategory"` : `NULL::text`} AS "shopCategory",
        ${available.has("shopSubcategory") ? `"shopSubcategory"` : `NULL::text`} AS "shopSubcategory",
        ${available.has("shopShortDescription") ? `"shopShortDescription"` : `NULL::text`} AS "shopShortDescription",
        ${available.has("shopWarranty") ? `"shopWarranty"` : `NULL::text`} AS "shopWarranty",
        ${available.has("shopSpecs") ? `"shopSpecs"` : `NULL::text`} AS "shopSpecs",
        ${available.has("shopImageUrl") ? `"shopImageUrl"` : `NULL::text`} AS "shopImageUrl",
        ${available.has("shopBrand") ? `"shopBrand"` : `NULL::text`} AS "shopBrand",
        ${available.has("commissionEnabled") ? `COALESCE("commissionEnabled", false)` : `NULL::boolean`} AS "commissionEnabled",
        ${available.has("commissionAmount") ? `"commissionAmount"` : `NULL::numeric`} AS "commissionAmount",
        ${available.has("commissionRequiresApproval") ? `COALESCE("commissionRequiresApproval", false)` : `NULL::boolean`} AS "commissionRequiresApproval"
      FROM "Product"
      WHERE COALESCE("active", true) = true
      ${whereClause}
      ORDER BY "name" ASC
    `,
      ...params,
    );
  }

  throw new Error(`Unsupported Product table shape for read-only shop sync. Columns: ${Array.from(available).join(", ")}`);
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = sanitizeProductDescription(String(value || ""));
  return normalized || null;
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return compactUnique(
      value.map((entry) => (typeof entry === "string" ? entry : String(entry ?? "").trim())),
    );
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return compactUnique(
          parsed.map((entry) => (typeof entry === "string" ? entry : String(entry ?? "").trim())),
        );
      }
    } catch {
      // Fall through to line-based parsing for legacy text values.
    }

    return compactUnique(
      trimmed
        .split(/\r?\n|[,;]+/)
        .map((entry) => entry.trim()),
    );
  }

  return [];
}

function normalizeSpecificationLines(value: unknown) {
  const direct = Array.isArray(value) ? normalizeStringArray(value) : [];
  if (direct.length) {
    return direct
      .map((line) => sanitizeProductDescription(line))
      .filter(Boolean);
  }
  return sanitizeProductSpecificationLines(value);
}

function hasAnyKeyword(haystacks: string[], keywords: readonly string[]) {
  const normalizedHaystack = haystacks.map((value) => normalizeText(value)).join(" ");
  return keywords.some((keyword) => normalizedHaystack.includes(normalizeText(keyword)));
}

function matchCategoryDefinition(input: string) {
  const haystack = normalizeText(input);
  return (
    OPS_SHOP_CATEGORY_MAP.find((entry) =>
      entry.keywords.some((keyword) => haystack.includes(normalizeText(keyword))),
    ) ?? null
  );
}

function getCategoryDefinitionBySlug(slug: string) {
  return OPS_SHOP_CATEGORY_MAP.find((entry) => entry.slug === slug) ?? OPS_SHOP_CATEGORY_MAP[OPS_SHOP_CATEGORY_MAP.length - 1];
}

function inferCategoryDefinition(product: Pick<OpsCatalogueProduct, "category" | "name" | "sku">) {
  const rawCategory = String(product.category || "").trim();
  const matched =
    matchCategoryDefinition(rawCategory) ??
    matchCategoryDefinition(product.name) ??
    matchCategoryDefinition(product.sku);

  if (matched) {
    return {
      definition: matched,
      warning:
        rawCategory && matchCategoryDefinition(rawCategory)
          ? null
          : {
              field: "category" as const,
              message: `Category "${rawCategory || "blank"}" was normalized to ${matched.title}.`,
            },
    };
  }

  const fallback = rawCategory ? getCategoryDefinitionBySlug("accessories") : getCategoryDefinitionBySlug("uncategorized");

  return {
    definition: fallback,
    warning: {
      field: "category" as const,
      message: rawCategory
        ? `Unknown category "${rawCategory}" was mapped to ${fallback.title}.`
        : `Missing category was mapped to ${fallback.title}.`,
    },
  };
}

function normalizeShopCategoryValue(value: string | null | undefined) {
  const normalized = normalizeShopCategorySlug(value);
  return OPS_SHOP_CATEGORY_MAP.find((entry) => entry.slug === normalized) ?? null;
}

function inferBrand(name: string) {
  const hit = KNOWN_BRANDS.find((brand) => normalizeText(name).includes(normalizeText(brand)));
  return hit ?? "Betech Solar";
}

function inferSpecs(product: OpsCatalogueProduct, categoryTitle: string) {
  const normalizedName = product.name.trim();
  const powerMatch = normalizedName.match(/(\d+(?:\.\d+)?)\s*(kw|kva|w|ah|v)/i);

  const specs = compactUnique([
    powerMatch ? `${powerMatch[1]}${powerMatch[2].toUpperCase()} configuration` : null,
    categoryTitle,
    `SKU: ${product.sku}`,
  ]).slice(0, 4);

  return specs.length ? specs : ["Contact us for full specs."];
}

function inferWarranty(product: OpsCatalogueProduct) {
  return product.defaultWarranty?.trim() || "Contact Betech Solar for warranty guidance.";
}

function inferStockStatus(product: OpsCatalogueProduct): ShopProduct["stockStatus"] {
  if (!product.isActive) return "quote_only";
  if (product.stockQuantity > product.minStockLevel) return "in_stock";
  if (product.stockQuantity > 0) return "limited_stock";
  return "quote_only";
}

function inferTags(product: OpsCatalogueProduct, category: ShopCategoryDefinition, brand: string) {
  const powerMatch = product.name.match(/(\d+(?:\.\d+)?)\s*(kw|kva|w|ah|v)/i);

  return compactUnique([
    category.slug,
    brand,
    product.category,
    powerMatch ? `${powerMatch[1]}${powerMatch[2].toLowerCase()}` : null,
  ]).slice(0, 6);
}

export function isSolarShopEligibleProduct(input: {
  name?: string | null;
  category?: string | null;
  tags?: string[] | null;
  specs?: string[] | null;
  price?: number | null;
  hasImage?: boolean | null;
  showInShop?: boolean | null;
  ecommerceVisible?: boolean | null;
  status?: string | null;
}) {
  const name = String(input.name || "").trim();
  const price = Number(input.price);
  const haystacks = [name, String(input.category || ""), ...(input.tags || []), ...(input.specs || [])];
  const explicitlyVisibleOnline = Boolean(input.showInShop ?? input.ecommerceVisible);

  const rejectionReasons: string[] = [];

  if (!name) {
    rejectionReasons.push("rejected: missing required display name");
  }

  if (!Number.isFinite(price) || price <= 0) {
    rejectionReasons.push("rejected: invalid price");
  }

  if (!input.hasImage) {
    rejectionReasons.push("rejected: missing product image");
  }

  if (String(input.status || "ACTIVE").trim().toUpperCase() !== "ACTIVE") {
    rejectionReasons.push("rejected: inactive status");
  }

  if (!explicitlyVisibleOnline && (hasAnyKeyword(haystacks, NON_SOLAR_BLOCK_KEYWORDS) || !hasAnyKeyword(haystacks, SOLAR_ALLOW_KEYWORDS))) {
    rejectionReasons.push("rejected: non-solar keyword/category");
  }

  return {
    eligible: rejectionReasons.length === 0,
    rejectionReasons,
  };
}

function buildMappingWarnings(
  product: OpsCatalogueProduct,
  category: ShopCategoryDefinition,
  price: number,
  brand: string,
  specs: string[],
  warranty: string,
  categoryWarning: ShopProductMappingWarning | null,
) {
  const warnings: ShopProductMappingWarning[] = [];

  if (categoryWarning) warnings.push(categoryWarning);
  if (!String(product.category || "").trim()) {
    warnings.push({ field: "category", message: "Category is blank in the ops catalogue." });
  }
  if (!Number.isFinite(price) || price < 0) {
    warnings.push({ field: "price", message: "Price is missing or invalid, so the product is excluded from customer-facing catalogue results." });
  }
  if (brand === "Betech Solar") {
    warnings.push({ field: "brand", message: "Brand was not found explicitly in the ops catalogue name and fell back to Betech Solar." });
  }
  if (!(normalizeOptionalText(product.mainImageUrl) || normalizeOptionalText(product.shopImageUrl))) {
    warnings.push({ field: "image", message: "No product image mapping was available, so the product is excluded from the customer-facing catalogue." });
  }
  if (
    !(
      normalizeOptionalText(product.warrantyPeriod) ||
      normalizeOptionalText(product.shopWarranty) ||
      product.defaultWarranty?.trim()
    )
  ) {
    warnings.push({ field: "warranty", message: "Warranty is missing in the ops catalogue. Customer pages fall back to contact-for-warranty guidance." });
  }
  if (
    specs.length === 1 &&
    specs[0] === "Contact us for full specs."
  ) {
    warnings.push({ field: "specs", message: "Specs are missing in the ops catalogue. Customer pages fall back to contact-for-specs guidance." });
  }

  return warnings;
}

function mapOpsProduct(product: OpsCatalogueProduct): ShopProductMappingPreview {
  const price = Number(product.sellingPrice);
  const explicitShopCategory = normalizeShopCategoryValue(product.shopCategory);
  const inferredCategory = inferCategoryDefinition(product);
  const category = explicitShopCategory ?? inferredCategory.definition;
  const categoryWarning = explicitShopCategory ? null : inferredCategory.warning;
  const safeName = product.name.trim() || product.sku || "";
  const brand =
    normalizeOptionalText(product.shopBrand) ||
    normalizeOptionalText(product.brand) ||
    inferBrand(safeName);
  const resolvedSubcategory =
    getShopSubcategoryDefinition(category.slug, product.shopSubcategory) ??
    resolveShopSubcategory(category.slug, [
      product.shopSubcategory,
      product.shortDescription,
      product.shopShortDescription,
      ...normalizeSpecificationLines(product.specifications),
      product.shopSpecs,
      product.name,
      product.category,
      product.sku,
    ]);
  const parsedSpecs = normalizeSpecificationLines(product.specifications);
  const specs = compactUnique([
    normalizeOptionalText(product.shortDescription),
    product.shopSpecs?.trim() || null,
    product.shopShortDescription?.trim() || null,
    ...parsedSpecs,
    ...inferSpecs(product, category.title),
  ]).slice(0, 4);
  const warranty =
    normalizeOptionalText(product.warrantyPeriod) ||
    product.shopWarranty?.trim() ||
    product.defaultWarranty?.trim() ||
    inferWarranty(product);
  const warrantyNotes = normalizeOptionalText(product.warrantyNotes);
  const mainImage = normalizeOptionalText(product.mainImageUrl) || normalizeOptionalText(product.shopImageUrl) || category.image;
  const galleryImages = compactUnique([mainImage, ...normalizeStringArray(product.galleryImageUrls)]).filter(Boolean);
  const brandImage = normalizeOptionalText(product.brandImageUrl);
  const tiktokVideoUrl = normalizeOptionalText(product.tiktokVideoUrl);
  const fullDescription =
    normalizeOptionalText(product.description) ||
    normalizeOptionalText(product.shopShortDescription) ||
    normalizeOptionalText(product.shortDescription);
  const shortDescription =
    normalizeOptionalText(product.shortDescription) ||
    normalizeOptionalText(product.shopShortDescription) ||
    specs[0] ||
    "Contact us for full specs.";
  const availabilityType = normalizeAvailabilityType(product.availabilityType);
  const pickupDelayDays = availabilityType === "WAREHOUSE" ? 1 : 0;
  const availabilityMessage = getProductAvailabilityMessage({
    availabilityType,
    pickupDelayDays,
  });
  const checkoutAvailabilityMessage = getProductCheckoutAvailabilityMessage({
    availabilityType,
    pickupDelayDays,
  });
  const warnings = buildMappingWarnings(product, category, price, brand, specs, warranty, categoryWarning);
  const hasImage = Boolean(normalizeOptionalText(product.mainImageUrl) || normalizeOptionalText(product.shopImageUrl));
  const ecommerceVisible =
    typeof product.ecommerceVisible === "boolean"
      ? product.ecommerceVisible
      : typeof product.showInShop === "boolean"
        ? product.showInShop
        : null;
  const status = normalizeOptionalText(product.status) || (product.isActive ? "ACTIVE" : "INACTIVE");
  const eligibility = isSolarShopEligibleProduct({
    name: safeName,
    category: product.shopCategory || product.category || category.title,
    tags: [
      ...inferTags(product, category, brand),
      resolvedSubcategory?.label || "",
      resolvedSubcategory?.value || "",
    ].filter(Boolean),
    specs,
    price,
    hasImage,
    showInShop: product.showInShop,
    ecommerceVisible,
    status,
  });
  const includedInCatalog = eligibility.eligible;
  const fallbackName = safeName || `OPS Product ${product.id}`;
  const mappedProduct: ShopProduct | null = includedInCatalog
    ? {
        id: `ops-${product.id}`,
        sku: product.sku,
        slug: slugify(fallbackName),
        name: fallbackName,
        category: category.title,
        subcategory: resolvedSubcategory?.label,
        brand,
        price,
        oldPrice: undefined,
        image: mainImage,
        galleryImages,
        brandImage,
        tiktokVideoUrl,
        imageExtractedText: normalizeOptionalText(product.imageExtractedText),
        visualType: category.visualType,
        shortDescription,
        fullDescription: fullDescription || undefined,
        specs,
        warranty,
        warrantyNotes: warrantyNotes || undefined,
        availabilityType,
        pickupDelayDays,
        availabilityMessage,
        checkoutAvailabilityMessage,
        stockStatus: inferStockStatus(product),
        tags: compactUnique([...inferTags(product, category, brand), resolvedSubcategory?.label, resolvedSubcategory?.value]).slice(0, 8),
        whatsappMessage: `Hello Betech Solar, I want more details about ${fallbackName}.`,
        source: "ops",
        opsProductId: product.id,
        createdAt: product.createdAt ? new Date(product.createdAt).toISOString() : null,
        updatedAt: product.updatedAt ? new Date(product.updatedAt).toISOString() : null,
        commissionEnabled: Boolean(product.commissionEnabled),
        commissionAmount: product.commissionAmount == null ? null : Number(product.commissionAmount),
        commissionRequiresApproval: Boolean(product.commissionRequiresApproval),
      }
    : null;

  return {
    product: mappedProduct,
    opsProductId: product.id,
    rawName: fallbackName,
    rawCategory: String(product.category || "").trim(),
    normalizedCategory: category.title,
    showInShopValue: ecommerceVisible,
    shopCategoryValue: product.shopCategory?.trim() || null,
    shopSubcategoryValue: product.shopSubcategory?.trim() || null,
    warnings,
    includedInCatalog,
    rejectionReasons: eligibility.rejectionReasons,
    source: "ops",
  };
}

export function mapOpsProductToShopProduct(product: OpsCatalogueProduct): ShopProduct | null {
  return mapOpsProduct(product).product;
}

export function filterShopProducts(
  products: ShopProduct[],
  input?: {
    category?: string | null;
    subcategory?: string | null;
    q?: string | null;
  },
) {
  const category = slugify(String(input?.category || ""));
  const subcategory = slugify(String(input?.subcategory || ""));
  const query = normalizeText(String(input?.q || ""));
  const queryNeedles = expandShopSearchQuery(query);

  return products.filter((product) => {
    const productCategory = slugify(product.category);
    const matchesCategory = !category || productCategory === category;
    if (!matchesCategory) return false;

    const productSubcategory = slugify(product.subcategory || "");
    const productTags = product.tags.map((tag) => slugify(tag));
    const matchesSubcategory = !subcategory || productSubcategory === subcategory || productTags.includes(subcategory);
    if (!matchesSubcategory) return false;

    if (!query) return true;

    const haystacks = [
      product.name,
      product.brand,
      product.category,
      ...product.specs,
      ...product.tags,
    ]
      .join(" ")
      .toLowerCase();

    return queryNeedles.every((needle) => haystacks.includes(needle.toLowerCase()));
  });
}

export async function getOpsCatalogueProductsReadOnly() {
  return getCachedOpsCatalogueProductsReadOnly();
}

export async function getOpsCatalogueProductsReadOnlyMapped() {
  return (await getOpsCatalogueProductsReadOnly())
    .map((entry) => entry.product)
    .filter((entry): entry is ShopProduct => Boolean(entry));
}

export async function getOpsCatalogueProductMappedById(opsProductId: string) {
  const normalizedId = String(opsProductId || "").trim();
  if (!normalizedId) return null;

  return (
    (await getOpsCatalogueProductsReadOnly())
      .find((entry) => entry.opsProductId === normalizedId)
      ?.product ?? null
  );
}

const getCachedOpsCatalogueProductsReadOnly = unstable_cache(
  async () => {
    const products = await queryOpsCatalogueProducts();
    return products.map(mapOpsProduct).filter((entry): entry is ShopProductMappingPreview => Boolean(entry));
  },
  ["shop:ops-catalogue:readonly:v1"],
  {
    revalidate: SHOP_CATALOGUE_REVALIDATE_SECONDS,
    tags: ["shop-products"],
  },
);
