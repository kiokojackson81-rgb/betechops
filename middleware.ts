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
    url.pathname = "/attendant/login";
    url.searchParams.set("_r", "1");
    url.searchParams.set("callbackUrl", originalPathWithQuery);
    return NextResponse.redirect(url);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (token as any)?.role ?? (token as any)?.user?.role;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const category = (token as any)?.attendantCategory ?? (token as any)?.user?.attendantCategory;

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
      if (!category || !isCategoryAllowed(category, categories)) {
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
