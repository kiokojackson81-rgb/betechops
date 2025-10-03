import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/nextAuth";

export type ShopScope = { shopIds?: string[]; role?: Role };

export async function resolveShopScope(): Promise<ShopScope> {
  try {
    const session = await getServerSession(authOptions as unknown as Record<string, unknown>) as Session | null;
    const roleStr = (session?.user as { role?: string } | undefined)?.role;
    const email = (session?.user as { email?: string } | undefined)?.email?.toLowerCase() || "";
    const role = mapRole(roleStr);
    if (!role || role === Role.ADMIN) return { role };
    if (!email) return { role };
    const user = await prisma.user.findUnique({
      where: { email },
      select: { role: true, managedShops: { select: { id: true } } },
    });
    if (!user) return { role };
    return { role: user.role, shopIds: (user.managedShops || []).map(s => s.id) };
  } catch {
    return {};
  }
}

// Server components/pages variant (no Request available)
export async function resolveShopScopeForServer(): Promise<ShopScope> {
  try {
    const session = await getServerSession(authOptions as unknown as Record<string, unknown>) as Session | null;
    const roleStr = (session?.user as { role?: string } | undefined)?.role;
    const role = mapRole(roleStr);
    const email = ((session?.user as { email?: string } | undefined)?.email || "").toLowerCase();
    if (!role || role === Role.ADMIN) return { role };
    if (!email) return { role };
    const user = await prisma.user.findUnique({
      where: { email },
      select: { role: true, managedShops: { select: { id: true } } },
    });
    if (!user) return { role };
    return { role: user.role, shopIds: (user.managedShops || []).map(s => s.id) };
  } catch {
    return {};
  }
}

function mapRole(role?: string): Role | undefined {
  switch (role) {
    case "ADMIN": return Role.ADMIN;
    case "SUPERVISOR": return Role.SUPERVISOR;
    case "ATTENDANT": return Role.ATTENDANT;
    default: return undefined;
  }
}
