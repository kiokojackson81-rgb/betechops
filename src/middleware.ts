import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Lightweight middleware to block unauthenticated access to support APIs.
// This checks for the common next-auth session cookie names and returns
// 401 when missing. Routes still perform full auth server-side using
// `requireAttendant`; this middleware provides an early, fast-fail layer.

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only apply guard to support API endpoints
  if (!pathname.startsWith("/api/support")) return NextResponse.next();

  // Common cookie names used by next-auth depending on environment
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

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/support/:path*",
    "/api/admin/:path*",
    "/api/pos-commissions/:path*",
  ],
};
// Disabled duplicate middleware. Root-level middleware.ts is the single source of truth.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Lightweight middleware guard to avoid redirect cycles involving the
// `/auth/post-login` rehydration flow. The deployed environment previously
// produced repeated middleware->post-login->target redirects when the
// attendant session lacked `attendantCategory`.
export function middleware(req: NextRequest) {
  try {
    const url = req.nextUrl.clone();
    const pathname = url.pathname || "";
    const params = url.searchParams;

    // If the request is already targeting the post-login handler, do not
    // process or wrap it again.
    if (pathname.startsWith("/auth/post-login")) {
      return NextResponse.next();
    }

    // If the request already carries the rehydration marker, skip any
    // middleware rewrap/redirect behavior to avoid loops.
    if (params.has("_rehydrated")) {
      return NextResponse.next();
    }

    // Default: pass through. We intentionally do not attempt to rehydrate or
    // inspect auth state here to keep the middleware lightweight and avoid
    // mismatched runtime constraints in edge environments. The primary goal
    // is to avoid creating redirect cycles — actual auth decisions are still
    // handled by the app routes and post-login logic.
    return NextResponse.next();
  } catch (e) {
    return NextResponse.next();
  }
}

// Apply middleware to the attendant and marketing routes where rehydration
// was previously observed. Keep matcher minimal to avoid affecting unrelated
// paths.
export const config = { matcher: ["/marketing/:path*", "/attendant/:path*", "/auth/post-login"] };
