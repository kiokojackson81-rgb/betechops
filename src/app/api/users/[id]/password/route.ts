import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const pathname = new URL(request.url).pathname;
  const id = pathname.substring(pathname.lastIndexOf("/") + 1);
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { password?: string };
  const newPassword = body.password || "";
  if (!newPassword || newPassword.length < 6) return NextResponse.json({ error: "password_too_short" }, { status: 400 });

  try {
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id }, data: { password: hashed } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "update_failed", detail: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
