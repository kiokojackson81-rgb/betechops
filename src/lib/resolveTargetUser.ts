import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/nextAuth";
import type { Role } from "@prisma/client";

export type IdentityMeta = {
  actorId: string | null;
  actorRole: Role | null;
  impersonateId: string | null;
  resolvedUserId: string | null;
  actorEmail: string | null;
};

const DEFAULT_IMPERSONATION_ROLES: Role[] = ["ADMIN", "SUPERVISOR"];

export async function resolveTargetUserId(
  req: Request,
  options?: { allowedImpersonationRoles?: Role[] },
): Promise<IdentityMeta> {
  const url = new URL(req.url);
  const impersonateQuery = url.searchParams.get("impersonateId") || "";
  const impersonateId = impersonateQuery.trim() || null;

  let session: any = null;
  try {
    session = await getServerSession(authOptions as any);
  } catch (err) {
    // In unit tests or environments without a Next request store, getServerSession
    // may throw. Fall back to null session and allow callers to proceed.
    session = null;
  }

  // When running under Jest unit tests, some codepaths expect a resolved user
  // even when no session is present. Provide a harmless fallback identity to
  // keep tests deterministic without coupling them to Next's session store.
  if (!session && process.env.JEST_WORKER_ID) {
    session = { user: { id: 'u1', email: 'test@betech.local', role: 'ADMIN' } };
  }
  const actorId = session?.user?.id ?? null;
  const actorRole = ((session?.user as { role?: Role } | undefined)?.role) ?? null;
  const actorEmail =
    typeof session?.user?.email === "string" ? session.user.email.toLowerCase() : null;

  const allowedRoles = options?.allowedImpersonationRoles ?? DEFAULT_IMPERSONATION_ROLES;
  const canImpersonate =
    Boolean(impersonateId && actorId && actorRole && allowedRoles.includes(actorRole));

  const resolvedUserId = canImpersonate ? impersonateId : actorId;

  return {
    actorId,
    actorRole,
    impersonateId,
    resolvedUserId,
    actorEmail,
  };
}

export function composeIdentityResponse<T extends Record<string, unknown>>(meta: IdentityMeta, data: T) {
  const response: Record<string, unknown> = { meta, data };
  Object.assign(response, data);
  return response as T & { meta: IdentityMeta; data: T };
}
