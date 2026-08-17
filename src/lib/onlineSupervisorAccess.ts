import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ONLINE_SUPERVISOR_EMAIL = "benjamin@betech.co.ke";

export async function canAccessOnlineSupervisorWorkspace(impersonateId?: string | null) {
  const session = await auth();
  const user = session?.user as { email?: string | null; role?: string | null } | undefined;
  const email = String(user?.email ?? "").toLowerCase();
  if (email === ONLINE_SUPERVISOR_EMAIL) return true;

  const targetId = String(impersonateId ?? "").trim();
  if (String(user?.role ?? "").toUpperCase() !== "ADMIN" || !targetId) return false;

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { email: true, isActive: true },
  });
  return Boolean(target?.isActive && String(target.email ?? "").toLowerCase() === ONLINE_SUPERVISOR_EMAIL);
}
