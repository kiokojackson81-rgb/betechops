import { prisma } from "@/lib/prisma";
import type { ShopProduct, ShopProductVisualType } from "@/app/shop/shopData";

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
};

type ShopCategoryDefinition = {
  slug: string;
  title: string;
  keywords: string[];
  visualType: ShopProductVisualType;
  image: string;
};

const OPS_SHOP_CATEGORY_MAP: ShopCategoryDefinition[] = [
  {
    slug: "solar-panels",
    title: "Solar Panels",
    keywords: ["solar panel", "solar panels", "panel", "panels", "pv"],
    visualType: "panel",
    image: "/agents/product-solar-kit-clean.png",
  },
  {
    slug: "solar-inverters",
    title: "Solar Inverters",
    keywords: ["inverter", "hybrid inverter", "off-grid inverter"],
    visualType: "inverter",
    image: "/agents/product-inverter-clean.png",
  },
  {
    slug: "solar-batteries",
    title: "Solar Batteries",
    keywords: ["battery", "gel battery", "agm battery", "deep cycle"],
    visualType: "battery",
    image: "/agents/product-battery-clean.png",
  },
  {
    slug: "lithium-batteries",
    title: "Lithium Batteries",
    keywords: ["lithium", "lifepo4"],
    visualType: "battery",
    image: "/agents/product-battery-clean.png",
  },
  {
    slug: "solar-full-kits",
    title: "Solar Full Kits",
    keywords: ["kit", "full kit", "solar kit", "system"],
    visualType: "kit",
    image: "/agents/product-solar-kit-clean.png",
  },
  {
    slug: "solar-water-pumps",
    title: "Solar Water Pumps",
    keywords: ["pump", "water pump", "borehole"],
    visualType: "pump",
    image: "/agents/product-water-pump-clean.png",
  },
  {
    slug: "solar-lights",
    title: "Solar Lights",
    keywords: ["light", "lights", "flood light", "street light"],
    visualType: "light",
    image: "/agents/hero-generated-v2.png",
  },
  {
    slug: "accessories",
    title: "Accessories",
    keywords: ["accessory", "accessories", "cable", "connector", "mount", "breaker"],
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

function matchCategoryDefinition(input: string) {
  const haystack = normalizeText(input);
  return (
    OPS_SHOP_CATEGORY_MAP.find((entry) =>
      entry.keywords.some((keyword) => haystack.includes(normalizeText(keyword))),
    ) ?? null
  );
}

function inferCategoryDefinition(product: Pick<OpsCatalogueProduct, "category" | "name" | "sku">) {
  return (
    matchCategoryDefinition(product.category) ??
    matchCategoryDefinition(product.name) ??
    matchCategoryDefinition(product.sku) ?? {
      slug: "accessories",
      title: "Accessories",
      keywords: ["accessories"],
      visualType: "kit" as const,
      image: "/agents/product-accessories-clean.png",
    }
  );
}

function inferBrand(name: string) {
  const hit = KNOWN_BRANDS.find((brand) => normalizeText(name).includes(normalizeText(brand)));
  return hit ?? "Betech Solar";
}

function inferSpecs(product: OpsCatalogueProduct, categoryTitle: string) {
  const normalizedName = product.name.trim();
  const powerMatch = normalizedName.match(/(\d+(?:\.\d+)?)\s*(kw|kva|w|ah|v)/i);

  return compactUnique([
    powerMatch ? `${powerMatch[1]}${powerMatch[2].toUpperCase()} configuration` : null,
    categoryTitle,
    `SKU: ${product.sku}`,
    "Ask Betech Solar for full technical specs and sizing support.",
  ]).slice(0, 4);
}

function inferWarranty(product: OpsCatalogueProduct) {
  return product.defaultWarranty?.trim() || "Warranty support available from Betech Solar.";
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

export function mapOpsProductToShopProduct(product: OpsCatalogueProduct): ShopProduct | null {
  const price = Number(product.sellingPrice);
  if (!Number.isFinite(price) || price < 0) return null;

  const category = inferCategoryDefinition(product);
  const brand = inferBrand(product.name);

  return {
    id: `ops-${product.id}`,
    slug: slugify(product.name || product.sku || product.id),
    name: product.name.trim() || product.sku,
    category: category.title,
    brand,
    price,
    oldPrice: undefined,
    image: category.image,
    visualType: category.visualType,
    specs: inferSpecs(product, category.title),
    warranty: inferWarranty(product),
    stockStatus: inferStockStatus(product),
    tags: inferTags(product, category, brand),
    whatsappMessage: `Hello Betech Solar, I want more details about ${product.name.trim() || product.sku}.`,
    source: "ops",
    opsProductId: product.id,
  };
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
  const columns = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'Product' ORDER BY ordinal_position`,
  );
  const available = new Set(columns.map((entry) => entry.column_name));

  let products: OpsCatalogueProduct[] = [];

  if (available.has("sku")) {
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
        COALESCE("isActive", true) AS "isActive"
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
        COALESCE("active", true) AS "isActive"
      FROM "Product"
      WHERE COALESCE("active", true) = true
      ORDER BY "name" ASC
    `);
  } else {
    throw new Error(`Unsupported Product table shape for read-only shop sync. Columns: ${Array.from(available).join(", ")}`);
  }

  return products
    .map(mapOpsProductToShopProduct)
    .filter((entry): entry is ShopProduct => Boolean(entry));
}
