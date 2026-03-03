import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { AttendantCategory } from "@prisma/client";

export type Role = "ADMIN" | "SUPERVISOR" | "ATTENDANT";

export function isBenjaminSupervisorEmail(email: unknown) {
  return String(email ?? "").trim().toLowerCase() === "benjamin@betech.co.ke";
}

export async function requireRole(min: Role | Role[]) {
  const session = await auth();
  const role = (session?.user as unknown as { role?: Role })?.role;
  if (!role) return { ok: false as const, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const allowed = Array.isArray(min) ? min : [min];
  if (!allowed.includes(role)) return { ok: false as const, res: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { ok: true as const, role, session };
}

export async function requireRoleOrBenjamin(min: Role | Role[]) {
  const session = await auth();
  const role = (session?.user as unknown as { role?: Role })?.role;
  const email = (session?.user as { email?: string } | undefined)?.email;
  if (!role) return { ok: false as const, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const allowed = Array.isArray(min) ? min : [min];
  if (!allowed.includes(role) && !isBenjaminSupervisorEmail(email)) {
    return { ok: false as const, res: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true as const, role, session, isBenjamin: isBenjaminSupervisorEmail(email) };
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
    if (email) {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (user?.id) return user.id;
    }

    // Fallback: ensure a system actor exists. Prefer `SYSTEM_USER_EMAIL` when
    // configured, otherwise create/find a local internal system user so that
    // server processes can always write ActionLog entries without using the
    // literal string 'system' which violates the DB foreign key.
    const configured = (process.env.SYSTEM_USER_EMAIL || "").toLowerCase().trim();
    const sysEmail = configured || 'system@betech.internal';

    let sysUser = await prisma.user.findUnique({ where: { email: sysEmail }, select: { id: true } });
    if (!sysUser) {
      try {
        sysUser = await prisma.user.create({
          data: {
            email: sysEmail,
            name: "System",
            role: "ADMIN",
            isActive: true,
            attendantCategory: (process.env.DEFAULT_SYSTEM_CATEGORY as AttendantCategory) ?? "DIRECT_SALES_OPS",
          },
          select: { id: true },
        });
      } catch (createErr) {
        // If creation fails (race or DB restriction), attempt to read again
        sysUser = await prisma.user.findUnique({ where: { email: sysEmail }, select: { id: true } });
      }
    }
    return sysUser?.id || null;
  } catch {
    return null;
  }
}
