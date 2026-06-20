import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getReferralCookieMaxAge, normalizeReferralCode, REFERRAL_COOKIE_NAME } from "@/lib/attribution";

// Combined middleware:
// - Fast-fail unauthenticated requests to sensitive API routes (support/admin/pos)
// - Avoid post-login rehydration redirect loops for marketing/attendant flows
export function middleware(req: NextRequest) {
  try {
    const pathname = req.nextUrl.pathname || "";
    const params = req.nextUrl.searchParams;
    const referralCode = normalizeReferralCode(params.get("ref"));
    const response = NextResponse.next();

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
      const cookieCandidates = [
        "__Secure-next-auth.session-token",
        "__Host-next-auth.session-token",
        "next-auth.session-token",
      ];

      const cookies = req.cookies;
      let tokenFound = false;
      for (const name of cookieCandidates) {
        const c = cookies.get(name);
        if (c && c.value) {
          tokenFound = true;
          break;
        }
      }

      if (!tokenFound) {
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
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
    "/api/support/:path*",
    "/api/admin/:path*",
    "/api/pos-commissions/:path*",
    "/marketing/:path*",
    "/attendant/:path*",
    "/auth/post-login",
  ],
};
