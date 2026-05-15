import { auth } from "@/lib/auth";

export function isApprovedAgentStatus(status: string | null | undefined) {
  return String(status || "").toLowerCase() === "approved";
}

export async function requireAgentSession() {
  const session = await auth();
  const user = session?.user as Record<string, unknown> | undefined;
  if (!session || !user?.id || !user?.isAgent) return null;
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
