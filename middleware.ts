import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import type { AttendantCategory } from "@prisma/client";
import getLandingPage from "@/lib/getLandingPage";
import { isCategoryAllowed } from "@/lib/attendants/categoryCompat";

// Use string[] for the permissions list to avoid a TypeScript mismatch when
// the generated Prisma client enum differs from the schema during local
// development. The runtime checks still cast into `AttendantCategory` when
// enforcing permissions.
// Route permissions mapped to the database enum labels. The project may use
// different enum identifiers locally vs in the deployed DB; use a tolerant
// mapping so middleware enforcements remain correct regardless of naming.
const routePermissions: Array<{ prefix: string; categories: string[] }> = [
  // Marketing tracker is owned by direct sales
  { prefix: "/marketing/tracker", categories: ["DIRECT_SALES_OPS", "DIRECT_SALES", "DIRECT_SALES_OPS"] },
  // Support operations dashboard
  { prefix: "/attendant/support", categories: ["SUPPORT_OPS", "SUPPORT"] },
  // Attendant top-level routes for marketplace ops
  { prefix: "/attendant", categories: ["JUMIA_KILIMALL_OPS", "JUMIA_OPERATIONS", "KILIMALL_OPERATIONS", "GENERAL", "BETECH_OPS"] },
];

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const pathname = url.pathname;

  const mask = (s: string | undefined | null, head = 20, tail = 20) => {
    if (!s) return "";
    try {
      const str = String(s);
      if (str.length <= head + tail) return str;
      return `${str.slice(0, head)}...${str.slice(-tail)}`;
    } catch (e) {
      return "";
    }
  };

  if (
    pathname === "/attendant/login" ||
    pathname === "/admin/login" ||
    pathname === "/login" ||
    pathname === "/not-authorized"
  ) {
    return NextResponse.next();
  }

  if (pathname === "/attendant/daily-report" || pathname.startsWith("/attendant/daily-report/")) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  // Not logged in → send to sign-in, but avoid redirect loops by using
  // a short-lived query flag. If we've already redirected once (`_r=1`),
  // allow the request through so the login page can render and show
  // diagnostics instead of causing an infinite redirect loop in the browser.
  if (!token) {
    if (url.searchParams.get("_r") === "1") {
      // already redirected here once — let the request proceed to show login UI
      return NextResponse.next();
    }
    // Preserve the originally requested path (including query) so the
    // login page can pass it through as `callbackUrl` and the app can
    // redirect back to the intended page after successful authentication.
    const originalPathWithQuery = req.nextUrl.pathname + req.nextUrl.search;
    // Wrap the original target in an auth/post-login callback so the
    // post-login handler can server-side redirect to the exact page
    // after the session is established. This avoids races where the
    // middleware or landing-page logic would otherwise send the user
    // to a computed home path.
    // Preserve the original target but avoid wrapping it inside another
    // `/auth/post-login` here — doing so created nested callbackUrls which
    // could be double-decoded and led to redirect-to-self loops. Instead
    // pass the encoded original path directly as `callbackUrl` and let the
    // login/post-login handlers perform any necessary wrapping.
    // Log masked callback info for diagnostics (temporary guard-rail).
    try {
      // eslint-disable-next-line no-console
      console.log(`middleware: redirecting->login callbackUrl=${mask(originalPathWithQuery)} original=${mask(originalPathWithQuery)}`);
    } catch (e) {
      // ignore logging errors
    }
    url.pathname = "/attendant/login";
    url.searchParams.set("_r", "1");
    url.searchParams.set("callbackUrl", originalPathWithQuery);
    return NextResponse.redirect(url);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (token as any)?.role ?? (token as any)?.user?.role;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const category = (token as any)?.attendantCategory ?? (token as any)?.user?.attendantCategory;
  const hasCategory = Boolean(category);
  const alreadyRehydrated = url.searchParams.get("_rehydrated") === "1";

  // Temporary debug logging: record masked email, role and category for
  // requests that hit auth/post-login or attendant routes. These logs are
  // intentionally minimal and mask the email to avoid exposing full PII.
  try {
    const rawEmail = (token as any)?.email ?? (token as any)?.user?.email;
    const maskedEmail = typeof rawEmail === "string" ? rawEmail.replace(/^(.{2}).+(@.+)$/, "$1***$2") : null;
    if (pathname.startsWith("/auth/post-login") || pathname.startsWith("/attendant") || pathname.startsWith("/marketing/tracker")) {
      // eslint-disable-next-line no-console
      console.log(`middleware: path=${pathname} maskedEmail=${maskedEmail} role=${String(role)} category=${String(category)}`);
    }
  } catch (e) {
    // ignore logging errors
  }

  // If the token is missing attendantCategory (stale JWT), bounce through
  // post-login to re-hydrate the category from the database so we can route
  // Support Ops and other roles to the correct dashboard.
  if (
    role !== "ADMIN" &&
    !hasCategory &&
    !alreadyRehydrated &&
    (pathname.startsWith("/attendant") || pathname.startsWith("/marketing/tracker"))
  ) {
    const originalPathWithQuery = req.nextUrl.pathname + req.nextUrl.search + (req.nextUrl.search ? "&" : "?") + "_rehydrated=1";
    try {
      // Log masked info for diagnostics (temporary)
      // eslint-disable-next-line no-console
      console.log(`middleware: rehydrate->post-login callback=${mask(originalPathWithQuery)}`);
    } catch (e) {
      // ignore
    }
    url.pathname = "/auth/post-login";
    url.searchParams.set("callbackUrl", originalPathWithQuery);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (role !== "ADMIN") {
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (role !== "ADMIN" && isCategoryAllowed(category, ["SUPPORT_OPS"])) {
    if (!pathname.startsWith("/attendant/support")) {
      url.pathname = "/attendant/support";
      return NextResponse.redirect(url);
    }
  } else if (
    role !== "ADMIN" &&
    !isCategoryAllowed(category, ["SUPPORT_OPS"]) &&
    pathname.startsWith("/attendant/support")
  ) {
    const destination = getLandingPage(category as any, role as string);
    url.pathname = destination;
    return NextResponse.redirect(url);
  }

  for (const { prefix, categories } of routePermissions) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      if (role === "ADMIN") return NextResponse.next();
      // If we don't yet have a category attached to the token (race condition
      // where the JWT hasn't been enriched with attendantCategory after login),
      // allow the request through. The app's server/client pages will perform
      // a DB-backed lookup and resolve the correct landing page. Only enforce
      // category-based redirects when a category is present and explicitly
      // disallowed for this route.
      if (!category) {
        return NextResponse.next();
      }
      if (!isCategoryAllowed(category, categories)) {
        // Wrong category → send to their home instead of /not-authorized.
        // Avoid redirecting to the same pathname (redirect-to-self) which
        // produces an infinite redirect loop. If `home` equals the current
        // pathname, let the request continue so the page can render and
        // show a helpful message or re-check session on the client.
        const home = getLandingPage(category as any, role as string);
        if (home === pathname) {
          return NextResponse.next();
        }
        url.pathname = home;
        return NextResponse.redirect(url);
      }
      break;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/attendant",
    "/attendant/:path*",
    "/marketing/tracker",
    "/marketing/tracker/:path*",
    "/attendant/support",
    "/attendant/support/:path*",
  ],
};
