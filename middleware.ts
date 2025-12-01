import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import type { AttendantCategory } from "@prisma/client";
import getLandingPage from "@/lib/getLandingPage";

// Use string[] for the permissions list to avoid a TypeScript mismatch when
// the generated Prisma client enum differs from the schema during local
// development. The runtime checks still cast into `AttendantCategory` when
// enforcing permissions.
// Route permissions mapped to the database enum labels. The project may use
// different enum identifiers locally vs in the deployed DB; use a tolerant
// mapping so middleware enforcements remain correct regardless of naming.
const routePermissions: Array<{ prefix: string; categories: string[] }> = [
  // Marketing tracker is owned by direct sales
  { prefix: "/marketing/tracker", categories: ["DIRECT_SALES", "DIRECT_SALES_OPS"] },
  // Daily report is used by product upload / marketing staff
  { prefix: "/attendant/daily-report", categories: ["PRODUCT_UPLOAD", "MARKETING_OPS"] },
  // Support dashboard
  { prefix: "/support/dashboard", categories: ["SUPPORT", "SUPPORT_OPS"] },
  // Attendant top-level routes for marketplace ops
  { prefix: "/attendant", categories: ["JUMIA_OPERATIONS", "KILIMALL_OPERATIONS", "GENERAL", "BETECH_OPS", "JUMIA_KILIMALL_OPS"] },
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

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  // Not logged in → send to sign-in
  if (!token) {
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (token as any)?.role ?? (token as any)?.user?.role;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const category = (token as any)?.attendantCategory ?? (token as any)?.user?.attendantCategory;

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (role !== "ADMIN") {
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  for (const { prefix, categories } of routePermissions) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      if (role === "ADMIN") return NextResponse.next();
      if (!category || !categories.includes(category as AttendantCategory)) {
        // Wrong category → send to their home instead of /not-authorized
        const home = getLandingPage(category as any, role as string);
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
    "/support/dashboard",
    "/support/dashboard/:path*",
  ],
};
