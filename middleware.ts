import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getReferralCookieMaxAge, normalizeReferralCode, REFERRAL_COOKIE_NAME } from "@/lib/attribution";
import { CUSTOMER_REFERRAL_COOKIE_NAME, CUSTOMER_REFERRAL_COOKIE_TTL_SECONDS } from "@/lib/referralCookies";
import {
  isAllowedSearchCrawlerUserAgent,
  isBlockedCrawlerUserAgent,
  isFilterLikeCatalogRequest,
  isInternalAllowedAutomationUserAgent,
  isKnownCrawlerUserAgent,
  isLimitedPublicAiCrawlerUserAgent,
  isAllowedPublicAiCrawlerPath,
  shouldApplyNoIndexToPublicRequest,
} from "@/lib/botTrafficPolicy";
import {
  assessCatalogTraffic,
  getRequestIp,
  isPublicCatalogueListingPath,
} from "@/lib/catalogTrafficProtection";
import { isAgentsHost, isOpsHost, isShopHost } from "@/lib/runtimeUrls";

function hasSessionCookie(req: NextRequest) {
  const cookieCandidates = [
    "__Secure-next-auth.session-token",
    "__Host-next-auth.session-token",
    "next-auth.session-token",
  ];

  const cookies = req.cookies;
  return cookieCandidates.some((name) => {
    const candidate = cookies.get(name);
    return Boolean(candidate?.value);
  });
}

function applyRobotsHeaders(response: NextResponse, value: string) {
  response.headers.set("X-Robots-Tag", value);
  return response;
}

function normalizeHostnameFromRequest(req: NextRequest) {
  const host = req.headers.get("host") || req.nextUrl.hostname || "";
  return host.split(":")[0].trim().toLowerCase();
}

function logBlockedRequest(hostname: string, pathname: string, userAgent: string | null | undefined) {
  console.info("[bot-blocked]", {
    hostname,
    pathname,
    userAgent: String(userAgent || ""),
  });
}

function logSuspiciousCatalogTraffic(input: {
  hostname: string;
  pathname: string;
  queryParamsCount: number;
  userAgent: string | null | undefined;
  referrer: string | null | undefined;
  ip: string | null;
  score: number;
  action: string;
  reasons?: string[];
}) {
  console.info("[suspicious-catalog-traffic]", {
    hostname: input.hostname,
    pathname: input.pathname,
    queryParamsCount: input.queryParamsCount,
    userAgent: String(input.userAgent || ""),
    referrer: String(input.referrer || ""),
    ip: input.ip,
    score: input.score,
    action: input.action,
    reasons: input.reasons || [],
  });
}

