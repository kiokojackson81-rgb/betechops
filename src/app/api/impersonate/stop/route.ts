import { NextResponse } from "next/server";
export async function GET() {
  const res = NextResponse.redirect(new URL("/admin", "http://localhost"));
  res.cookies.set({ name: "impersonation", value: "", httpOnly: true, path: "/", maxAge: 0, sameSite: "lax" });
  return res;
}
