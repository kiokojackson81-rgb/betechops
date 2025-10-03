import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type Role = "ADMIN" | "SUPERVISOR" | "ATTENDANT";

export async function requireRole(min: Role | Role[]) {
  const session = await auth();
  const role = (session?.user as unknown as { role?: Role })?.role;
  if (!role) return { ok: false as const, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const allowed = Array.isArray(min) ? min : [min];
  if (!allowed.includes(role)) return { ok: false as const, res: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { ok: true as const, role, session };
}

export function noStoreJson(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function getActorId(): Promise<string | null> {
  try {
    const session = await auth();
    const email = (session?.user as { email?: string } | undefined)?.email?.toLowerCase() || "";
    if (!email) return null;
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    return user?.id || null;
  } catch {
    return null;
  }
}