export function middleware(req: NextRequest) {
  try {
    const pathname = req.nextUrl.pathname || "";
    const params = req.nextUrl.searchParams;
    const host = req.headers.get("host");
    const hostname = normalizeHostnameFromRequest(req);
    const userAgent = req.headers.get("user-agent");
    const referrer = req.headers.get("referer");
    const ip = getRequestIp(req.headers);
    const referralCode = normalizeReferralCode(params.get("ref"));
    const response = NextResponse.next();
    const onAgentsHost = isAgentsHost(host);
    const onOpsHost = isOpsHost(host);
    const onShopHost = isShopHost(host);
    const isCrawler = isKnownCrawlerUserAgent(userAgent);
    const isInternalAutomation = isInternalAllowedAutomationUserAgent(userAgent);
    const isSearchBot = isAllowedSearchCrawlerUserAgent(userAgent);
    const hasSession = hasSessionCookie(req);

    if ((onAgentsHost || onOpsHost) && !pathname.startsWith("/api")) {
      applyRobotsHeaders(response, "noindex, nofollow, noarchive, nosnippet");
    }

    if ((onAgentsHost || onOpsHost) && isCrawler && !isInternalAutomation) {
      logBlockedRequest(hostname, pathname, userAgent);
      return new NextResponse("Forbidden", { status: 403 });
    }

    if (onShopHost && isBlockedCrawlerUserAgent(userAgent)) {
      if (isPublicCatalogueListingPath(pathname)) {
        logSuspiciousCatalogTraffic({
          hostname,
          pathname,
          queryParamsCount: params.size,
          userAgent,
          referrer,
          ip,
          score: 99,
          action: "forbid",
          reasons: ["known_bad_bot"],
        });
      }
      logBlockedRequest(hostname, pathname, userAgent);
      return new NextResponse("Forbidden", { status: 403 });
    }

    if (onShopHost && shouldApplyNoIndexToPublicRequest(pathname, params)) {
      applyRobotsHeaders(response, "noindex, follow, noarchive");
    }

    if (
      onShopHost &&
      isLimitedPublicAiCrawlerUserAgent(userAgent) &&
      (!isAllowedPublicAiCrawlerPath(pathname, params) || isFilterLikeCatalogRequest(pathname, params))
    ) {
      logBlockedRequest(hostname, pathname, userAgent);
      return new NextResponse("Forbidden", { status: 403 });
    }

    if (onShopHost && isPublicCatalogueListingPath(pathname)) {
      const catalogAssessment = assessCatalogTraffic({
        pathname,
        searchParams: params,
        userAgent,
        referrer,
        ip,
        hasSessionCookie: hasSession,
        isTrustedAutomation: isSearchBot || isInternalAutomation,
        isKnownBadBot: isBlockedCrawlerUserAgent(userAgent),
      });

      if (catalogAssessment.score > 0 || catalogAssessment.action !== "allow") {
        logSuspiciousCatalogTraffic({
          hostname,
          pathname,
          queryParamsCount: params.size,
          userAgent,
          referrer,
          ip,
          score: catalogAssessment.score,
          action: catalogAssessment.action,
          reasons: catalogAssessment.reasons,
        });
      }

      if (catalogAssessment.action === "forbid") {
        return new NextResponse("Forbidden", { status: 403 });
      }

      if (catalogAssessment.action === "rate_limit") {
        return new NextResponse("Too Many Requests", {
          status: 429,
          headers: {
            "Retry-After": "120",
          },
        });
      }

      if (catalogAssessment.action === "cache") {
        response.headers.set("Cache-Control", "public, max-age=0, s-maxage=120, stale-while-revalidate=600");
        response.headers.set("X-Betech-Catalog-Guard", "medium-risk-cache");
      }
    }

    if (onAgentsHost && pathname.startsWith("/products") && !hasSession) {
      if (isCrawler) {
        logBlockedRequest(hostname, pathname, userAgent);
        return new NextResponse("Forbidden", { status: 403 });
      }

      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      loginUrl.searchParams.set("callbackUrl", `${pathname}${req.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }

    if (referralCode) {
      const isCustomerReferral = /^BRF-[A-Z0-9]+$/i.test(referralCode);
      response.cookies.set({
        name: isCustomerReferral ? CUSTOMER_REFERRAL_COOKIE_NAME : REFERRAL_COOKIE_NAME,
        value: referralCode,
        maxAge: isCustomerReferral ? CUSTOMER_REFERRAL_COOKIE_TTL_SECONDS : getReferralCookieMaxAge(),
        path: "/",
        sameSite: "lax",
        secure: req.nextUrl.protocol === "https:",
        httpOnly: false,
      });
    }

    if (pathname.startsWith("/auth/post-login")) return response;
    if (params.has("_rehydrated")) return response;

    if (
      pathname.startsWith("/api/support") ||
      pathname.startsWith("/api/admin") ||
      pathname.startsWith("/api/pos-commissions")
    ) {
      if (!hasSession) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    return response;
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
    "/api/shop/products/:path*",
    "/api/support/:path*",
    "/api/admin/:path*",
    "/api/pos-commissions/:path*",
    "/marketing/:path*",
    "/attendant/:path*",
    "/auth/post-login",
    "/robots.txt",
  ],
};
