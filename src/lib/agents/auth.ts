import { auth } from "@/lib/auth";

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
