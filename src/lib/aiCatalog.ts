import { getOpsCatalogueProductsReadOnlyMapped } from "@/app/shop/shopProductMapper";
import { getShopProductHref } from "@/app/shop/storefrontPaths";
import { getProductSimilarityScore } from "@/lib/posProductSimilarity";

export type CatalogSearchResultItem = {
  productName: string;
  price: number;
  currency: "KES";
  availability: string;
  stockStatus: "in_stock" | "limited_stock" | "preorder" | "quote_only";
  productCategory: string;
  shortDescription: string | null;
  productUrl: string;
  imageUrl: string | null;
  warranty: string | null;
  deliveryInstallNotes: string | null;
};

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function compactText(value: string | null | undefined) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized || null;
}

function buildAbsoluteUrl(origin: string, pathOrUrl: string | null | undefined) {
  const normalized = String(pathOrUrl || "").trim();
  if (!normalized) return null;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (!origin) return normalized;
  return `${origin.replace(/\/+$/, "")}/${normalized.replace(/^\/+/, "")}`;
}

function buildSearchHaystacks(product: Awaited<ReturnType<typeof getOpsCatalogueProductsReadOnlyMapped>>[number]) {
  return [
    product.name,
    product.category,
    product.subcategory || "",
    product.brand || "",
    product.shortDescription || "",
    product.fullDescription || "",
    ...(product.specs || []),
    ...(product.tags || []),
  ];
}

function getDeliveryInstallNotes(product: Awaited<ReturnType<typeof getOpsCatalogueProductsReadOnlyMapped>>[number]) {
  return compactText(product.checkoutAvailabilityMessage || product.availabilityMessage || "");
}

function scoreCatalogProduct(query: string, product: Awaited<ReturnType<typeof getOpsCatalogueProductsReadOnlyMapped>>[number]) {
  const normalizedQuery = normalizeText(query);
  const haystacks = buildSearchHaystacks(product);
  const combined = normalizeText(haystacks.join(" "));
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);

  let score = getProductSimilarityScore(query, product.name);
  score += getProductSimilarityScore(query, product.category) * 0.5;
  score += getProductSimilarityScore(query, product.brand || "") * 0.25;

  if (combined.includes(normalizedQuery)) score += 200;
  if (normalizeText(product.name).includes(normalizedQuery)) score += 300;

  for (const token of tokens) {
    if (normalizeText(product.name).includes(token)) score += 80;
    if (combined.includes(token)) score += 20;
  }

  return score;
}

export async function searchLiveCatalog(input: {
  query: string;
  origin: string;
  limit?: number;
}) {
  const query = String(input.query || "").trim();
  if (!query) {
    return {
      query: "",
      source: "live_website_catalog" as const,
      resultCount: 0,
      results: [] as CatalogSearchResultItem[],
    };
  }

  const limit = Math.min(20, Math.max(1, Number(input.limit || 8)));
  const products = await getOpsCatalogueProductsReadOnlyMapped();
  const ranked = products
    .map((product) => ({
      product,
      score: scoreCatalogProduct(query, product),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => {
      return (
        right.score - left.score ||
        right.product.price - left.product.price ||
        left.product.name.localeCompare(right.product.name)
      );
    })
    .slice(0, limit)
    .map(({ product }) => ({
      productName: product.name,
      price: Number(product.price),
      currency: "KES" as const,
      availability: product.availabilityMessage || product.stockStatus.replace(/_/g, " "),
      stockStatus: product.stockStatus,
      productCategory: compactText([product.category, product.subcategory].filter(Boolean).join(" / ")) || product.category,
      shortDescription: compactText(product.shortDescription || product.fullDescription || ""),
      productUrl: `${input.origin.replace(/\/+$/, "")}${getShopProductHref(product.slug, product.opsProductId)}`,
      imageUrl: buildAbsoluteUrl(input.origin, product.image),
      warranty: compactText(product.warranty || product.warrantyNotes || ""),
      deliveryInstallNotes: getDeliveryInstallNotes(product),
    }));

  return {
    query,
    source: "live_website_catalog" as const,
    resultCount: ranked.length,
    results: ranked,
  };
}
