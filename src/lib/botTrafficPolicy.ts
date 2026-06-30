const BLOCKED_CRAWLER_SIGNATURES = [
  "amazonbot",
  "semrushbot",
  "mj12bot",
  "ahrefsbot",
  "dotbot",
  "bytespider",
  "petalbot",
  "ccbot",
  "yandexbot",
  "blexbot",
  "dataforseobot",
  "seekportbot",
  "megaindex",
  "zoominfobot",
  "turnitinbot",
] as const;

const ALLOWED_SEARCH_BOT_SIGNATURES = [
  "googlebot",
  "google-inspectiontool",
  "bingbot",
  "googleother",
  "adsbot-google",
  "mediapartners-google",
] as const;

const INTERNAL_ALLOWED_SIGNATURES = [
  "at-voice-api",
  "africastalking",
  "vercel",
  "uptime",
  "statuscake",
  "pingdom",
  "chatrace",
  "facebookexternalhit",
  "whatsapp",
  "slackbot",
  "linkedinbot",
  "twitterbot",
  "discordbot",
  "skypeuripreview",
] as const;

const LIMITED_AI_CRAWLER_SIGNATURES = [
  "gptbot",
  "meta-externalagent",
  "facebookexternalhit",
] as const;

const PRODUCT_DETAIL_STATIC_PREFIXES = ["/shop/product/"] as const;

const ROOT_LEVEL_EXCLUDED_SEGMENTS = new Set([
  "account",
  "admin",
  "agents",
  "all-products",
  "api",
  "attendant",
  "cart",
  "category",
  "checkout",
  "login",
  "marketing",
  "products",
  "register",
  "request-quote",
  "shop",
  "support",
]);

function normalizeUserAgentValue(userAgent: string | null | undefined) {
  return String(userAgent || "").trim().toLowerCase();
}

export function isKnownCrawlerUserAgent(userAgent: string | null | undefined) {
  const normalized = normalizeUserAgentValue(userAgent);
  if (!normalized) return false;
  return normalized.includes("bot") || normalized.includes("crawl") || normalized.includes("spider") || normalized.includes("preview");
}

export function isBlockedCrawlerUserAgent(userAgent: string | null | undefined) {
  const normalized = normalizeUserAgentValue(userAgent);
  if (!normalized) return false;
  return BLOCKED_CRAWLER_SIGNATURES.some((signature) => normalized.includes(signature));
}

export function isAllowedSearchCrawlerUserAgent(userAgent: string | null | undefined) {
  const normalized = normalizeUserAgentValue(userAgent);
  if (!normalized) return false;
  return ALLOWED_SEARCH_BOT_SIGNATURES.some((signature) => normalized.includes(signature));
}

export function isInternalAllowedAutomationUserAgent(userAgent: string | null | undefined) {
  const normalized = normalizeUserAgentValue(userAgent);
  if (!normalized) return false;
  return INTERNAL_ALLOWED_SIGNATURES.some((signature) => normalized.includes(signature));
}

export function isLimitedPublicAiCrawlerUserAgent(userAgent: string | null | undefined) {
  const normalized = normalizeUserAgentValue(userAgent);
  if (!normalized) return false;
  return LIMITED_AI_CRAWLER_SIGNATURES.some((signature) => normalized.includes(signature));
}

export function isFilterLikeCatalogRequest(pathname: string, searchParams: URLSearchParams) {
  if (searchParams.size <= 0) return false;
  if (pathname === "/products" || pathname === "/all-products") return true;
  if (pathname.startsWith("/category/")) return true;
  return false;
}

export function isCatalogListingPath(pathname: string) {
  return pathname === "/products" || pathname === "/all-products" || pathname.startsWith("/category/");
}

export function isAllowedPublicAiCrawlerPath(pathname: string, searchParams: URLSearchParams) {
  if (searchParams.size > 0) return false;
  if (pathname === "/") return true;
  if (PRODUCT_DETAIL_STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length !== 1) return false;
  const [segment] = segments;
  return !ROOT_LEVEL_EXCLUDED_SEGMENTS.has(segment.toLowerCase());
}

export function shouldApplyNoIndexToPublicRequest(pathname: string, searchParams: URLSearchParams) {
  return isFilterLikeCatalogRequest(pathname, searchParams);
}
