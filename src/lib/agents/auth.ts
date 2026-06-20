import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getKenyanPhoneVariants, normalizeKenyanPhone } from "@/lib/phone";

export function isApprovedAgentStatus(status: string | null | undefined) {
  return String(status || "").toLowerCase() === "approved";
}

export async function requireAgentSession() {
  const session = await auth();
  const user = session?.user as Record<string, unknown> | undefined;
  console.log("[agents] requireAgentSession", {
    hasSession: Boolean(session),
    userId: user?.id ?? null,
    isAgent: Boolean(user?.isAgent),
    agentStatus: typeof user?.agentStatus === "string" ? user.agentStatus : null,
  });
  if (!session || !user?.id) return null;

  if (!user?.isAgent) {
    const normalizedPhone = normalizeKenyanPhone(typeof user.phone === "string" ? user.phone : "");
    const phoneVariants = normalizedPhone ? getKenyanPhoneVariants(normalizedPhone) : [];
    const normalizedEmail = typeof user.email === "string" ? user.email.trim().toLowerCase() : "";

    const fallbackAgent = await prisma.agentProfile.findFirst({
      where: {
        OR: [
          { userId: String(user.id) },
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

    console.log("[agents] fallback agent lookup", {
      sessionUserId: String(user.id),
      normalizedPhone: normalizedPhone || null,
      normalizedEmail: normalizedEmail || null,
      foundAgentProfileId: fallbackAgent?.id ?? null,
      foundAgentStatus: fallbackAgent?.status ?? null,
    });

    if (fallbackAgent) {
      return {
        session,
        userId: String(user.id),
        agentStatus: fallbackAgent.status ?? null,
      };
    }
  }

  if (!user?.isAgent) return null;
  return {
    session,
    userId: String(user.id),
    agentStatus: typeof user.agentStatus === "string" ? user.agentStatus : null,
  };
}

export async function requireApprovedAgentSession() {
  const agentSession = await requireAgentSession();
  if (!agentSession || !isApprovedAgentStatus(agentSession.agentStatus)) return null;
  return agentSession;
}

export async function requireAdminSession() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  if (!session || role !== "ADMIN") return null;
  return { session, role };
}

export async function requireAdminLikeSession() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  if (!session || (role !== "ADMIN" && role !== "SUPERVISOR")) return null;
  return { session, role };
}
