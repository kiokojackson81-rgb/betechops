import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const ADMIN_EMAIL_HARDCODE = "kiokojackson81@gmail.com"; // hotfix

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const path = url.pathname;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let role = (token as any)?.role ?? (token as any)?.user?.role;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const email = ((token as any)?.email || "").toLowerCase();

  // 🔥 Hotfix: force admin if email matches
  if (email === ADMIN_EMAIL_HARDCODE.toLowerCase()) role = "ADMIN";

  // Admin area
  if (path.startsWith("/admin") && path !== "/admin/login") {
    if (role !== "ADMIN") { url.pathname = "/admin/login"; return NextResponse.redirect(url); }
  }

  // Attendant area
  if (path.startsWith("/attendant") && path !== "/attendant/login") {
    if (role !== "ADMIN" && role !== "SUPERVISOR" && role !== "ATTENDANT") {
      url.pathname = "/attendant/login"; return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/attendant/:path*"] };
