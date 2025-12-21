import { NextResponse } from "next/server";
import * as jwt from "jsonwebtoken";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const session = await auth();
  const email = (session?.user as { email?: string } | undefined)?.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // verify admin identity from db
  const admin = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const secret = process.env.NEXTAUTH_SECRET || process.env.SECRET;
  if (!secret) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

  try {
    const payload = (jwt as any).verify(token, secret) as any;
    // payload.a is admin id, payload.t is target id
    if (!payload || payload.a !== admin.id) return NextResponse.json({ error: "Invalid token" }, { status: 403 });

    // set short-lived httpOnly cookie and redirect to attendant dashboard
    const res = NextResponse.redirect(new URL("/attendant", req.url));
    // cookie expires in 5 minutes
    res.cookies.set({ name: "impersonation", value: token, httpOnly: true, path: "/", secure: process.env.NODE_ENV === "production", maxAge: 60 * 5, sameSite: "lax" });
    return res;
  } catch (err) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 403 });
  }
}
