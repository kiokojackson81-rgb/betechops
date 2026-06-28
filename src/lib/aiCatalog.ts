import { getOpsCatalogueProductsReadOnlyMapped } from "@/app/shop/shopProductMapper";
import { getShopProductHref } from "@/app/shop/storefrontPaths";
import { getProductSimilarityScore } from "@/lib/posProductSimilarity";
import type { ShopProduct } from "@/app/shop/shopData";

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
  relevanceScore: number;
};

type RankedCatalogMatch = {
  product: ShopProduct;
  score: number;
  normalizedName: string;
};

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/([0-9])([a-z])/gi, "$1 $2")
    .replace(/([a-z])([0-9])/gi, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collapseNormalizedText(value: string) {
  return normalizeText(value).replace(/\s+/g, "");
}

function getNormalizedTokens(value: string) {
  return Array.from(new Set(normalizeText(value).split(" ").filter(Boolean)));
}

function buildTokenVariants(token: string) {
  const variants = new Set<string>();
  const normalized = normalizeText(token);
  const collapsed = collapseNormalizedText(token);
  if (normalized) variants.add(normalized);
  if (collapsed) variants.add(collapsed);
  if (normalized.includes(" ")) {
    for (const piece of normalized.split(" ").filter(Boolean)) {
      variants.add(piece);
    }
  }
  return Array.from(variants);
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

function buildSearchHaystacks(product: ShopProduct) {
  return {
    title: product.name,
    shortDescription: product.shortDescription || "",
    longDescription: product.fullDescription || "",
    category: product.category,
    brand: product.brand || "",
    tags: (product.tags || []).join(" "),
    sku: product.sku || "",
    subcategory: product.subcategory || "",
    specs: (product.specs || []).join(" "),
  };
}

function getDeliveryInstallNotes(product: ShopProduct) {
  return compactText(product.checkoutAvailabilityMessage || product.availabilityMessage || "");
}

function countTokenMatches(queryTokens: string[], candidateTokens: string[]) {
  const remaining = [...candidateTokens];
  let matches = 0;

  for (const token of queryTokens) {
    const variants = buildTokenVariants(token);
    const index = remaining.findIndex((candidate) =>
      variants.some((variant) => {
        return (
          candidate === variant ||
          candidate.includes(variant) ||
          variant.includes(candidate) ||
          getProductSimilarityScore(variant, candidate) >= 0.84
        );
      }),
    );

    if (index >= 0) {
      matches += 1;
      remaining.splice(index, 1);
    }
  }

  return matches;
}

function scoreField(query: string, value: string, weight: number) {
  const similarity = getProductSimilarityScore(query, value);
  const normalizedField = normalizeText(value);
  const normalizedQuery = normalizeText(query);
  const collapsedField = collapseNormalizedText(value);
  const collapsedQuery = collapseNormalizedText(query);
  const queryTokens = getNormalizedTokens(query);
  const fieldTokens = getNormalizedTokens(value);
  const tokenCoverage = queryTokens.length ? countTokenMatches(queryTokens, fieldTokens) / queryTokens.length : 0;
  const exactBoost = normalizedField === normalizedQuery ? 1 : 0;
  const containsBoost = normalizedField.includes(normalizedQuery) || collapsedField.includes(collapsedQuery) ? 0.85 : 0;

  return weight * Math.max(similarity, tokenCoverage * 0.92, containsBoost, exactBoost);
}

function scoreCatalogProduct(query: string, product: ShopProduct): RankedCatalogMatch {
  const fields = buildSearchHaystacks(product);
  const normalizedQuery = normalizeText(query);
  const collapsedQuery = collapseNormalizedText(query);
  const queryTokens = getNormalizedTokens(query);

  const fieldScore =
    scoreField(query, fields.title, 5.5) +
    scoreField(query, fields.shortDescription, 2.8) +
    scoreField(query, fields.longDescription, 2.2) +
    scoreField(query, fields.category, 1.5) +
    scoreField(query, fields.subcategory, 1.2) +
    scoreField(query, fields.brand, 1.2) +
    scoreField(query, fields.tags, 1.3) +
    scoreField(query, fields.sku, 1.3) +
    scoreField(query, fields.specs, 1.8);

  const allSearchText = Object.values(fields).join(" ");
  const normalizedAll = normalizeText(allSearchText);
  const collapsedAll = collapseNormalizedText(allSearchText);
  const allTokens = getNormalizedTokens(allSearchText);
  const tokenMatchCount = countTokenMatches(queryTokens, allTokens);
  const coverage = queryTokens.length ? tokenMatchCount / queryTokens.length : 0;

  let score = fieldScore + coverage * 3.5;
  if (normalizedAll.includes(normalizedQuery)) score += 1.8;
  if (collapsedAll.includes(collapsedQuery)) score += 1.6;
  if (normalizeText(product.name).includes(normalizedQuery)) score += 1.5;
  if (collapseNormalizedText(product.name).includes(collapsedQuery)) score += 1.4;
  if (coverage === 1) score += 1.75;

  return {
    product,
    score,
    normalizedName: normalizeText(product.name),
  };
}

function shouldKeepMatch(query: string, match: RankedCatalogMatch) {
  const queryTokens = getNormalizedTokens(query);
  if (!queryTokens.length) return false;

  const fieldTokens = getNormalizedTokens(
    [
      match.product.name,
      match.product.sku || "",
      match.product.shortDescription || "",
      match.product.fullDescription || "",
      match.product.category,
      match.product.subcategory || "",
      match.product.brand,
      ...(match.product.tags || []),
      ...(match.product.specs || []),
    ].join(" "),
  );

  const coverage = countTokenMatches(queryTokens, fieldTokens) / queryTokens.length;
  return match.score >= 1.15 || coverage >= 0.45;
}

function roundScore(score: number) {
  return Number(score.toFixed(4));
}

function logCatalogSearch(query: string, ranked: RankedCatalogMatch[]) {
  console.info("[catalog-search]", {
    query,
    normalizedQuery: normalizeText(query),
    normalizedQueryCollapsed: collapseNormalizedText(query),
    matches: ranked.map((entry) => ({
      name: entry.product.name,
      sku: entry.product.sku || null,
      score: roundScore(entry.score),
      stockStatus: entry.product.stockStatus,
    })),
  });
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

  const limit = Math.min(20, Math.max(1, Number(input.limit || 5)));
  const products = await getOpsCatalogueProductsReadOnlyMapped();
  const rankedMatches = products
    .map((product) => scoreCatalogProduct(query, product))
    .filter((match) => shouldKeepMatch(query, match))
    .sort((left, right) => {
      return (
        right.score - left.score ||
        left.normalizedName.localeCompare(right.normalizedName) ||
        left.product.name.localeCompare(right.product.name)
      );
    })
    .slice(0, limit);

  logCatalogSearch(query, rankedMatches);

  const ranked = rankedMatches
    .map(({ product, score }) => ({
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
      relevanceScore: roundScore(score),
    }));

  return {
    query,
    source: "live_website_catalog" as const,
    resultCount: ranked.length,
    results: ranked,
  };
}
