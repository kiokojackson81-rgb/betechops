import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const path = url.pathname;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET }) as unknown;
  let role: string | undefined = undefined;
  if (token && typeof token === "object") {
    const t = token as Record<string, unknown>;
    if (typeof t.role === "string") role = t.role;
    else if (t.user && typeof t.user === "object" && typeof (t.user as Record<string, unknown>).role === "string") {
      role = (t.user as Record<string, unknown>).role as string;
    }
  }

  // /admin area: admins only (login is public)
  if (path.startsWith("/admin") && path !== "/admin/login") {
    if (role !== "ADMIN") { url.pathname = "/admin/login"; return NextResponse.redirect(url); }
  }

  // /attendant area: attendants & supervisors & admins (login is public)
  if (path.startsWith("/attendant") && path !== "/attendant/login") {
    if (role !== "ADMIN" && role !== "ATTENDANT" && role !== "SUPERVISOR") {
      url.pathname = "/attendant/login"; return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = { matcher: ["/admin", "/admin/:path*", "/attendant", "/attendant/:path*"] };
