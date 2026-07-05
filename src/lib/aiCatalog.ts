import { getOpsCatalogueProductsReadOnlyMapped } from "@/app/shop/shopProductMapper";
import { getShopProductHref } from "@/app/shop/storefrontPaths";
import type { ShopProduct } from "@/app/shop/shopData";
import { estimateNeedBasedLoad, type AiNeedEstimate, type LoadEstimateQueryType } from "@/lib/aiLoadEstimator";
import { getProductSimilarityScore } from "@/lib/posProductSimilarity";
import { prisma } from "@/lib/prisma";

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
  recommendedScore?: number;
};

export type CatalogSalesSignals = {
  recentSalesCount: number;
  lastSoldAt: string | null;
  monthlySalesCount: number;
  totalSoldCount: number;
  popularProduct: boolean;
  frequentlyQuoted: boolean;
  recommendedScore: number;
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
  needsMoreInfo: boolean;
  questionsToAsk: string[];
  recommendationReason: string;
  salesSignals: CatalogSalesSignals;
};

type RankedCatalogMatch = {
  product: ShopProduct;
  score: number;
  recommendedScore?: number;
  normalizedName: string;
  coverage: number;
  debug: {
    matchedFields: string[];
    fieldScores: Record<string, number>;
    containsBoosts: string[];
    coverage: number;
    exactTitleMatch: boolean;
    titleContainsQuery: boolean;
    slugContainsQuery: boolean;
    recommendationReason?: string;
    salesSignals?: CatalogSalesSignals;
  };
};

