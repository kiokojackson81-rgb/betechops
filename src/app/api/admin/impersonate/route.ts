import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  const email = (session?.user as { email?: string } | undefined)?.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ensure caller is an admin
  const admin = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const targetId = String(body?.targetId || "").trim();
  if (!targetId) return NextResponse.json({ error: "targetId required" }, { status: 400 });

  // make sure target user exists
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
  if (!target) return NextResponse.json({ error: "target not found" }, { status: 404 });

  const secret = process.env.NEXTAUTH_SECRET || process.env.SECRET;
  if (!secret) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

  const token = jwt.sign({ t: target.id, a: admin.id }, secret, { expiresIn: "5m" });

  return NextResponse.json({ token });
}
