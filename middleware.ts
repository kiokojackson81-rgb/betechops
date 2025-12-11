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
  const rehydrateCookie = req.cookies.get("_rehydrate_attempt")?.value === "1";

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
  // If the token is missing attendantCategory (stale JWT), attempt a
  // single re-hydration via `/auth/post-login`. Set a short-lived cookie
  // so that if the re-hydration doesn't attach a category we can avoid
  // looping and instead send users to a helpful troubleshooting page.
  if (
    role !== "ADMIN" &&
    !hasCategory &&
    !alreadyRehydrated &&
    !rehydrateCookie &&
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
    const res = NextResponse.redirect(url);
    // Mark that we've attempted rehydration so subsequent requests won't
    // immediately re-trigger the same redirect and cause loops. Short TTL.
    try {
      res.cookies.set("_rehydrate_attempt", "1", {
        httpOnly: true,
        maxAge: 60,
        path: "/",
      });
    } catch (e) {
      // ignore cookie errors
    }
    return res;
  }

  // If we've already tried rehydration (either via the `_rehydrated` query
  // param or the `_rehydrate_attempt` cookie) and the token still lacks a
  // category, avoid redirecting back to post-login and instead route the
  // user to a helpful troubleshooting page where they can contact admin.
  if (
    role !== "ADMIN" &&
    !hasCategory &&
    (alreadyRehydrated || rehydrateCookie) &&
    (pathname.startsWith("/attendant") || pathname.startsWith("/marketing/tracker"))
  ) {
    url.pathname = "/attendant/no-category";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (role !== "ADMIN") {
      import { NextResponse } from 'next/server';
      import type { NextRequest } from 'next/server';
      import { getToken } from 'next-auth/jwt';

      const AUTH_IGNORES = ['/api/auth', '/auth', '/_next', '/favicon.ico', '/assets', '/images', '/static'];
      const ROLE_HOME: Record<string, string> = { ADMIN: '/admin', ATTENDANT: '/attendant/dashboard' };

      export async function middleware(req: NextRequest) {
        const url = req.nextUrl.clone();
        const { pathname, searchParams } = url;

        if (AUTH_IGNORES.some((p) => pathname.startsWith(p))) return NextResponse.next();

        const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
        const isProtected = !pathname.startsWith('/public');
        if (isProtected && !token) {
          const redirectTo = req.nextUrl.clone();
          redirectTo.pathname = '/auth/login';
          redirectTo.searchParams.set('callbackUrl', pathname + (req.nextUrl.search || ''));
          return NextResponse.redirect(redirectTo);
        }

        // loop breaker: once rehydrated (query or cookie), never redirect to post-login again
        const alreadyRehydrated =
          searchParams.get('_rehydrated') === '1' || req.cookies.get('postlogin_done')?.value === '1';

        if (pathname === '/auth/post-login') {
          const target = req.nextUrl.clone();
          const role = (token as any)?.role as string | undefined;
          target.pathname = role && ROLE_HOME[role] ? ROLE_HOME[role] : '/';
          const res = NextResponse.redirect(target);
          res.cookies.set('postlogin_done', '1', {
            maxAge: 60,
            httpOnly: false,
            sameSite: 'lax',
            path: '/',
            secure: process.env.NODE_ENV === 'production',
          });
          return res;
        }

        // admin-only page guard: don't “rehydrate” attendants—route them home instead
        if (token && pathname.startsWith('/marketing/tracker')) {
          const role = (token as any)?.role;
          if (role === 'ATTENDANT') {
            const redirectTo = req.nextUrl.clone();
            redirectTo.pathname = ROLE_HOME.ATTENDANT;
            return NextResponse.redirect(redirectTo);
          }
        }

        // IMPORTANT: Do NOT rehydrate based on missing attendantCategory in middleware.
        // Handle category inside the page/app, not at the edge.

        return NextResponse.next();
      }

      export const config = { matcher: ['/((?!.*\\.).*)'] };
    "/attendant/:path*",
