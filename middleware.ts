import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import type { AttendantCategory } from "@prisma/client";

// Use string[] for the permissions list to avoid a TypeScript mismatch when
// the generated Prisma client enum differs from the schema during local
// development. The runtime checks still cast into `AttendantCategory` when
// enforcing permissions.
const routePermissions: Array<{ prefix: string; categories: string[] }> = [
  { prefix: "/marketing/tracker", categories: ["DIRECT_SALES_OPS"] },
  { prefix: "/attendant/daily-report", categories: ["MARKETING_OPS"] },
  { prefix: "/support/dashboard", categories: ["SUPPORT_OPS"] },
  { prefix: "/attendant", categories: ["JUMIA_KILIMALL_OPS", "BETECH_OPS"] },
];

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const pathname = url.pathname;

  if (pathname === "/attendant/login" || pathname === "/admin/login" || pathname === "/not-authorized") {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
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
        url.pathname = "/not-authorized";
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
