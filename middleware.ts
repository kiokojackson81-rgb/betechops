// Lightweight middleware guard to avoid redirect cycles involving the
// `/auth/post-login` rehydration flow. Keep this middleware minimal and
// conservative so it doesn't introduce runtime mismatches in edge builds.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
    // If this is an API request, mark responses as no-store to prevent
    // build-time or CDN caching of JSON payloads that must be runtime-accurate.
    if (pathname.startsWith("/api/")) {
      const res = NextResponse.next();
      res.headers.set("Cache-Control", "no-store");
      return res;
    }

    return NextResponse.next();
  } catch (e) {
    return NextResponse.next();
  }
}

// Apply middleware to the attendant and marketing routes where rehydration
// was previously observed. Keep matcher minimal to avoid affecting unrelated
// paths.
export const config = { matcher: ["/api/:path*", "/marketing/:path*", "/attendant/:path*", "/auth/post-login"] };
