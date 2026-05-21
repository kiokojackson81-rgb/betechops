import { prisma } from "@/lib/prisma";
import { getProductTableCapabilities } from "@/lib/productTableCapabilities";
import type { ShopProduct, ShopProductVisualType } from "@/app/shop/shopData";
import { SHOP_CATEGORY_OPTIONS } from "@/app/shop/shopCatalogConfig";

type OpsCatalogueProduct = {
  id: string;
  sku: string;
  name: string;
  category: string;
  sellingPrice: number;
  defaultWarranty: string | null;
  minStockLevel: number;
  stockQuantity: number;
  isActive: boolean;
  showInShop?: boolean | null;
  shopCategory?: string | null;
  shopShortDescription?: string | null;
  shopWarranty?: string | null;
  shopSpecs?: string | null;
  shopImageUrl?: string | null;
  shopBrand?: string | null;
};

type ShopCategoryDefinition = {
  slug: string;
  title: string;
  keywords: string[];
  visualType: ShopProductVisualType;
  image: string;
};

export type ShopProductMappingField = "category" | "price" | "brand" | "image" | "warranty" | "specs";

export type ShopProductMappingWarning = {
  field: ShopProductMappingField;
  message: string;
};

export type ShopProductRejectionReason =
  | "rejected: non-solar keyword/category"
  | "rejected: invalid price"
  | "rejected: missing required display name";

export type ShopProductMappingPreview = {
  product: ShopProduct | null;
  opsProductId: string;
  rawName: string;
  rawCategory: string;
  normalizedCategory: string;
  showInShopValue: boolean | null;
  shopCategoryValue: string | null;
  warnings: ShopProductMappingWarning[];
  includedInCatalog: boolean;
  rejectionReasons: string[];
  source: "ops";
};

