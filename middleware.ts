import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Protect /admin and /attendant routes
export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const path = url.pathname;

  // Read token if present (JWT created by NextAuth)
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const role = (token as any)?.role ?? (token as any)?.user?.role;

  // Admin routes (except /admin/login) require ADMIN
  if (path.startsWith("/admin") && !path.startsWith("/admin/login")) {
    if (role !== "ADMIN") {
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
  }

  // Attendant routes (except /attendant/login) require ATTENDANT or ADMIN
  if (path.startsWith("/attendant") && !path.startsWith("/attendant/login")) {
    if (role !== "ADMIN" && role !== "ATTENDANT") {
      url.pathname = "/attendant/login";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/attendant/:path*"],
};
