import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import type { AttendantCategory, Role } from "@prisma/client";
import { authOptions } from "@/lib/nextAuth";
import { prisma } from "@/lib/prisma";

// `NextAuthOptions` type may vary between next-auth versions; use a local alias
// to avoid accidental type imports that don't exist in some versions.

// ADMIN_EMAILS: comma-separated list of emails that should be treated as ADMIN
export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "kiokojackson81@gmail.com")
  .split(",")
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

/**
 * Small helper to return the server session in server components/pages.
 */
export async function auth(): Promise<Session | null> {
  // next-auth types can vary between versions; cast to any in this narrow spot
  // to avoid build-time type incompatibilities while preserving runtime behavior.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return await getServerSession(authOptions as any);
}

// Simple auth helper for audit logging (placeholder until we wire real audit/session data)
export function getSession() {
  return {
    id: "default-attendant",
    role: "attendant",
  };
}

type AttendantGuardSuccess = {
  ok: true;
  user: { id: string; role: Role; attendantCategory: AttendantCategory | null };
  role: string | null;
  session: Session;
  impersonated: boolean;
};

type AttendantGuardFailure = {
  ok: false;
  res: NextResponse;
};

const ROLE_LABELS = new Set(["ADMIN", "SUPERVISOR", "ATTENDANT"]);

export async function requireAttendant(req: Request, allowed: string[] = []): Promise<AttendantGuardSuccess | AttendantGuardFailure> {
  const session = await auth();
  if (!session) {
    return { ok: false, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const sessionRole = (session.user as { role?: string } | undefined)?.role ?? null;
  const sessionEmail = (session.user as { email?: string } | undefined)?.email?.toLowerCase() ?? null;
  const sessionUserId = (session.user as { id?: string } | undefined)?.id ?? null;

  let impersonateId: string | null = null;
  try {
    const url = new URL(req.url);
    impersonateId = url.searchParams.get("impersonateId");
  } catch {
    // ignore malformed URLs and proceed without impersonation
  }

  let targetUser = null;
  let impersonated = false;

  if (impersonateId && sessionRole === "ADMIN") {
    targetUser = await prisma.user.findUnique({
      where: { id: impersonateId },
      select: { id: true, role: true, attendantCategory: true },
    });
    impersonated = Boolean(targetUser);
  }

  if (!targetUser) {
    if (sessionUserId) {
      targetUser = await prisma.user.findUnique({
        where: { id: sessionUserId },
        select: { id: true, role: true, attendantCategory: true },
      });
    }
    if (!targetUser && sessionEmail) {
      targetUser = await prisma.user.findUnique({
        where: { email: sessionEmail },
        select: { id: true, role: true, attendantCategory: true },
      });
    }
  }

  if (!targetUser) {
    return { ok: false, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const allowedNormalized = allowed.map((entry) => entry?.toUpperCase().trim()).filter(Boolean);
  const allowedRoles = allowedNormalized.filter((entry) => ROLE_LABELS.has(entry));
  const allowedCategories = allowedNormalized.filter((entry) => !ROLE_LABELS.has(entry));

  const roleAllowed =
    allowedRoles.length === 0 ? true : allowedRoles.includes(sessionRole ?? "") || allowedRoles.includes(targetUser.role);
  const categoryAllowed =
    allowedCategories.length === 0
      ? true
      : Boolean(targetUser.attendantCategory && allowedCategories.includes(targetUser.attendantCategory));

  if (!roleAllowed && !categoryAllowed) {
    return { ok: false, res: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return {
    ok: true,
    user: targetUser,
    role: sessionRole,
    session,
    impersonated,
  };
}
