import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Single source of truth for route protection
export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const path = url.pathname;

  // Read token if present (JWT created by NextAuth)
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (token as any)?.role ?? (token as any)?.user?.role;

  // Admin routes (allow /admin/login, guard everything else incl. /admin root)
  if (path.startsWith("/admin") && path !== "/admin/login") {
    if (role !== "ADMIN") {
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
  }

  // Attendant routes (allow /attendant/login, guard everything else incl. /attendant root)
  if (path.startsWith("/attendant") && path !== "/attendant/login") {
    if (role !== "ADMIN" && role !== "SUPERVISOR" && role !== "ATTENDANT") {
      url.pathname = "/attendant/login";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Include the ROOT paths so /admin and /attendant are guarded too
  matcher: ["/admin", "/admin/:path*", "/attendant", "/attendant/:path*"],
};
