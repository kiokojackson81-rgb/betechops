const CATALOG_FILTER_KEYS = new Set([
  "brand",
  "category",
  "sub",
  "subCategory",
  "subcategory",
  "price",
  "minPrice",
  "maxPrice",
  "stock",
  "warranty",
  "sort",
]);

const REQUEST_WINDOW_MS = 60_000;
const COMBO_WINDOW_MS = 5 * 60_000;
const requestWindowByIp = new Map<string, number[]>();
const comboWindowByIp = new Map<string, Array<{ at: number; combo: string }>>();

export type CatalogTrafficAssessment = {
  score: number;
  action: "allow" | "cache" | "rate_limit" | "forbid";
  reasons: string[];
  filterParamCount: number;
  totalQueryParamCount: number;
  requestCountInWindow: number;
  uniqueFilterCombosInWindow: number;
};

function pruneOldTimestamps(values: number[], now: number, windowMs: number) {
  return values.filter((value) => now - value <= windowMs);
}

function pruneOldCombos(values: Array<{ at: number; combo: string }>, now: number, windowMs: number) {
  return values.filter((value) => now - value.at <= windowMs);
}

function extractChromeMajorVersion(userAgent: string | null | undefined) {
  const normalized = String(userAgent || "");
  const match = normalized.match(/Chrome\/(\d+)/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function isInternalReferrer(referrer: string | null | undefined) {
  const raw = String(referrer || "").trim();
  if (!raw) return false;
  try {
    const url = new URL(raw);
    const hostname = url.hostname.toLowerCase();
    return hostname === "betech.co.ke" || hostname === "www.betech.co.ke";
  } catch {
    return false;
  }
}

function countCatalogFilterParams(searchParams: URLSearchParams) {
  let count = 0;
  for (const [key, value] of searchParams.entries()) {
    if (!CATALOG_FILTER_KEYS.has(key)) continue;
    if (!String(value || "").trim()) continue;
    count += 1;
  }
  return count;
}

function buildFilterComboSignature(pathname: string, searchParams: URLSearchParams) {
  const entries = Array.from(searchParams.entries())
    .filter(([key, value]) => CATALOG_FILTER_KEYS.has(key) && String(value || "").trim())
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      `${leftKey}=${leftValue}`.localeCompare(`${rightKey}=${rightValue}`),
    )
    .map(([key, value]) => `${key}=${value}`);
  return `${pathname}?${entries.join("&")}`;
}

export function isPublicCatalogueListingPath(pathname: string) {
  return pathname === "/all-products" || pathname === "/products" || pathname.startsWith("/category/");
}

export function isPublicCatalogueSafePath(pathname: string) {
  if (pathname === "/") return true;
  if (pathname === "/request-quote") return true;
  if (pathname === "/cart") return true;
  if (pathname === "/checkout") return true;
  if (pathname === "/feedback") return true;
  if (pathname === "/contact") return true;
  if (pathname.startsWith("/products/")) return true;
  return false;
}

export function getRequestIp(headers: Headers) {
  const candidates = [
    headers.get("x-forwarded-for"),
    headers.get("x-real-ip"),
    headers.get("cf-connecting-ip"),
    headers.get("x-vercel-forwarded-for"),
  ];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (!value) continue;
    const first = value.split(",")[0]?.trim();
    if (first) return first;
  }

  return null;
}

export function assessCatalogTraffic(input: {
  pathname: string;
  searchParams: URLSearchParams;
  userAgent: string | null | undefined;
  referrer: string | null | undefined;
  ip: string | null;
  hasSessionCookie: boolean;
  isTrustedAutomation: boolean;
  isKnownBadBot: boolean;
}) : CatalogTrafficAssessment {
  if (input.isKnownBadBot) {
    return {
      score: 99,
      action: "forbid",
      reasons: ["known_bad_bot"],
      filterParamCount: countCatalogFilterParams(input.searchParams),
      totalQueryParamCount: input.searchParams.size,
      requestCountInWindow: 0,
      uniqueFilterCombosInWindow: 0,
    };
  }

  if (input.hasSessionCookie || input.isTrustedAutomation || isInternalReferrer(input.referrer)) {
    return {
      score: 0,
      action: "allow",
      reasons: [],
      filterParamCount: countCatalogFilterParams(input.searchParams),
      totalQueryParamCount: input.searchParams.size,
      requestCountInWindow: 0,
      uniqueFilterCombosInWindow: 0,
    };
  }

  const now = Date.now();
  const reasons: string[] = [];
  const filterParamCount = countCatalogFilterParams(input.searchParams);
  const totalQueryParamCount = input.searchParams.size;
  const hasFilterParams = filterParamCount > 0;
  let score = 0;

  if (hasFilterParams) {
    score += 1;
    reasons.push("filtered_catalog_listing");
  }

  if (filterParamCount >= 2) {
    score += 2;
    reasons.push("multiple_filter_params");
  }

  if (filterParamCount >= 4) {
    score += 1;
    reasons.push("heavy_filter_params");
  }

  if (input.searchParams.has("_rsc") && hasFilterParams) {
    score += 3;
    reasons.push("rsc_filtered_request");
  }

  if (!String(input.referrer || "").trim()) {
    score += 1;
    reasons.push("missing_referrer");
  }

  const chromeMajorVersion = extractChromeMajorVersion(input.userAgent);
  if (chromeMajorVersion !== null && chromeMajorVersion < 110) {
    score += 2;
    reasons.push("very_old_chrome_signature");
  }

  let requestCountInWindow = 0;
  let uniqueFilterCombosInWindow = 0;
  if (input.ip) {
    const requestHistory = pruneOldTimestamps(requestWindowByIp.get(input.ip) || [], now, REQUEST_WINDOW_MS);
    requestHistory.push(now);
    requestWindowByIp.set(input.ip, requestHistory);
    requestCountInWindow = requestHistory.length;

    if (requestCountInWindow >= 12) {
      score += 2;
      reasons.push("high_request_rate");
    }

    if (requestCountInWindow >= 20) {
      score += 2;
      reasons.push("very_high_request_rate");
    }

    const comboHistory = pruneOldCombos(comboWindowByIp.get(input.ip) || [], now, COMBO_WINDOW_MS);
    if (hasFilterParams) {
      comboHistory.push({
        at: now,
        combo: buildFilterComboSignature(input.pathname, input.searchParams),
      });
    }
    comboWindowByIp.set(input.ip, comboHistory);
    uniqueFilterCombosInWindow = new Set(comboHistory.map((item) => item.combo)).size;

    if (uniqueFilterCombosInWindow >= 6) {
      score += 2;
      reasons.push("many_filter_combinations");
    }

    if (uniqueFilterCombosInWindow >= 10) {
      score += 2;
      reasons.push("excessive_filter_combinations");
    }
  }

  const action =
    score >= 7
      ? "rate_limit"
      : score >= 4
        ? "cache"
        : "allow";

  return {
    score,
    action,
    reasons,
    filterParamCount,
    totalQueryParamCount,
    requestCountInWindow,
    uniqueFilterCombosInWindow,
  };
}
