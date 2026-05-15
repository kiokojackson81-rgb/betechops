import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateReferralCode } from "@/lib/agents/generateReferralCode";
import { getAgentsBaseUrl } from "@/lib/runtimeUrls";
import { getAgentSalesDashboardSummary } from "@/lib/agents/sales";

export async function generateUniqueReferralCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateReferralCode();
    const existing = await prisma.agentProfile.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  throw new Error("Unable to generate a unique referral code");
}

export function getAgentDisplayName(profile: {
  firstName?: string | null;
  lastName?: string | null;
  user?: { name?: string | null; email?: string | null } | null;
}) {
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  return fullName || profile.user?.name || profile.user?.email || "Agent";
}

export async function getAgentDashboardData(userId: string) {
  const profile = await prisma.agentProfile.findUnique({
    where: { userId },
    include: {
      user: { select: { id: true, name: true, email: true, createdAt: true } },
    },
  });

  if (!profile) return null;

  const [{ sales, summary: salesSummary }, commissions, payouts, activities] = await Promise.all([
    getAgentSalesDashboardSummary(userId),
    prisma.agentCommission.findMany({
      where: { agentId: userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.agentPayout.findMany({
      where: { agentId: userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.agentActivityLog.findMany({
      where: { agentId: userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const totals = commissions.reduce(
    (acc, row) => {
      acc.referrals += 1;
      acc.sales += Number(row.saleAmount ?? 0);
      acc.commission += Number(row.commissionAmt ?? 0);
      if (String(row.status).toLowerCase() === "paid") acc.paid += Number(row.commissionAmt ?? 0);
      else acc.pending += Number(row.commissionAmt ?? 0);
      return acc;
    },
    { referrals: 0, sales: 0, commission: 0, pending: 0, paid: 0 },
  );

  const paidCount = commissions.filter((row) => String(row.status).toLowerCase() === "paid").length;
  const successRate = commissions.length ? Math.round((paidCount / commissions.length) * 100) : 0;

  return {
    profile,
    displayName: getAgentDisplayName(profile),
    referralLink: `${getAgentsBaseUrl()}/register?ref=${encodeURIComponent(profile.referralCode)}`,
    metrics: {
      totalReferrals: totals.referrals,
      totalSales: totals.sales,
      totalCommission: totals.commission,
      pendingCommission: totals.pending,
      paidCommission: totals.paid,
      successRate,
    },
    salesSummary,
    sales,
    commissions,
    payouts,
    activities,
  };
}

export async function getAdminAgentsData(search?: string, status?: string) {
  const where: Prisma.AgentProfileWhereInput = {};
  if (status && status !== "all") where.status = status;
  if (search) {
    where.OR = [
      { referralCode: { contains: search, mode: "insensitive" } },
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
      {
        user: {
          email: { contains: search, mode: "insensitive" },
        },
      },
    ];
  }

  const rows = await prisma.agentProfile.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, createdAt: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  if (!rows.length) return [];

  const userIds = rows.map((row) => row.userId);
  const [commissions, payouts, sales] = await Promise.all([
    prisma.agentCommission.findMany({
      where: { agentId: { in: userIds } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.agentPayout.findMany({
      where: { agentId: { in: userIds } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.agentSale.findMany({
      where: { agentId: { in: userIds } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return rows.map((row) => {
    const agentCommissions = commissions.filter((item) => item.agentId === row.userId);
    const agentPayouts = payouts.filter((item) => item.agentId === row.userId);
    const agentSales = sales.filter((item) => item.agentId === row.userId);
    const totalSales = agentCommissions.reduce((sum, item) => sum + Number(item.saleAmount ?? 0), 0);
    const totalCommission = agentCommissions.reduce((sum, item) => sum + Number(item.commissionAmt ?? 0), 0);
    const paidCommission = agentCommissions
      .filter((item) => String(item.status).toLowerCase() === "paid")
      .reduce((sum, item) => sum + Number(item.commissionAmt ?? 0), 0);
    const pendingCommission = totalCommission - paidCommission;
    const totalPayouts = agentPayouts
      .filter((item) => String(item.status).toLowerCase() === "paid")
      .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    const paidCount = agentCommissions.filter((item) => String(item.status).toLowerCase() === "paid").length;
    const successRate = agentCommissions.length ? Math.round((paidCount / agentCommissions.length) * 100) : 0;

    return {
      profile: row,
      displayName: getAgentDisplayName({ ...row, user: row.user }),
      totalSales,
      totalCommission,
      paidCommission,
      pendingCommission,
      totalPayouts,
      commissionCount: agentCommissions.length,
      payoutCount: agentPayouts.length,
      saleCount: agentSales.length,
      openSaleCount: agentSales.filter((item) => !["completed", "cancelled", "rejected"].includes(String(item.status))).length,
      completedSaleCount: agentSales.filter((item) => String(item.status) === "completed").length,
      potentialCommission: agentSales
        .filter((item) => !["completed", "cancelled", "rejected"].includes(String(item.status)))
        .reduce((sum, item) => sum + Number(item.potentialCommission ?? 0), 0),
      successRate,
      lastCommissionAt: agentCommissions[0]?.createdAt ?? null,
      commissions: agentCommissions.slice(0, 10),
      payouts: agentPayouts.slice(0, 10),
    };
  });
}
