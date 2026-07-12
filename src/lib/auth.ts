import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { getToken } from "next-auth/jwt";
import type { Session } from "next-auth";
import type { Role } from "@prisma/client";
import { isCategoryAllowed, normalizeCategory } from "@/lib/attendants/categoryCompat";
import { authOptions } from "@/lib/nextAuth";
import { getKenyanPhoneVariants, normalizeKenyanPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

// `NextAuthOptions` type may vary between next-auth versions; use a local alias
// to avoid accidental type imports that don't exist in some versions.

// ADMIN_EMAILS: comma-separated list of emails that should be treated as ADMIN
export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "kiokojackson81@gmail.com")
  .split(",")
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

async function resolveAgentProfileForSession(args: {
  userId?: string | null;
  phone?: string | null;
  email?: string | null;
}) {
  const normalizedPhone = normalizeKenyanPhone(args.phone || "");
  const phoneVariants = normalizedPhone ? getKenyanPhoneVariants(normalizedPhone) : [];
  const normalizedEmail = String(args.email || "").trim().toLowerCase();

  return prisma.agentProfile.findFirst({
    where: {
      OR: [
        ...(args.userId ? [{ userId: args.userId }] : []),
        ...(phoneVariants.length ? [{ phone: { in: phoneVariants } }] : []),
        ...(normalizedPhone ? [{ user: { phone: normalizedPhone } }] : []),
        ...(normalizedEmail
          ? [
              { email: { equals: normalizedEmail, mode: "insensitive" as const } },
              { user: { email: { equals: normalizedEmail, mode: "insensitive" as const } } },
            ]
          : []),
      ],
    },
    select: {
      id: true,
      status: true,
    },
  });
}

/**
 * Small helper to return the server session in server components/pages.
 */
export async function auth(): Promise<Session | null> {
  // next-auth types can vary between versions; cast to any in this narrow spot
  // to avoid build-time type incompatibilities while preserving runtime behavior.
  // Wrap in try/catch because in unit tests the Next request context may be
  // unavailable which causes `getServerSession` to throw. In that case return
  // null so callers can handle unauthenticated flows in tests.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = (await getServerSession(authOptions as any)) as Session | null;
    if (session) return session;
  } catch (err) {
    console.error("[auth] getServerSession failed", err);
  }

  try {
    const { headers } = await import("next/headers");
    const headerStore = await headers();
    const token = await getToken({
      req: {
        headers: {
          cookie: headerStore.get("cookie") ?? "",
          host: headerStore.get("host") ?? "",
          "x-forwarded-proto": headerStore.get("x-forwarded-proto") ?? "https",
        },
      } as unknown as NextRequest,
      secret: authOptions.secret,
      secureCookie: process.env.NODE_ENV === "production",
    });

    if (!token?.sub && !token?.email) return null;

    const existing = await prisma.user.findFirst({
      where: token.sub ? { id: token.sub } : { email: String(token.email).toLowerCase() },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        attendantCategory: true,
        isActive: true,
        lastLoginMethod: true,
        agentProfile: { select: { id: true, status: true } },
      },
    });

    if (!existing || !existing.isActive) return null;

    const resolvedAgent = await resolveAgentProfileForSession({
      userId: existing.id,
      phone: existing.phone ?? null,
      email: existing.email ?? null,
    });

    const fallbackSession = {
      user: {
        id: existing.id,
        name: existing.name,
        email: existing.email,
        phone: existing.phone,
        role: existing.role,
        attendantCategory: existing.attendantCategory,
        isActive: existing.isActive,
        isAgent: Boolean(resolvedAgent ?? existing.agentProfile),
        agentStatus: resolvedAgent?.status ?? existing.agentProfile?.status ?? null,
        lastLoginMethod: existing.lastLoginMethod ?? null,
      },
      expires:
        typeof token.exp === "number"
          ? new Date(token.exp * 1000).toISOString()
          : new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    } as Session;

    return fallbackSession;
  } catch (err) {
    console.error("[auth] JWT fallback failed", err);
  }

  return null;
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
  // attendantCategory is read via raw SQL and may be an arbitrary string
  // (e.g. 'junior') during the migration transition, so accept string|null here.
  user: { id: string; role: Role; attendantCategory: string | null };
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

  let targetUser: { id: string; role: Role; attendantCategory: string | null; isActive: boolean } | null = null;
  let impersonated = false;

  async function fetchUserByIdOrEmail(opts: { id?: string; email?: string }) {
    // Use a raw SQL query that casts the enum to text to avoid Prisma trying
    // to parse enum labels that don't match the Prisma schema. Return null if
    // no user found.
    try {
      if (opts.id) {
        const rows = await prisma.$queryRaw`
          SELECT id, role, "attendantCategory"::text AS "attendantCategory", "isActive"
          FROM "User"
          WHERE id = ${opts.id}
          LIMIT 1
        ` as Array<{ id: string; role: Role; attendantCategory: string | null; isActive: boolean }>;
        return rows[0] ?? null;
      }
      if (opts.email) {
        const rows = await prisma.$queryRaw`
          SELECT id, role, "attendantCategory"::text AS "attendantCategory", "isActive"
          FROM "User"
          WHERE lower(email) = lower(${opts.email})
          LIMIT 1
        ` as Array<{ id: string; role: Role; attendantCategory: string | null; isActive: boolean }>;
        return rows[0] ?? null;
      }
      return null;
    } catch (err) {
      console.error("fetchUserByIdOrEmail failed:", err);
      return null;
    }
  }

  if (impersonateId && sessionRole === "ADMIN") {
    targetUser = await fetchUserByIdOrEmail({ id: impersonateId });
    impersonated = Boolean(targetUser);
  }

  if (!targetUser) {
    if (sessionUserId) {
      targetUser = await fetchUserByIdOrEmail({ id: sessionUserId });
    }
    if (!targetUser && sessionEmail) {
      targetUser = await fetchUserByIdOrEmail({ email: sessionEmail });
    }
  }

  if (!targetUser) {
    return { ok: false, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const normalizedCategory = normalizeCategory(targetUser.attendantCategory);
  if (normalizedCategory) {
    targetUser.attendantCategory = normalizedCategory;
  }

  const allowedNormalized = allowed.map((entry) => (entry ? entry.toString().trim() : entry)).filter(Boolean) as string[];
  const allowedRoles = allowedNormalized.filter((entry) => ROLE_LABELS.has(entry.toUpperCase()));
  const allowedCategories = allowedNormalized.filter((entry) => !ROLE_LABELS.has(entry.toUpperCase())) as string[];

  const roleAllowed = allowedRoles.length === 0 ? true : allowedRoles.includes(sessionRole ?? "") || allowedRoles.includes(targetUser.role);
  const categoryAllowed =
    allowedCategories.length === 0
      ? true
      : isCategoryAllowed(normalizedCategory ?? targetUser.attendantCategory, allowedCategories);

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
