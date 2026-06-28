import { getOpsCatalogueProductsReadOnlyMapped } from "@/app/shop/shopProductMapper";
import { getShopProductHref } from "@/app/shop/storefrontPaths";
import type { ShopProduct } from "@/app/shop/shopData";
import { estimateNeedBasedLoad, type AiNeedEstimate, type LoadEstimateQueryType } from "@/lib/aiLoadEstimator";
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
  relevanceScore: number;
  category: string;
};

export type LiveCatalogSearchResponse = {
  query: string;
  source: "live_website_catalog";
  found: boolean;
  queryType: LoadEstimateQueryType;
  resultCount: number;
  products: CatalogSearchResultItem[];
  results: CatalogSearchResultItem[];
  primary: CatalogSearchResultItem | null;
  alternatives: CatalogSearchResultItem[];
  estimate?: AiNeedEstimate;
  needsSizing?: boolean;
};

type RankedCatalogMatch = {
  product: ShopProduct;
  score: number;
  normalizedName: string;
};

const QUERY_TYPE_CATEGORY_PATTERNS = [
  {
    matcher: ["full kit", "solar full kit", "starter solar kit", "small solar kit", "home solar kit", "home backup kit"],
    searchTerms: ["starter solar kit", "solar full kit", "gel solar kit", "lithium solar kit", "home backup kit"],
  },
  {
    matcher: ["solar pump", "pump prices", "water pump"],
    searchTerms: ["solar water pump", "dc solar water pump", "ac solar water pump", "submersible pump", "surface pump"],
  },
  {
    matcher: ["battery prices", "battery price", "solar battery"],
    searchTerms: ["solar battery", "gel battery", "lithium battery"],
  },
  {
    matcher: ["inverter prices", "inverter price", "solar inverter"],
    searchTerms: ["solar inverter", "hybrid inverter"],
  },
  {
    matcher: ["panel prices", "panel price", "solar panels", "solar panel"],
    searchTerms: ["solar panel", "bifacial solar panel", "monocrystalline solar panel"],
  },
];

const PREMIUM_KEYWORDS = ["premium", "heavy duty", "industrial", "commercial", "large", "big", "5kw", "10kw"];

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
    imageExtractedText: product.imageExtractedText || "",
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
    scoreField(query, fields.specs, 1.8) +
    scoreField(query, fields.imageExtractedText, 2.1);

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

  return { product, score, normalizedName: normalizeText(product.name) };
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
      match.product.imageExtractedText || "",
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

function toCatalogItem(product: ShopProduct, score: number, origin: string): CatalogSearchResultItem {
  return {
    productName: product.name,
    price: Number(product.price),
    currency: "KES",
    availability: product.availabilityMessage || product.stockStatus.replace(/_/g, " "),
    stockStatus: product.stockStatus,
    productCategory: compactText([product.category, product.subcategory].filter(Boolean).join(" / ")) || product.category,
    shortDescription: compactText(product.shortDescription || product.fullDescription || ""),
    productUrl: `${origin.replace(/\/+$/, "")}${getShopProductHref(product.slug, product.opsProductId)}`,
    imageUrl: buildAbsoluteUrl(origin, product.image),
    warranty: compactText(product.warranty || product.warrantyNotes || ""),
    deliveryInstallNotes: getDeliveryInstallNotes(product),
    relevanceScore: roundScore(score),
    category: product.category,
  };
}

function isNeedBasedQuery(query: string) {
  const normalized = normalizeText(query);
  return ["bulb", "light", "tv", "fridge", "starlink", "wifi", "router", "phone charging", "freezer", "shop backup", "cctv", "electric fence", "pump", "microwave", "washing machine"].some((needle) =>
    normalized.includes(needle),
  );
}

function getCategoryListTerms(query: string) {
  const normalized = normalizeText(query);
  for (const entry of QUERY_TYPE_CATEGORY_PATTERNS) {
    if (entry.matcher.some((needle) => normalized.includes(needle))) return entry.searchTerms;
  }
  return null;
}