const OPS_SHOP_CATEGORY_MAP: ShopCategoryDefinition[] = [
  ...SHOP_CATEGORY_OPTIONS.map((option): ShopCategoryDefinition => ({
    slug: option.value,
    title: option.label,
    keywords:
      option.value === "solar-panels"
        ? ["solar panel", "solar panels", "panel", "panels", "pv"]
        : option.value === "solar-inverters"
          ? ["inverter", "hybrid inverter", "off-grid inverter"]
          : option.value === "solar-batteries"
            ? ["battery", "gel battery", "agm battery", "deep cycle"]
            : option.value === "lithium-batteries"
              ? ["lithium", "lifepo4"]
              : option.value === "solar-full-kits"
                ? ["kit", "full kit", "solar kit", "system"]
                : option.value === "all-in-one-systems"
                  ? ["all in one", "all-in-one", "aio", "integrated system"]
                  : option.value === "solar-water-heaters"
                    ? ["water heater", "heater", "hot water"]
                    : option.value === "solar-water-pumps"
                      ? ["pump", "water pump", "borehole"]
                      : option.value === "solar-lights"
                        ? ["light", "lights", "flood light", "street light"]
                        : ["accessory", "accessories", "cable", "connector", "mount", "breaker"],
    visualType:
      option.value === "solar-panels"
        ? "panel"
        : option.value === "solar-inverters"
          ? "inverter"
          : option.value === "solar-batteries" || option.value === "lithium-batteries"
            ? "battery"
            : option.value === "solar-water-pumps"
              ? "pump"
              : option.value === "solar-lights"
                ? "light"
                : option.value === "solar-water-heaters"
                  ? "heater"
                  : "kit",
    image:
      option.value === "solar-inverters"
        ? "/agents/product-inverter-clean.png"
        : option.value === "solar-batteries" || option.value === "lithium-batteries"
          ? "/agents/product-battery-clean.png"
          : option.value === "solar-water-pumps"
            ? "/agents/product-water-pump-clean.png"
            : option.value === "solar-lights"
              ? "/agents/hero-generated-v2.png"
              : option.value === "solar-water-heaters"
                ? "/agents/cta-house-generated.png"
                : option.value === "accessories"
                  ? "/agents/product-accessories-clean.png"
                  : "/agents/product-solar-kit-clean.png",
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
  const normalized = slugify(String(value || ""));
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
  showInShop?: boolean | null;
}) {
  const name = String(input.name || "").trim();
  const price = Number(input.price);
  const haystacks = [name, String(input.category || ""), ...(input.tags || []), ...(input.specs || [])];

  const rejectionReasons: string[] = [];

  if (!name) {
    rejectionReasons.push("rejected: missing required display name");
  }

  if (!Number.isFinite(price) || price <= 0) {
    rejectionReasons.push("rejected: invalid price");
  }

  if (typeof input.showInShop === "boolean" && !input.showInShop) {
    rejectionReasons.push("rejected: showInShop is false");
  }

  if (hasAnyKeyword(haystacks, NON_SOLAR_BLOCK_KEYWORDS) || !hasAnyKeyword(haystacks, SOLAR_ALLOW_KEYWORDS)) {
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
  if (!category.image) {
    warnings.push({ field: "image", message: "No product image mapping was available, so a clean placeholder will be used." });
  } else {
    warnings.push({ field: "image", message: `Customer display uses the ${category.title} placeholder visual until ops image fields are ready.` });
  }
  if (!(product.shopWarranty?.trim() || product.defaultWarranty?.trim())) {
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
  const brand = product.shopBrand?.trim() || inferBrand(safeName);
  const specs = compactUnique([
    product.shopSpecs?.trim() || null,
    product.shopShortDescription?.trim() || null,
    ...inferSpecs(product, category.title),
  ]).slice(0, 4);
  const warranty = product.shopWarranty?.trim() || product.defaultWarranty?.trim() || inferWarranty(product);
  const warnings = buildMappingWarnings(product, category, price, brand, specs, warranty, categoryWarning);
  const eligibility = isSolarShopEligibleProduct({
    name: safeName,
    category: product.shopCategory || product.category || category.title,
    tags: inferTags(product, category, brand),
    specs,
    price,
    showInShop: product.showInShop,
  });
  const includedInCatalog = eligibility.eligible;
  const fallbackName = safeName || `OPS Product ${product.id}`;
  const mappedProduct: ShopProduct | null = includedInCatalog
    ? {
        id: `ops-${product.id}`,
        slug: slugify(fallbackName),
        name: fallbackName,
        category: category.title,
        brand,
        price,
        oldPrice: undefined,
        image: product.shopImageUrl?.trim() || category.image,
        visualType: category.visualType,
        specs,
        warranty,
        stockStatus: inferStockStatus(product),
        tags: inferTags(product, category, brand),
        whatsappMessage: `Hello Betech Solar, I want more details about ${fallbackName}.`,
        source: "ops",
        opsProductId: product.id,
      }
    : null;

  return {
    product: mappedProduct,
    opsProductId: product.id,
    rawName: fallbackName,
    rawCategory: String(product.category || "").trim(),
    normalizedCategory: category.title,
    showInShopValue: typeof product.showInShop === "boolean" ? product.showInShop : null,
    shopCategoryValue: product.shopCategory?.trim() || null,
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
    q?: string | null;
  },
) {
  const category = slugify(String(input?.category || ""));
  const query = normalizeText(String(input?.q || ""));

  return products.filter((product) => {
    const productCategory = slugify(product.category);
    const matchesCategory = !category || productCategory === category;
    if (!matchesCategory) return false;

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

    return haystacks.includes(query);
  });
}

export async function getOpsCatalogueProductsReadOnly() {
  const capabilities = await getProductTableCapabilities(prisma);
  const available = capabilities.available;

  let products: OpsCatalogueProduct[] = [];

  if (capabilities.schemaMode === "modern") {
    products = await prisma.$queryRawUnsafe<OpsCatalogueProduct[]>(`
      SELECT
        "id",
        "sku",
        "name",
        COALESCE("category", 'Accessories') AS "category",
        COALESCE("sellingPrice", 0) AS "sellingPrice",
        "defaultWarranty",
        COALESCE("minStockLevel", 0) AS "minStockLevel",
        COALESCE("stockQuantity", 0) AS "stockQuantity",
        COALESCE("isActive", true) AS "isActive",
        ${available.has("showInShop") ? `COALESCE("showInShop", false)` : `NULL::boolean`} AS "showInShop",
        ${available.has("shopCategory") ? `"shopCategory"` : `NULL::text`} AS "shopCategory",
        ${available.has("shopShortDescription") ? `"shopShortDescription"` : `NULL::text`} AS "shopShortDescription",
        ${available.has("shopWarranty") ? `"shopWarranty"` : `NULL::text`} AS "shopWarranty",
        ${available.has("shopSpecs") ? `"shopSpecs"` : `NULL::text`} AS "shopSpecs",
        ${available.has("shopImageUrl") ? `"shopImageUrl"` : `NULL::text`} AS "shopImageUrl",
        ${available.has("shopBrand") ? `"shopBrand"` : `NULL::text`} AS "shopBrand"
      FROM "Product"
      WHERE COALESCE("isActive", true) = true
      ORDER BY "name" ASC
    `);
  } else if (available.has("key") && available.has("sellPrice")) {
    products = await prisma.$queryRawUnsafe<OpsCatalogueProduct[]>(`
      SELECT
        "id",
        COALESCE("key", "id") AS "sku",
        "name",
        COALESCE("unit", 'Accessories') AS "category",
        COALESCE("sellPrice", 0) AS "sellingPrice",
        NULL::text AS "defaultWarranty",
        0 AS "minStockLevel",
        0 AS "stockQuantity",
        COALESCE("active", true) AS "isActive",
        ${available.has("showInShop") ? `COALESCE("showInShop", false)` : `NULL::boolean`} AS "showInShop",
        ${available.has("shopCategory") ? `"shopCategory"` : `NULL::text`} AS "shopCategory",
        ${available.has("shopShortDescription") ? `"shopShortDescription"` : `NULL::text`} AS "shopShortDescription",
        ${available.has("shopWarranty") ? `"shopWarranty"` : `NULL::text`} AS "shopWarranty",
        ${available.has("shopSpecs") ? `"shopSpecs"` : `NULL::text`} AS "shopSpecs",
        ${available.has("shopImageUrl") ? `"shopImageUrl"` : `NULL::text`} AS "shopImageUrl",
        ${available.has("shopBrand") ? `"shopBrand"` : `NULL::text`} AS "shopBrand"
      FROM "Product"
      WHERE COALESCE("active", true) = true
      ORDER BY "name" ASC
    `);
  } else {
    throw new Error(`Unsupported Product table shape for read-only shop sync. Columns: ${Array.from(available).join(", ")}`);
  }

  return products.map(mapOpsProduct).filter((entry): entry is ShopProductMappingPreview => Boolean(entry));
}

export async function getOpsCatalogueProductsReadOnlyMapped() {
  return (await getOpsCatalogueProductsReadOnly())
    .map((entry) => entry.product)
    .filter((entry): entry is ShopProduct => Boolean(entry));
}
