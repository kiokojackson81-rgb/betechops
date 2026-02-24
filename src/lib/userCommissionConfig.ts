import { prisma } from "@/lib/prisma";

export const POS_TOTALS_MODES = ["NONE", "USER", "GLOBAL"] as const;
export const SALES_COMMISSION_MODES = ["DEFAULT_TIERS", "JENIFFER_PRORATED", "BRENDAH_DIRECT"] as const;

export type PosTotalsMode = (typeof POS_TOTALS_MODES)[number];
export type SalesCommissionMode = (typeof SALES_COMMISSION_MODES)[number];

export type UserCommissionConfigLike = {
  id?: string;
  userId?: string;
  posTotalsMode: PosTotalsMode;
  salesCommissionMode: SalesCommissionMode;
};

export function deriveDefaultCommissionConfigFromUser(user: {
  email?: string | null;
  attendantCategory?: string | null;
}): UserCommissionConfigLike {
  const email = (user.email ?? "").toLowerCase().trim();
  const attendantCategory = (user.attendantCategory ?? "").toString().trim();

  const posTotalsMode: PosTotalsMode =
    email === "jeniffer@betech.co.ke"
      ? "GLOBAL"
      : attendantCategory === "DIRECT_SALES_OPS"
        ? "USER"
        : "NONE";

  const salesCommissionMode: SalesCommissionMode =
    email === "jeniffer@betech.co.ke"
      ? "JENIFFER_PRORATED"
      : email === "brendah@betech.co.ke"
        ? "BRENDAH_DIRECT"
        : "DEFAULT_TIERS";

  return { posTotalsMode, salesCommissionMode };
}

export async function getUserCommissionConfigLike(userId: string): Promise<UserCommissionConfigLike> {
  try {
    return await getOrCreateUserCommissionConfig(userId);
  } catch (err: any) {
    if (err?.code === "P2021") {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, attendantCategory: true },
      });
      return deriveDefaultCommissionConfigFromUser(user ?? { email: null, attendantCategory: null });
    }
    throw err;
  }
}

export async function getOrCreateUserCommissionConfig(userId: string): Promise<UserCommissionConfigLike> {
  if (!userId) throw new Error("userId is required");

  const prismaAny = prisma as any;
  if (!prismaAny.userCommissionConfig) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, attendantCategory: true },
    });
    return { userId, ...deriveDefaultCommissionConfigFromUser(user ?? { email: null, attendantCategory: null }) };
  }

  const existing = await prismaAny.userCommissionConfig.findUnique({ where: { userId } });
  if (existing) {
    return {
      id: existing.id,
      userId: existing.userId,
      posTotalsMode: existing.posTotalsMode,
      salesCommissionMode: existing.salesCommissionMode,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, attendantCategory: true },
  });
  if (!user) throw new Error("User not found");

  const derived = deriveDefaultCommissionConfigFromUser(user);
  const created = await prismaAny.userCommissionConfig.create({
    data: {
      userId: user.id,
      posTotalsMode: derived.posTotalsMode,
      salesCommissionMode: derived.salesCommissionMode,
    },
  });
  return {
    id: created.id,
    userId: created.userId,
    posTotalsMode: created.posTotalsMode,
    salesCommissionMode: created.salesCommissionMode,
  };
}