function wantsPremiumOrdering(query: string) {
  const normalized = normalizeText(query);
  return PREMIUM_KEYWORDS.some((needle) => normalized.includes(needle));
}

function logCatalogSearch(query: string, queryType: LoadEstimateQueryType, ranked: RankedCatalogMatch[], estimate?: AiNeedEstimate) {
  console.info("[catalog-search]", {
    query,
    queryType,
    normalizedQuery: normalizeText(query),
    matches: ranked.map((entry) => ({
      name: entry.product.name,
      sku: entry.product.sku || null,
      score: roundScore(entry.score),
      stockStatus: entry.product.stockStatus,
    })),
    estimate: estimate
      ? {
          runningLoadWatts: estimate.runningLoadWatts,
          dailyEnergyWh: estimate.dailyEnergyWh,
          recommendedSearchQuery: estimate.recommendedSearchQuery,
        }
      : null,
  });
}

function buildEmptyResponse(query: string, queryType: LoadEstimateQueryType, estimate?: AiNeedEstimate, needsSizing = false): LiveCatalogSearchResponse {
  return {
    query,
    source: "live_website_catalog",
    found: false,
    queryType,
    resultCount: 0,
    products: [],
    results: [],
    primary: null,
    alternatives: [],
    estimate,
    needsSizing,
  };
}

function rankSingleProduct(products: ShopProduct[], query: string, limit: number) {
  return products
    .map((product) => scoreCatalogProduct(query, product))
    .filter((match) => shouldKeepMatch(query, match))
    .sort((left, right) => right.score - left.score || left.product.name.localeCompare(right.product.name))
    .slice(0, limit);
}

function rankCategoryList(products: ShopProduct[], searchTerms: string[], query: string, limit: number) {
  const premium = wantsPremiumOrdering(query);
  const termQuery = searchTerms.join(" ");
  return products
    .map((product) => scoreCatalogProduct(termQuery, product))
    .filter((match) => match.score >= 1.1)
    .sort((left, right) => {
      if (premium) {
        return right.product.price - left.product.price || right.score - left.score;
      }
      return left.product.price - right.product.price || right.score - left.score;
    })
    .slice(0, limit);
}

export async function searchLiveCatalog(input: {
  query: string;
  origin: string;
  limit?: number;
}): Promise<LiveCatalogSearchResponse> {
  const query = String(input.query || "").trim();
  if (!query) return buildEmptyResponse("", "single_product");

  const products = await getOpsCatalogueProductsReadOnlyMapped();
  const normalizedLimit = Math.min(20, Math.max(1, Number(input.limit || 5)));

  const estimate = isNeedBasedQuery(query) ? estimateNeedBasedLoad(query) : null;
  if (estimate?.needsSizing) {
    return buildEmptyResponse(query, "need_based_recommendation", estimate, true);
  }

  const categoryTerms = getCategoryListTerms(query);
  const queryType: LoadEstimateQueryType = estimate ? "need_based_recommendation" : categoryTerms ? "category_list" : "single_product";
  const effectiveLimit = queryType === "category_list" ? Math.min(8, Math.max(normalizedLimit, 8)) : normalizedLimit;
  const searchQuery = estimate?.recommendedSearchQuery || (categoryTerms ? categoryTerms.join(" ") : query);

  const rankedMatches =
    queryType === "category_list" && categoryTerms
      ? rankCategoryList(products, categoryTerms, query, effectiveLimit)
      : rankSingleProduct(products, searchQuery, effectiveLimit);

  logCatalogSearch(query, queryType, rankedMatches, estimate || undefined);

  const catalogItems = rankedMatches.map(({ product, score }) => toCatalogItem(product, score, input.origin));
  const primary = catalogItems[0] ?? null;
  const alternatives = catalogItems.slice(1, 3);

  return {
    query,
    source: "live_website_catalog",
    found: catalogItems.length > 0,
    queryType,
    resultCount: catalogItems.length,
    products: catalogItems,
    results: catalogItems,
    primary,
    alternatives,
    estimate: estimate || undefined,
    needsSizing: Boolean(estimate?.needsSizing),
  };
}