const QUERY_TYPE_CATEGORY_PATTERNS = [
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
const ACCESSORY_KEYWORDS = ["cable", "clamp", "mc4", "breaker", "rail", "lug", "trunking", "conduit", "connector", "clip"];
const KIT_KEYWORDS = ["kit", "full kit", "solar full kit"];
const SYSTEM_KEYWORDS = ["system", "backup", "home solar", "lithium solar", "solar for house", "solar for home", "solar for business"];
const INVERTER_KEYWORDS = ["inverter", "hybrid inverter"];
const BATTERY_KEYWORDS = ["battery", "lithium battery", "gel battery"];
const PANEL_KEYWORDS = ["panel", "solar panel"];
const PUMP_KEYWORDS = ["pump", "borehole"];
const ACCESSORY_SEARCH_KEYWORDS = ["solar cable", "cable", "mc4", "breaker", "clamp", "rail", "lug", "trunking", "conduit", "connector"];

type CatalogQueryIntent = {
  normalized: string;
  wantsKit: boolean;
  wantsSystem: boolean;
  wantsInverter: boolean;
  wantsBattery: boolean;
  wantsPanel: boolean;
  wantsPump: boolean;
  wantsAccessories: boolean;
  wantsHomeSolar: boolean;
  sizeToken: string | null;
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
  return `${origin.replace(/\/+$/, "")}/${normalized.replace(/^\/+/, "")}`;
}

function buildSearchHaystacks(product: ShopProduct) {
  return {
    title: product.name,
    slug: product.slug,
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

function normalizedCategory(product: ShopProduct) {
  return normalizeText([product.category, product.subcategory || ""].join(" "));
}

function isAccessoryProduct(product: ShopProduct) {
  if (isFullKitProduct(product)) return false;
  const haystack = normalizeText(
    [
      product.name,
      product.slug,
      product.category,
      product.subcategory || "",
      product.brand || "",
      ...(product.tags || []),
      ...(product.specs || []),
    ].join(" "),
  );
  return ACCESSORY_KEYWORDS.some((needle) => haystack.includes(needle));
}

function isFullKitProduct(product: ShopProduct) {
  const category = normalizedCategory(product);
  const haystack = normalizeText(
    [
      product.name,
      product.slug,
      product.category,
      product.subcategory || "",
      ...(product.tags || []),
    ].join(" "),
  );
  return category.includes("solar full kits") || KIT_KEYWORDS.some((needle) => haystack.includes(needle));
}

function looksLikeSpecificKitQuery(query: string) {
  const normalized = normalizeText(query);
  const tokens = getNormalizedTokens(query);
  const hasKit = KIT_KEYWORDS.some((needle) => normalized.includes(needle));
  const hasWattage = /\b\d+\s*w\b/.test(normalized) || /\b\d+w\b/.test(collapseNormalizedText(query));
  const hasBrandOrSpecificity = tokens.length >= 3;
  return hasKit && hasWattage && hasBrandOrSpecificity;
}

function wantsKitResults(query: string) {
  const normalized = normalizeText(query);
  return KIT_KEYWORDS.some((needle) => normalized.includes(needle));
}

function wantsAccessoryResults(query: string) {
  const normalized = normalizeText(query);
  return ACCESSORY_SEARCH_KEYWORDS.some((needle) => normalized.includes(needle));
}

function parseSizeToken(query: string) {
  const normalized = normalizeText(query);
  const match = normalized.match(/\b(\d+(?:\.\d+)?)\s*(kw|kva|w)\b/i);
  if (!match) return null;
  return `${match[1]}${match[2].toUpperCase()}`;
}

function getQueryIntent(query: string): CatalogQueryIntent {
  const normalized = normalizeText(query);
  const wantsAccessories = wantsAccessoryResults(query);
  const wantsKit = wantsKitResults(query) || normalized.includes("lithium solar");
  const wantsSystem = wantsKit || SYSTEM_KEYWORDS.some((needle) => normalized.includes(needle)) || /\b\d+(?:\.\d+)?\s*(kw|kva)\b/i.test(normalized);
  return {
    normalized,
    wantsKit,
    wantsSystem,
    wantsInverter: !wantsAccessories && INVERTER_KEYWORDS.some((needle) => normalized.includes(needle)),
    wantsBattery: !wantsAccessories && BATTERY_KEYWORDS.some((needle) => normalized.includes(needle)),
    wantsPanel: !wantsAccessories && PANEL_KEYWORDS.some((needle) => normalized.includes(needle)),
    wantsPump: !wantsAccessories && PUMP_KEYWORDS.some((needle) => normalized.includes(needle)),
    wantsAccessories,
    wantsHomeSolar: normalized.includes("home solar") || normalized.includes("for home") || normalized.includes("for house") || normalized.includes("bedroom"),
    sizeToken: parseSizeToken(query),
  };
}

function isInverterProduct(product: ShopProduct) {
  return normalizedCategory(product).includes("inverter");
}

function isBatteryProduct(product: ShopProduct) {
  const category = normalizedCategory(product);
  return category.includes("battery") || category.includes("lithium");
}

function isPanelProduct(product: ShopProduct) {
  return normalizedCategory(product).includes("panel");
}

function isPumpProduct(product: ShopProduct) {
  return normalizedCategory(product).includes("pump");
}

function isSystemIntent(query: string) {
  const intent = getQueryIntent(query);
  return intent.wantsSystem || intent.wantsHomeSolar;
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
  const intent = getQueryIntent(query);

  const fieldScores = {
    title: scoreField(query, fields.title, 5.5),
    slug: scoreField(query, fields.slug, 4.4),
    shortDescription: scoreField(query, fields.shortDescription, 2.8),
    longDescription: scoreField(query, fields.longDescription, 2.2),
    category: scoreField(query, fields.category, 1.5),
    subcategory: scoreField(query, fields.subcategory, 1.2),
    brand: scoreField(query, fields.brand, 1.2),
    tags: scoreField(query, fields.tags, 1.3),
    sku: scoreField(query, fields.sku, 1.3),
    specs: scoreField(query, fields.specs, 1.8),
    imageExtractedText: scoreField(query, fields.imageExtractedText, 2.1),
  };
  const fieldScore = Object.values(fieldScores).reduce((sum, value) => sum + value, 0);

  const allSearchText = Object.values(fields).join(" ");
  const normalizedAll = normalizeText(allSearchText);
  const collapsedAll = collapseNormalizedText(allSearchText);
  const allTokens = getNormalizedTokens(allSearchText);
  const tokenMatchCount = countTokenMatches(queryTokens, allTokens);
  const coverage = queryTokens.length ? tokenMatchCount / queryTokens.length : 0;
  const containsBoosts: string[] = [];

  let score = fieldScore + coverage * 3.5;
  if (normalizedAll.includes(normalizedQuery)) {
    score += 1.8;
    containsBoosts.push("all_text_contains_query");
  }
  if (collapsedAll.includes(collapsedQuery)) {
    score += 1.6;
    containsBoosts.push("collapsed_text_contains_query");
  }
  if (normalizeText(product.name).includes(normalizedQuery)) {
    score += 1.5;
    containsBoosts.push("title_contains_query");
  }
  if (collapseNormalizedText(product.name).includes(collapsedQuery)) {
    score += 1.4;
    containsBoosts.push("collapsed_title_contains_query");
  }
  if (normalizeText(product.slug).includes(normalizedQuery)) {
    score += 1.35;
    containsBoosts.push("slug_contains_query");
  }
  if (collapseNormalizedText(product.slug).includes(collapsedQuery)) {
    score += 1.2;
    containsBoosts.push("collapsed_slug_contains_query");
  }
  if (coverage === 1) {
    score += 1.75;
    containsBoosts.push("full_token_coverage");
  }
  if (normalizeText(product.name) === normalizedQuery) {
    score += 7;
    containsBoosts.push("exact_title_match");
  }
  if (normalizeText(product.slug) === normalizedQuery || collapseNormalizedText(product.slug) === collapsedQuery) {
    score += 6.5;
    containsBoosts.push("exact_slug_match");
  }
  if (normalizeText(product.sku || "") === normalizedQuery || collapseNormalizedText(product.sku || "") === collapsedQuery) {
    score += 6;
    containsBoosts.push("exact_sku_match");
  }
  if ((intent.wantsKit || intent.wantsSystem || intent.wantsHomeSolar) && isFullKitProduct(product)) {
    score += 3.75;
    containsBoosts.push("full_kit_category_boost");
  }
  if ((intent.wantsKit || intent.wantsSystem || intent.wantsHomeSolar || intent.wantsInverter || intent.wantsBattery || intent.wantsPanel || intent.wantsPump) && !intent.wantsAccessories && isAccessoryProduct(product)) {
    score -= 7.5;
    containsBoosts.push("accessory_penalty_for_non_accessory_query");
  }
  if (intent.wantsInverter && isInverterProduct(product)) {
    score += 4.25;
    containsBoosts.push("inverter_intent_boost");
  }
  if (intent.wantsInverter && !isInverterProduct(product) && !isAccessoryProduct(product)) {
    score -= 2.75;
    containsBoosts.push("non_inverter_penalty");
  }
  if (intent.wantsBattery && isBatteryProduct(product)) {
    score += 4;
    containsBoosts.push("battery_intent_boost");
  }
  if (intent.wantsPanel && isPanelProduct(product)) {
    score += 4;
    containsBoosts.push("panel_intent_boost");
  }
  if (intent.wantsPump && isPumpProduct(product)) {
    score += 4;
    containsBoosts.push("pump_intent_boost");
  }
  if (intent.wantsAccessories && isAccessoryProduct(product)) {
    score += 8;
    containsBoosts.push("accessory_intent_boost");
  }
  if (intent.wantsAccessories && !isAccessoryProduct(product)) {
    score -= 10;
    containsBoosts.push("non_accessory_penalty");
  }
  if (intent.sizeToken) {
    const normalizedSize = normalizeText(intent.sizeToken);
    if (normalizeText(product.name).includes(normalizedSize) || normalizeText(product.slug).includes(normalizedSize)) {
      score += 3.2;
      containsBoosts.push("size_token_match");
    }
  }

  const matchedFields = Object.entries(fieldScores)
    .filter(([, value]) => value > 0.25)
    .sort((left, right) => right[1] - left[1])
    .map(([field, value]) => `${field}:${roundScore(value)}`);

  return {
    product,
    score,
    normalizedName: normalizeText(product.name),
    coverage,
    debug: {
      matchedFields,
      fieldScores: Object.fromEntries(
        Object.entries(fieldScores).map(([field, value]) => [field, roundScore(value)]),
      ),
      containsBoosts,
      coverage: roundScore(coverage),
      exactTitleMatch: normalizeText(product.name) === normalizedQuery,
      titleContainsQuery: normalizeText(product.name).includes(normalizedQuery),
      slugContainsQuery: normalizeText(product.slug).includes(normalizedQuery),
    },
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
  return [
    "bulb",
    "light",
    "tv",
    "fridge",
    "starlink",
    "wifi",
    "router",
    "phone charging",
    "freezer",
    "shop backup",
    "cctv",
    "electric fence",
    "pump",
    "microwave",
    "washing machine",
    "iron",
    "bedroom",
    "house",
    "for my home",
    "for home",
    "for business",
    "i need solar",
    "want solar",
  ].some((needle) => normalized.includes(needle));
}

function getCategoryListTerms(query: string) {
  const normalized = normalizeText(query);
  const intent = getQueryIntent(query);
  if (looksLikeSpecificKitQuery(query)) return null;
  if (intent.wantsAccessories) {
    return ["solar cable", "pv cable", "battery cable", "mc4 connector", "solar breaker"];
  }
  if (intent.wantsInverter && intent.sizeToken) {
    return [`${intent.sizeToken} hybrid inverter`, `${intent.sizeToken} inverter`];
  }
  if (intent.wantsBattery && intent.sizeToken) {
    return [`${intent.sizeToken} lithium battery`, `${intent.sizeToken} battery`];
  }
  if (intent.wantsPanel && intent.sizeToken) {
    return [`${intent.sizeToken} solar panel`, `${intent.sizeToken} panel`];
  }
  if ((intent.wantsSystem || intent.wantsKit) && intent.sizeToken) {
    return [
      `${intent.sizeToken} lithium solar kit`,
      `${intent.sizeToken} solar full kit`,
      `${intent.sizeToken} hybrid inverter`,
    ];
  }
  if (intent.wantsInverter) {
    return ["hybrid inverter", "solar inverter"];
  }
  if (intent.wantsBattery) {
    return ["lithium battery", "gel battery", "solar battery"];
  }
  if (intent.wantsPanel) {
    return ["solar panel", "monocrystalline solar panel", "bifacial solar panel"];
  }
  if (intent.wantsPump) {
    return ["solar water pump", "dc solar water pump", "submersible pump"];
  }
  if (KIT_KEYWORDS.some((needle) => normalized.includes(needle))) {
    return ["starter solar kit", "solar full kit", "gel solar kit", "lithium solar kit", "home backup kit"];
  }
  for (const entry of QUERY_TYPE_CATEGORY_PATTERNS) {
    if (entry.matcher.some((needle) => normalized.includes(needle))) return entry.searchTerms;
  }
  return null;
}

function wantsPremiumOrdering(query: string) {
  const normalized = normalizeText(query);
  return PREMIUM_KEYWORDS.some((needle) => normalized.includes(needle));
}

function toSearchableProductDebug(product: ShopProduct) {
  return {
    title: product.name,
    slug: product.slug,
    price: Number(product.price),
    availability: product.availabilityMessage || product.stockStatus,
    brand: product.brand || "",
    category: product.category,
    sku: product.sku || "",
    tags: product.tags || [],
    shortDescription: compactText(product.shortDescription || ""),
    longDescription: compactText(product.fullDescription || ""),
    imageExtractedText: compactText(product.imageExtractedText || ""),
  };
}

function emptySalesSignals(): CatalogSalesSignals {
  return {
    recentSalesCount: 0,
    lastSoldAt: null,
    monthlySalesCount: 0,
    totalSoldCount: 0,
    popularProduct: false,
    frequentlyQuoted: false,
    recommendedScore: 0,
  };
}

function mergeSalePoint(
  current: CatalogSalesSignals,
  quantity: number,
  soldAt: Date | string | null | undefined,
  now: Date,
) {
  const next = { ...current };
  const when = soldAt ? new Date(soldAt) : null;
  const qty = Math.max(1, Number(quantity || 0));
  next.totalSoldCount += qty;
  if (when && !Number.isNaN(when.getTime())) {
    const daysAgo = (now.getTime() - when.getTime()) / (1000 * 60 * 60 * 24);
    if (daysAgo <= 30) next.monthlySalesCount += qty;
    if (daysAgo <= 14) next.recentSalesCount += qty;
    if (!next.lastSoldAt || when.getTime() > new Date(next.lastSoldAt).getTime()) {
      next.lastSoldAt = when.toISOString();
    }
  }
  return next;
}

async function getSalesSignalsForProducts(products: ShopProduct[]) {
  const signalMap = new Map<string, CatalogSalesSignals>();
  const candidateProducts = products.filter((product) => product.opsProductId);
  for (const product of candidateProducts) {
    signalMap.set(product.id, emptySalesSignals());
  }
  if (!candidateProducts.length) return signalMap;

  const productIds = candidateProducts.map((product) => product.opsProductId!).filter(Boolean);
  const productNames = candidateProducts.map((product) => product.name);
  const now = new Date();

  try {
    const [posItems, webItems, marketingItems, supportItems] = await Promise.all([
      prisma.orderItem.findMany({
        where: { productId: { in: productIds } },
        select: {
          productId: true,
          quantity: true,
          order: { select: { createdAt: true } },
        },
      }),
      prisma.websiteOrderItem.findMany({
        where: {
          OR: [
            { productId: { in: productIds } },
            { productName: { in: productNames } },
          ],
        },
        select: {
          productId: true,
          productName: true,
          quantity: true,
          websiteOrder: { select: { createdAt: true } },
        },
      }),
      prisma.marketingReceiptItem.findMany({
        where: { productName: { in: productNames } },
        select: { productName: true, createdAt: true },
      }),
      prisma.supportReceiptItem.findMany({
        where: { productName: { in: productNames } },
        select: { productName: true, createdAt: true },
      }),
    ]);

    const byProductId = new Map(candidateProducts.map((product) => [product.opsProductId!, product]));
    const byProductName = new Map(candidateProducts.map((product) => [product.name, product]));

    for (const item of posItems) {
      const product = byProductId.get(item.productId);
      if (!product) continue;
      signalMap.set(product.id, mergeSalePoint(signalMap.get(product.id) || emptySalesSignals(), item.quantity, item.order.createdAt, now));
    }

    for (const item of webItems) {
      const product = (item.productId ? byProductId.get(item.productId) : null) || byProductName.get(item.productName);
      if (!product) continue;
      signalMap.set(product.id, mergeSalePoint(signalMap.get(product.id) || emptySalesSignals(), item.quantity, item.websiteOrder.createdAt, now));
    }

    for (const item of marketingItems) {
      const product = byProductName.get(item.productName);
      if (!product) continue;
      signalMap.set(product.id, mergeSalePoint(signalMap.get(product.id) || emptySalesSignals(), 1, item.createdAt, now));
    }

    for (const item of supportItems) {
      const product = byProductName.get(item.productName);
      if (!product) continue;
      signalMap.set(product.id, mergeSalePoint(signalMap.get(product.id) || emptySalesSignals(), 1, item.createdAt, now));
    }

    for (const [productId, signal] of signalMap.entries()) {
      signalMap.set(productId, {
        ...signal,
        popularProduct: signal.monthlySalesCount >= 3 || signal.totalSoldCount >= 6,
        frequentlyQuoted: signal.monthlySalesCount >= 2 || signal.totalSoldCount >= 4,
      });
    }
  } catch (error) {
    console.error("[catalog-search.sales-signals_failed]", error);
  }

  return signalMap;
}

function withRecommendedScore(
  match: RankedCatalogMatch,
  query: string,
  salesSignal: CatalogSalesSignals,
  estimate?: AiNeedEstimate | null,
) {
  const intent = getQueryIntent(query);
  let recommendedScore = match.score;
  const boosts: string[] = [];

  if (match.product.stockStatus === "in_stock") {
    recommendedScore += 2.2;
    boosts.push("availability_in_stock");
  } else if (match.product.stockStatus === "limited_stock") {
    recommendedScore += 1.1;
    boosts.push("availability_limited_stock");
  } else if (match.product.stockStatus === "quote_only" && !intent.wantsSystem) {
    recommendedScore -= 0.8;
    boosts.push("quote_only_penalty");
  }

  if ((intent.wantsSystem || intent.wantsKit) && isFullKitProduct(match.product)) {
    recommendedScore += 2.8;
    boosts.push("system_over_accessory");
  }
  if ((intent.wantsSystem || intent.wantsKit) && isInverterProduct(match.product) && !isFullKitProduct(match.product)) {
    recommendedScore -= 0.9;
    boosts.push("inverter_after_kit_penalty");
  }

  recommendedScore += Math.min(4, salesSignal.recentSalesCount * 0.55);
  recommendedScore += Math.min(3, salesSignal.monthlySalesCount * 0.35);
  recommendedScore += Math.min(2.5, salesSignal.totalSoldCount * 0.15);
  if (salesSignal.popularProduct) {
    recommendedScore += 1.25;
    boosts.push("popular_product");
  }
  if (estimate?.recommendedSystemSize) {
    const sizeNeedle = normalizeText(estimate.recommendedSystemSize);
    const productSizingText = normalizeText(
      [match.product.name, match.product.slug, ...(match.product.specs || [])].join(" "),
    );
    if (productSizingText.includes(sizeNeedle)) {
      recommendedScore += 4.5;
      boosts.push("estimated_system_size_match");
    } else if (isFullKitProduct(match.product)) {
      recommendedScore -= 1.25;
      boosts.push("estimated_system_size_mismatch");
    }
  }

  return {
    ...match,
    recommendedScore,
    debug: {
      ...match.debug,
      containsBoosts: [...match.debug.containsBoosts, ...boosts],
      salesSignals: {
        ...salesSignal,
        recommendedScore: roundScore(recommendedScore),
      },
    },
  };
}

function buildRecommendationReason(
  query: string,
  queryType: LoadEstimateQueryType,
  match: RankedCatalogMatch | null,
  estimate?: AiNeedEstimate | null,
) {
  if (!match) return "No suitable live catalog product matched this request yet.";
  const signal = match.debug.salesSignals || emptySalesSignals();
  const reasons: string[] = [];
  const intent = getQueryIntent(query);

  if (queryType === "need_based_recommendation" && estimate?.recommendedSystemSize) {
    reasons.push(`best fit for the estimated ${estimate.recommendedSystemSize} solar requirement`);
  }
  if (match.debug.exactTitleMatch || match.debug.slugContainsQuery) {
    reasons.push("closest exact catalog match");
  }
  if ((intent.wantsSystem || intent.wantsKit) && isFullKitProduct(match.product)) {
    reasons.push("complete system ranked above accessories");
  }
  if (signal.recentSalesCount > 0) {
    reasons.push(`recently sold ${signal.recentSalesCount} time${signal.recentSalesCount === 1 ? "" : "s"}`);
  } else if (signal.monthlySalesCount > 0) {
    reasons.push("commonly sold in recent orders");
  }
  if (match.product.stockStatus === "in_stock") {
    reasons.push("currently available at shop");
  }

  return reasons.length ? reasons.join(", ") : "strongest available live catalog match for this query";
}

function buildSearchableIndexHits(products: ShopProduct[], query: string) {
  const normalizedQuery = normalizeText(query);
  const collapsedQuery = collapseNormalizedText(query);
  return products.filter((product) => {
    const title = normalizeText(product.name);
    const slug = normalizeText(product.slug);
    const description = normalizeText(
      [
        product.shortDescription || "",
        product.fullDescription || "",
        product.sku || "",
        product.imageExtractedText || "",
      ].join(" "),
    );
    return (
      title.includes(normalizedQuery) ||
      slug.includes(normalizedQuery) ||
      description.includes(normalizedQuery) ||
      collapseNormalizedText(product.name).includes(collapsedQuery) ||
      collapseNormalizedText(product.slug).includes(collapsedQuery)
    );
  });
}

function logCatalogSearch(
  query: string,
  queryType: LoadEstimateQueryType,
  products: ShopProduct[],
  ranked: RankedCatalogMatch[],
  rejected: RankedCatalogMatch[],
  estimate?: AiNeedEstimate,
) {
  const indexedHits = buildSearchableIndexHits(products, query);
  console.info("[catalog-search]", {
    query,
    originalQuery: query,
    queryType,
    normalizedQuery: normalizeText(query),
    indexedProductCount: products.length,
    indexedHitCount: indexedHits.length,
    indexedHits: indexedHits.slice(0, 10).map(toSearchableProductDebug),
    candidateCount: products.length,
    keptCandidateCount: ranked.length,
    rejectedCandidateCount: rejected.length,
    topMatches: ranked.slice(0, 10).map((entry) => ({
      name: entry.product.name,
      slug: entry.product.slug,
      sku: entry.product.sku || null,
      score: roundScore(entry.score),
      recommendedScore: roundScore(entry.recommendedScore ?? entry.score),
      stockStatus: entry.product.stockStatus,
      whyMatched: entry.debug.matchedFields,
      containsBoosts: entry.debug.containsBoosts,
      coverage: entry.debug.coverage,
      exactTitleMatch: entry.debug.exactTitleMatch,
      titleContainsQuery: entry.debug.titleContainsQuery,
      slugContainsQuery: entry.debug.slugContainsQuery,
      recommendationReason: entry.debug.recommendationReason || null,
      recentSalesCount: entry.debug.salesSignals?.recentSalesCount ?? 0,
      totalSoldCount: entry.debug.salesSignals?.totalSoldCount ?? 0,
      searchable: toSearchableProductDebug(entry.product),
    })),
    topRejected: rejected.slice(0, 10).map((entry) => ({
      name: entry.product.name,
      slug: entry.product.slug,
      sku: entry.product.sku || null,
      score: roundScore(entry.score),
      stockStatus: entry.product.stockStatus,
      whyRejected:
        entry.score < 1.15 && entry.coverage < 0.45
          ? "score_below_threshold_and_low_token_coverage"
          : entry.score < 1.15
            ? "score_below_threshold"
            : "token_coverage_below_threshold",
      whyMatched: entry.debug.matchedFields,
      containsBoosts: entry.debug.containsBoosts,
      coverage: entry.debug.coverage,
    })),
    estimate: estimate
      ? {
          runningLoadWatts: estimate.runningLoadWatts,
          dailyEnergyWh: estimate.dailyEnergyWh,
          dailyEnergyKWh: estimate.dailyEnergyKWh,
          recommendedSearchQuery: estimate.recommendedSearchQuery,
          recommendedSystemSize: estimate.recommendedSystemSize,
          recommendedBatteryKWh: estimate.recommendedBatteryKWh,
          recommendedPanelWatts: estimate.recommendedPanelWatts,
          needsMoreInfo: estimate.needsMoreInfo,
          questionsToAsk: estimate.questionsToAsk,
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
    needsMoreInfo: Boolean(estimate?.needsMoreInfo || needsSizing),
    questionsToAsk: estimate?.questionsToAsk || [],
    recommendationReason: estimate?.needsMoreInfo
      ? "More sizing information is required before recommending a live catalog system."
      : "No matching live catalog products were found yet.",
    salesSignals: emptySalesSignals(),
  };
}

function rankSingleProduct(products: ShopProduct[], query: string, limit: number) {
  const scored = products.map((product) => scoreCatalogProduct(query, product));
  return {
    ranked: scored
      .filter((match) => shouldKeepMatch(query, match))
      .sort((left, right) => right.score - left.score || left.product.name.localeCompare(right.product.name))
      .slice(0, limit),
    rejected: scored
      .filter((match) => !shouldKeepMatch(query, match))
      .sort((left, right) => right.score - left.score || left.product.name.localeCompare(right.product.name)),
  };
}

function rankCategoryList(products: ShopProduct[], searchTerms: string[], query: string, limit: number) {
  const premium = wantsPremiumOrdering(query);
  const termQuery = searchTerms.join(" ");
  const scored = products.map((product) => scoreCatalogProduct(termQuery, product));
  return {
    ranked: scored
      .filter((match) => match.score >= 1.1)
      .sort((left, right) => {
        if (premium) {
          return right.score - left.score || right.product.price - left.product.price;
        }
        return right.score - left.score || left.product.price - right.product.price;
      })
      .slice(0, limit),
    rejected: scored
      .filter((match) => match.score < 1.1)
      .sort((left, right) => right.score - left.score || left.product.name.localeCompare(right.product.name)),
  };
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
  if (estimate?.needsMoreInfo && !estimate.recommendedSearchQuery) {
    return buildEmptyResponse(query, "need_based_recommendation", estimate, false);
  }

  const categoryTerms = getCategoryListTerms(query);
  const normalizedQuery = normalizeText(query);
  const queryType: LoadEstimateQueryType = estimate
    ? "need_based_recommendation"
    : categoryTerms
      ? "category_list"
      : ["solar", "system", "power"].includes(normalizedQuery)
        ? "unclear"
        : "single_product";
  const effectiveLimit = queryType === "category_list" ? Math.min(8, Math.max(normalizedLimit, 8)) : normalizedLimit;
  const searchQuery = estimate?.recommendedSearchQuery || (categoryTerms ? categoryTerms.join(" ") : query);

  const ranking =
    queryType === "category_list" && categoryTerms
      ? rankCategoryList(products, categoryTerms, query, effectiveLimit)
      : rankSingleProduct(products, searchQuery, effectiveLimit);
  const candidatePool = ranking.ranked.slice(0, Math.max(effectiveLimit, 12));
  const salesSignals = await getSalesSignalsForProducts(candidatePool.map((entry) => entry.product));
  const rankedMatches = candidatePool
    .map((entry) => withRecommendedScore(entry, query, salesSignals.get(entry.product.id) || emptySalesSignals(), estimate || undefined))
    .sort((left, right) => (right.recommendedScore ?? right.score) - (left.recommendedScore ?? left.score) || right.score - left.score)
    .slice(0, effectiveLimit)
    .map((entry) => ({
      ...entry,
      debug: {
        ...entry.debug,
        recommendationReason: buildRecommendationReason(query, queryType, entry, estimate || undefined),
      },
    }));
  const rejectedMatches = ranking.rejected;

  logCatalogSearch(query, queryType, products, rankedMatches, rejectedMatches, estimate || undefined);

  const catalogItems = rankedMatches.map(({ product, score, recommendedScore }) => ({
    ...toCatalogItem(product, score, input.origin),
    recommendedScore: roundScore(recommendedScore ?? score),
  }));
  const primary = catalogItems[0] ?? null;
  const alternatives = catalogItems.slice(1, 3);
  const primaryMatch = rankedMatches[0] ?? null;
  const primarySignals = primaryMatch?.debug.salesSignals || emptySalesSignals();
  const recommendationReason = primaryMatch?.debug.recommendationReason || buildRecommendationReason(query, queryType, null, estimate || undefined);

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
    needsMoreInfo: Boolean(estimate?.needsMoreInfo),
    questionsToAsk: estimate?.questionsToAsk || [],
    recommendationReason,
    salesSignals: primary
      ? {
          ...primarySignals,
          recommendedScore: roundScore(primary.recommendedScore ?? primarySignals.recommendedScore),
        }
      : emptySalesSignals(),
  };
}
