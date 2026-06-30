import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getReferralCookieMaxAge, normalizeReferralCode, REFERRAL_COOKIE_NAME } from "@/lib/attribution";
import {
  isBlockedCrawlerUserAgent,
  isFilterLikeCatalogRequest,
  isInternalAllowedAutomationUserAgent,
  isKnownCrawlerUserAgent,
  isLimitedPublicAiCrawlerUserAgent,
  isAllowedPublicAiCrawlerPath,
  shouldApplyNoIndexToPublicRequest,
} from "@/lib/botTrafficPolicy";
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

// Combined middleware:
// - Fast-fail unauthenticated requests to sensitive API routes (support/admin/pos)
// - Avoid post-login rehydration redirect loops for marketing/attendant flows
export function middleware(req: NextRequest) {
  try {
    const pathname = req.nextUrl.pathname || "";
    const params = req.nextUrl.searchParams;
    const host = req.headers.get("host");
    const hostname = normalizeHostnameFromRequest(req);
    const userAgent = req.headers.get("user-agent");
    const referralCode = normalizeReferralCode(params.get("ref"));
    const response = NextResponse.next();
    const onAgentsHost = isAgentsHost(host);
    const onOpsHost = isOpsHost(host);
    const onShopHost = isShopHost(host);
    const isCrawler = isKnownCrawlerUserAgent(userAgent);
    const isInternalAutomation = isInternalAllowedAutomationUserAgent(userAgent);

    if ((onAgentsHost || onOpsHost) && !pathname.startsWith("/api")) {
      applyRobotsHeaders(response, "noindex, nofollow, noarchive, nosnippet");
    }

    if ((onAgentsHost || onOpsHost) && isCrawler && !isInternalAutomation) {
      logBlockedRequest(hostname, pathname, userAgent);
      return new NextResponse("Forbidden", { status: 403 });
    }

    if (onShopHost && isBlockedCrawlerUserAgent(userAgent)) {
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

    if (
      onAgentsHost &&
      pathname.startsWith("/products") &&
      !hasSessionCookie(req)
    ) {
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
      response.cookies.set({
        name: REFERRAL_COOKIE_NAME,
        value: referralCode,
        maxAge: getReferralCookieMaxAge(),
        path: "/",
        sameSite: "lax",
        secure: req.nextUrl.protocol === "https:",
        httpOnly: false,
      });
    }

    // Allow the post-login rehydration endpoint to pass through unchanged
    if (pathname.startsWith("/auth/post-login")) return response;
    if (params.has("_rehydrated")) return response;

    // If the request targets protected API areas, perform a quick cookie check
    if (
      pathname.startsWith("/api/support") ||
      pathname.startsWith("/api/admin") ||
      pathname.startsWith("/api/pos-commissions")
    ) {
      if (!hasSessionCookie(req)) {
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
