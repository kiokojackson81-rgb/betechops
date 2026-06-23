import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateReferralCode } from "@/lib/agents/generateReferralCode";
import { getAgentsBaseUrl } from "@/lib/runtimeUrls";
import { getAgentSalesDashboardSummary } from "@/lib/agents/sales";
import { listAgentReferralLeadsByAgent } from "@/lib/agents/referralLeads";
import { normalizeKenyanPhone } from "@/lib/phone";

function getPrismaErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    meta?: { table?: unknown; column?: unknown; modelName?: unknown } | null;
  };
  return {
    code: String(candidate.code ?? ""),
    message: String(candidate.message ?? ""),
    table: String(candidate.meta?.table ?? ""),
    column: String(candidate.meta?.column ?? ""),
    modelName: String(candidate.meta?.modelName ?? ""),
  };
}

function isAgentSalesSchemaError(error: unknown) {
  const details = getPrismaErrorDetails(error);
  if (!details) return false;
  if (!["P2021", "P2022"].includes(details.code)) return false;
  const haystack = [details.table, details.column, details.modelName, details.message].join(" ");
  return [
    "AgentSale",
    "AgentCommission",
    "AgentPayout",
    "AgentActivityLog",
    "AgentReferralLead",
    "WebsiteOrder",
    "AgentLeadOwnership",
    "AgentDuplicateReview",
    "AgentFraudSignal",
    "AgentAuditLog",
    "AgentSaleTimeline",
    "sourceType",
    "sourceId",
    "saleAmount",
    "commissionPct",
    "commissionAmt",
    "referredByAgentId",
  ].some((token) => haystack.includes(token));
}

async function withAgentDashboardFallback<T>(label: string, work: Promise<T>, fallback: T) {
  try {
    return await work;
  } catch (error) {
    if (!isAgentSalesSchemaError(error)) throw error;
    console.info("[agents.dashboard] legacy schema fallback", { label });
    return fallback;
  }
}

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

  const [{ sales, summary: salesSummary }, commissions, payouts, activities, referredWebsiteOrders, referralLeads] = await Promise.all([
    withAgentDashboardFallback(
      "sales-summary",
      getAgentSalesDashboardSummary(userId),
      { sales: [], summary: { totalSubmittedSales: 0, pendingSales: 0, processingSales: 0, completedSales: 0, potentialCommission: 0, earnedCommission: 0, paidCommission: 0 } },
    ),
    withAgentDashboardFallback(
      "agent-commissions",
      prisma.agentCommission.findMany({
        where: { agentId: userId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      [],
    ),
    withAgentDashboardFallback(
      "agent-payouts",
      prisma.agentPayout.findMany({
        where: { agentId: userId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      [],
    ),
    withAgentDashboardFallback(
      "agent-activity-log",
      prisma.agentActivityLog.findMany({
        where: { agentId: userId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      [],
    ),
    withAgentDashboardFallback(
      "website-referrals",
      prisma.websiteOrder.findMany({
        where: {
          OR: [
            { referredByAgentId: userId },
            { customerUser: { referredByAgentId: userId } },
          ],
        },
        select: {
          id: true,
          orderRef: true,
          customerName: true,
          customerPhone: true,
          customerLocation: true,
          paymentMethod: true,
          orderType: true,
          status: true,
          total: true,
          createdAt: true,
          items: {
            select: {
              id: true,
              productName: true,
              quantity: true,
              total: true,
            },
            take: 3,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      [],
    ),
    listAgentReferralLeadsByAgent(userId).catch((error) => {
      if (isAgentSalesSchemaError(error)) {
        console.info("[agents.dashboard] legacy schema fallback", { label: "agent-referral-leads" });
        return [];
      }
      throw error;
    }),
  ]);

  const adjustedCommissions = applyPaidPayoutsToCommissions(commissions, payouts);

  const totals = adjustedCommissions.reduce(
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

  const paidCount = adjustedCommissions.filter((row) => String(row.status).toLowerCase() === "paid").length;
  const successRate = adjustedCommissions.length ? Math.round((paidCount / adjustedCommissions.length) * 100) : 0;
  const websiteReferralSummary = referredWebsiteOrders.reduce(
    (acc, order) => {
      acc.totalOrders += 1;
      acc.totalRevenue += Number(order.total ?? 0);
      const status = String(order.status || "").toUpperCase();
      if (["DELIVERED", "PAYMENT_CONFIRMED"].includes(status)) acc.completedOrders += 1;
      if (["PENDING", "CONFIRMED", "PROCESSING", "RECEIPT_ISSUED", "DISPATCHED"].includes(status)) acc.openOrders += 1;
      if (status === "CANCELLED") acc.cancelledOrders += 1;
      return acc;
    },
    { totalOrders: 0, totalRevenue: 0, completedOrders: 0, openOrders: 0, cancelledOrders: 0 },
  );

  const mappedReferredWebsiteOrders = referredWebsiteOrders.map((order) => ({
    id: order.id,
    orderRef: order.orderRef,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerLocation: order.customerLocation,
    paymentMethod: order.paymentMethod,
    orderType: order.orderType,
    status: String(order.status),
    totalAmount: Number(order.total ?? 0),
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      quantity: Number(item.quantity ?? 0),
      totalAmount: Number(item.total ?? 0),
    })),
  }));

  const referralLeadsWithStatus = referralLeads.map((lead) => {
    const normalizedLeadPhone = normalizeKenyanPhone(lead.customerPhone);
    const matchedOrder = mappedReferredWebsiteOrders.find((order) => {
      const normalizedOrderPhone = normalizeKenyanPhone(order.customerPhone || "");
      if (!normalizedLeadPhone || !normalizedOrderPhone) return false;
      return normalizedLeadPhone === normalizedOrderPhone && order.createdAt.getTime() >= lead.createdAt.getTime();
    });

    return {
      ...lead,
      effectiveStatus: matchedOrder ? "PURCHASED" : String(lead.status || "PENDING"),
      matchedOrderRef: matchedOrder?.orderRef || null,
      matchedOrderId: matchedOrder?.id || null,
      matchedOrderAmount: matchedOrder?.totalAmount ?? null,
      matchedOrderCreatedAt: matchedOrder?.createdAt ?? null,
    };
  });

  const referralLeadSummary = referralLeadsWithStatus.reduce(
    (acc, lead) => {
      acc.total += 1;
      if (lead.effectiveStatus === "PURCHASED" || lead.effectiveStatus === "CONVERTED") acc.purchased += 1;
      else if (lead.effectiveStatus === "CANCELLED") acc.cancelled += 1;
      else acc.pending += 1;
      return acc;
    },
    { total: 0, pending: 0, purchased: 0, cancelled: 0 },
  );

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
    websiteReferralSummary,
    referralLeadSummary,
    referralLeads: referralLeadsWithStatus,
    referredWebsiteOrders: mappedReferredWebsiteOrders,
    commissions: adjustedCommissions,
    payouts,
    activities,
  };
}

export async function getAdminAgentsData(
  search?: string,
  status?: string,
  county?: string,
  sort?: string,
) {
  const where: Prisma.AgentProfileWhereInput = {};
  if (status && status !== "all") where.status = status;
  if (county && county !== "all") where.county = county;
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
  const [commissions, payouts, sales, activities] = await Promise.all([
    prisma.agentCommission.findMany({
      where: { agentId: { in: userIds } },
      orderBy: { createdAt: "desc" },
    }).catch((error) => {
      if (isAgentSalesSchemaError(error)) return [];
      throw error;
    }),
    prisma.agentPayout.findMany({
      where: { agentId: { in: userIds } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.agentSale.findMany({
      where: { agentId: { in: userIds } },
      orderBy: { createdAt: "desc" },
    }).catch((error) => {
      if (isAgentSalesSchemaError(error)) return [];
      throw error;
    }),
    prisma.agentActivityLog.findMany({
      where: { agentId: { in: userIds } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const adjustedCommissions = applyPaidPayoutsToCommissions(commissions, payouts);

  const phoneOwnerCounts = new Map<string, Set<string>>();
  for (const sale of sales) {
    const phone = String(sale.customerPhone || "").replace(/\D/g, "");
    if (!phone) continue;
    const existing = phoneOwnerCounts.get(phone) ?? new Set<string>();
    existing.add(sale.agentId);
    phoneOwnerCounts.set(phone, existing);
  }

  const mapped = rows.map((row) => {
    const agentCommissions = adjustedCommissions.filter((item) => item.agentId === row.userId);
    const agentPayouts = payouts.filter((item) => item.agentId === row.userId);
    const agentSales = sales.filter((item) => item.agentId === row.userId);
    const agentActivities = activities.filter((item) => item.agentId === row.userId).slice(0, 10);
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
    const completedSales = agentSales.filter((item) => String(item.status) === "completed").length;
    const openSales = agentSales.filter((item) => !["completed", "cancelled", "rejected"].includes(String(item.status))).length;
    const cancelledSales = agentSales.filter((item) => ["cancelled", "rejected"].includes(String(item.status))).length;
    const duplicateLeadCount = agentSales.reduce((sum, sale) => {
      const phone = String(sale.customerPhone || "").replace(/\D/g, "");
      if (!phone) return sum;
      const ownerCount = phoneOwnerCounts.get(phone)?.size ?? 0;
      return sum + (ownerCount > 1 ? 1 : 0);
    }, 0);
    const cancellationRate = agentSales.length ? Math.round((cancelledSales / agentSales.length) * 100) : 0;

    let riskLevel: "low" | "medium" | "high" = "low";
    let performanceLabel = "Trusted Agent";
    if (duplicateLeadCount >= 3 || cancellationRate >= 45) {
      riskLevel = "high";
      performanceLabel = "Suspicious Activity";
    } else if (duplicateLeadCount > 0 || cancellationRate >= 25) {
      riskLevel = "medium";
      performanceLabel = duplicateLeadCount > 0 ? "Duplicate Risk" : "High Cancellation Rate";
    } else if (completedSales >= 5 && totalSales >= 250000) {
      performanceLabel = "Top Performer";
    }

    const lastActiveAt = [
      row.updatedAt,
      agentSales[0]?.createdAt,
      agentCommissions[0]?.createdAt,
      agentActivities[0]?.createdAt,
    ]
      .filter((value): value is Date => Boolean(value))
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? row.createdAt;

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
      openSaleCount: openSales,
      completedSaleCount: completedSales,
      potentialCommission: agentSales
        .filter((item) => !["completed", "cancelled", "rejected"].includes(String(item.status)))
        .reduce((sum, item) => sum + Number(item.potentialCommission ?? 0), 0),
      successRate,
      lastCommissionAt: agentCommissions[0]?.createdAt ?? null,
      lastActiveAt,
      duplicateLeadCount,
      cancellationRate,
      riskLevel,
      performanceLabel,
      commissions: agentCommissions.slice(0, 10),
      payouts: agentPayouts.slice(0, 10),
      activities: agentActivities,
    };
  });

  if (sort === "highest_sales") {
    mapped.sort((a, b) => b.totalSales - a.totalSales);
  } else if (sort === "pending_commission") {
    mapped.sort((a, b) => b.pendingCommission - a.pendingCommission);
  } else {
    mapped.sort(
      (a, b) =>
        new Date(b.profile.createdAt).getTime() - new Date(a.profile.createdAt).getTime(),
    );
  }

  return mapped;
}

function commissionQueueFromStatus(status: string) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "paid") return "paid";
  if (normalized === "approved") return "available";
  if (normalized === "cancelled") return "cancelled";
  return "pending";
}

function amountsMatch(a: number, b: number) {
  return Math.abs(a - b) <= 0.0001;
}

function applyPaidPayoutsToCommissions<T extends { id: string; agentId: string; commissionAmt: number | null; status: string | null; createdAt: Date }>(
  commissions: T[],
  payouts: Array<{ agentId: string; amount: number | null; status: string | null; createdAt?: Date }>,
) {
  const payoutsByAgent = new Map<string, Array<{ amount: number; createdAt: Date }>>();
  for (const payout of payouts) {
    if (String(payout.status || "").toLowerCase() !== "paid") continue;
    const bucket = payoutsByAgent.get(payout.agentId) ?? [];
    bucket.push({
      amount: Number(payout.amount ?? 0),
      createdAt: payout.createdAt ?? new Date(0),
    });
    payoutsByAgent.set(payout.agentId, bucket);
  }

  const commissionsByAgent = new Map<string, T[]>();
  for (const commission of commissions) {
    const bucket = commissionsByAgent.get(commission.agentId) ?? [];
    bucket.push(commission);
    commissionsByAgent.set(commission.agentId, bucket);
  }

  const paidIds = new Set<string>();
  for (const [agentId, items] of commissionsByAgent.entries()) {
    const paidPayouts = (payoutsByAgent.get(agentId) ?? []).sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    if (!paidPayouts.length) continue;

    const activeItems = items
      .filter((row) => !["cancelled", "rejected"].includes(String(row.status || "").toLowerCase()))
      .slice()
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const approvedPool = activeItems.filter((row) => String(row.status || "").toLowerCase() === "approved");
    for (const row of activeItems.filter((item) => String(item.status || "").toLowerCase() === "paid")) {
      paidIds.add(row.id);
    }

    const alreadyPaidAmount = activeItems
      .filter((row) => String(row.status || "").toLowerCase() === "paid")
      .reduce((sum, row) => sum + Number(row.commissionAmt ?? 0), 0);
    const totalPaidPayoutAmount = paidPayouts.reduce((sum, row) => sum + row.amount, 0);
    let remainingBudget = Math.max(0, totalPaidPayoutAmount - alreadyPaidAmount);

    const takeExact = (targetAmount: number) => {
      const index = approvedPool.findIndex(
        (row) => !paidIds.has(row.id) && amountsMatch(Number(row.commissionAmt ?? 0), targetAmount),
      );
      if (index === -1) return false;
      const row = approvedPool[index];
      paidIds.add(row.id);
      remainingBudget = Math.max(0, remainingBudget - Number(row.commissionAmt ?? 0));
      approvedPool.splice(index, 1);
      return true;
    };

    for (const payout of paidPayouts) {
      if (remainingBudget <= 0) break;
      takeExact(payout.amount);
    }

    for (const row of approvedPool) {
      const amount = Number(row.commissionAmt ?? 0);
      if (remainingBudget <= 0) break;
      if (amount <= remainingBudget + 0.0001) {
        paidIds.add(row.id);
        remainingBudget = Math.max(0, remainingBudget - amount);
      }
    }
  }

  return commissions.map((commission) =>
    paidIds.has(commission.id)
      ? {
          ...commission,
          status: "paid",
        }
      : commission,
  );
}

function payoutQueueFromStatus(status: string) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved") return "approved";
  if (normalized === "paid") return "paid";
  if (normalized === "rejected" || normalized === "cancelled") return "rejected";
  if (normalized === "held") return "held";
  return "requests";
}

export async function getAdminAgentCommissionQueueData(filters: {
  q?: string;
  queue?: string;
  agentId?: string;
}) {
  const agentWhere: Prisma.AgentProfileWhereInput = {};
  if (filters.agentId && filters.agentId !== "all") {
    agentWhere.userId = filters.agentId;
  }

  const profiles = await prisma.agentProfile.findMany({
    where: agentWhere,
    include: {
      user: { select: { id: true, name: true, email: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!profiles.length) {
    return { rows: [], summary: { locked: 0, pending: 0, available: 0, paid: 0 } };
  }

  const agents = await getAdminAgentsData(
    undefined,
    "all",
    "all",
    "newest",
  );
  const agentMap = new Map(agents.map((agent) => [agent.profile.userId, agent]));
  const userIds = profiles.map((row) => row.userId);
  const [sales, commissions, payouts] = await Promise.all([
    prisma.agentSale.findMany({
      where: { agentId: { in: userIds } },
      orderBy: { createdAt: "desc" },
    }).catch((error) => {
      if (isAgentSalesSchemaError(error)) return [];
      throw error;
    }),
    prisma.agentCommission.findMany({
      where: { agentId: { in: userIds } },
      orderBy: { createdAt: "desc" },
    }).catch((error) => {
      if (isAgentSalesSchemaError(error)) return [];
      throw error;
    }),
    prisma.agentPayout.findMany({
      where: { agentId: { in: userIds } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const adjustedCommissions = applyPaidPayoutsToCommissions(commissions, payouts);

  const saleById = new Map<string, (typeof sales)[number]>(
    sales.map((sale) => [sale.id, sale] as [string, (typeof sales)[number]]),
  );
  const rows = [
    ...sales
      .filter((sale) => !["completed", "cancelled", "rejected"].includes(String(sale.status)))
      .map((sale) => {
        const agent = agentMap.get(sale.agentId);
        return {
          id: `locked:${sale.id}`,
          queue: "locked",
          kind: "locked" as const,
          agentId: sale.agentId,
          agentName: agent?.displayName || "Agent",
          referralCode: agent?.profile.referralCode || "",
          phone: agent?.profile.phone || "",
          county: agent?.profile.county || "",
          riskLevel: agent?.riskLevel || "low",
          customerName: sale.customerName,
          customerPhone: sale.customerPhone,
          productName: sale.productName,
          saleId: sale.id,
          receiptNumber: sale.receiptNumber || null,
          saleAmount: Number(sale.totalAmount ?? 0),
          commissionAmount: Number(sale.potentialCommission ?? 0),
          status: String(sale.status),
          createdAt: sale.createdAt,
          note: "Locked until payment, delivery, and admin completion.",
        };
      }),
    ...adjustedCommissions.map((commission) => {
      const sale = commission.sourceId ? saleById.get(commission.sourceId) : null;
      const agent = agentMap.get(commission.agentId);
      return {
        id: `commission:${commission.id}`,
        queue: commissionQueueFromStatus(commission.status),
        kind: "earned" as const,
        agentId: commission.agentId,
        agentName: agent?.displayName || "Agent",
        referralCode: agent?.profile.referralCode || "",
        phone: agent?.profile.phone || "",
        county: agent?.profile.county || "",
        riskLevel: agent?.riskLevel || "low",
        customerName: sale?.customerName || "Linked sale",
        customerPhone: sale?.customerPhone || "",
        productName: sale?.productName || commission.orderNumber || "Agent sale",
        saleId: sale?.id || commission.sourceId || null,
        receiptNumber: commission.orderNumber || sale?.receiptNumber || null,
        saleAmount: Number(commission.saleAmount ?? sale?.totalAmount ?? 0),
        commissionAmount: Number(commission.commissionAmt ?? 0),
        status: String(commission.status),
        createdAt: commission.createdAt,
        note:
          commissionQueueFromStatus(commission.status) === "available"
            ? "Available for agent withdrawal review."
            : commissionQueueFromStatus(commission.status) === "paid"
              ? "Already paid out to the agent."
              : commissionQueueFromStatus(commission.status) === "cancelled"
                ? "Cancelled and excluded from payout."
                : "Unlocked and pending payout workflow.",
      };
    }),
  ]
    .filter((row) => {
      if (!filters.queue || filters.queue === "all") return true;
      return row.queue === filters.queue;
    })
    .filter((row) => {
      if (!filters.q?.trim()) return true;
      const q = filters.q.trim().toLowerCase();
      return [
        row.agentName,
        row.referralCode,
        row.phone,
        row.customerName,
        row.customerPhone,
        row.productName,
        row.receiptNumber,
      ].some((value) => String(value || "").toLowerCase().includes(q));
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const summary = rows.reduce(
    (acc, row) => {
      if (row.queue === "locked") acc.locked += row.commissionAmount;
      if (row.queue === "pending") acc.pending += row.commissionAmount;
      if (row.queue === "available") acc.available += row.commissionAmount;
      if (row.queue === "paid") acc.paid += row.commissionAmount;
      return acc;
    },
    { locked: 0, pending: 0, available: 0, paid: 0 },
  );

  return { rows, summary };
}

export async function getAdminAgentPayoutQueueData(filters: {
  q?: string;
  queue?: string;
  agentId?: string;
}) {
  const profiles = await prisma.agentProfile.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!profiles.length) {
    return { rows: [], summary: { requests: 0, approved: 0, paid: 0, held: 0 } };
  }

  const agents = await getAdminAgentsData(undefined, "all", "all", "newest");
  const agentMap = new Map(agents.map((agent) => [agent.profile.userId, agent]));
  const userIds = profiles.map((row) => row.userId);
  const [payouts, commissions] = await Promise.all([
    prisma.agentPayout.findMany({
      where: filters.agentId && filters.agentId !== "all" ? { agentId: filters.agentId } : undefined,
      orderBy: { createdAt: "desc" },
    }),
    prisma.agentCommission.findMany({
      where: { agentId: { in: userIds } },
      orderBy: { createdAt: "desc" },
    }).catch((error) => {
      if (isAgentSalesSchemaError(error)) return [];
      throw error;
    }),
  ]);

  const rows = payouts
    .map((payout) => {
      const agent = agentMap.get(payout.agentId);
      const agentCommissions = commissions.filter((item) => item.agentId === payout.agentId);
      const eligibleCommission = agentCommissions
        .filter((item) => String(item.status).toLowerCase() === "approved")
        .reduce((sum, item) => sum + Number(item.commissionAmt ?? 0), 0);
      const reservedPayouts = payouts
        .filter((item) => item.agentId === payout.agentId)
        .filter((item) => !["rejected", "cancelled"].includes(String(item.status).toLowerCase()))
        .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
      const availableBalance = Math.max(0, eligibleCommission - reservedPayouts);

      return {
        id: payout.id,
        queue: payoutQueueFromStatus(payout.status),
        agentId: payout.agentId,
        agentName: agent?.displayName || "Agent",
        referralCode: agent?.profile.referralCode || "",
        phone: payout.phone || agent?.profile.phone || "",
        county: agent?.profile.county || "",
        riskLevel: agent?.riskLevel || "low",
        amount: Number(payout.amount ?? 0),
        method: payout.method || "MPESA",
        reference: payout.reference || "",
        status: String(payout.status),
        availableBalance,
        paidAmount: String(payout.status).toLowerCase() === "paid" ? Number(payout.amount ?? 0) : 0,
        createdAt: payout.createdAt,
      };
    })
    .filter((row) => {
      if (!filters.queue || filters.queue === "all") return true;
      return row.queue === filters.queue;
    })
    .filter((row) => {
      if (!filters.q?.trim()) return true;
      const q = filters.q.trim().toLowerCase();
      return [
        row.agentName,
        row.referralCode,
        row.phone,
        row.reference,
      ].some((value) => String(value || "").toLowerCase().includes(q));
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const summary = rows.reduce(
    (acc, row) => {
      if (row.queue === "requests") acc.requests += row.amount;
      if (row.queue === "approved") acc.approved += row.amount;
      if (row.queue === "paid") acc.paid += row.amount;
      if (row.queue === "held") acc.held += row.amount;
      return acc;
    },
    { requests: 0, approved: 0, paid: 0, held: 0 },
  );

  return { rows, summary };
}

export async function getAdminAgentFraudQueueData(filters: {
  q?: string;
  queue?: string;
  agentId?: string;
}) {
  const agents = await getAdminAgentsData(undefined, "all", "all", "newest");
  const agentMap = new Map(agents.map((agent) => [agent.profile.userId, agent]));
  type FraudQueueRow = {
    id: string;
    queue: "duplicate_customers" | "phone_reuse" | "suspicious_agents" | "disputes";
    title: string;
    riskLevel: "low" | "medium" | "high";
    phone: string;
    agents: string[];
    saleIds: string[];
    customerNames: string[];
    county: string;
    createdAt: Date;
    note: string;
  };

  const duplicateRows: FraudQueueRow[] = [];
  try {
    const [reviews, signals, sales] = await Promise.all([
      prisma.agentDuplicateReview.findMany({
        where: filters.agentId && filters.agentId !== "all"
          ? {
              OR: [
                { primaryAgentId: filters.agentId },
                { duplicateAgentId: filters.agentId },
              ],
            }
          : undefined,
        orderBy: { createdAt: "desc" },
      }),
      prisma.agentFraudSignal.findMany({
        where: filters.agentId && filters.agentId !== "all" ? { agentId: filters.agentId } : undefined,
        orderBy: { createdAt: "desc" },
      }),
      prisma.agentSale.findMany({
        where: filters.agentId && filters.agentId !== "all" ? { agentId: filters.agentId } : undefined,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const saleMap = new Map<string, (typeof sales)[number]>(
      sales.map((sale) => [sale.id, sale] as [string, (typeof sales)[number]]),
    );

    for (const review of reviews) {
      const primarySale = saleMap.get(review.primarySaleId);
      const duplicateSale = saleMap.get(review.duplicateSaleId);
      const phone = review.normalizedPhone;
      const primaryAgentName = agentMap.get(review.primaryAgentId)?.displayName || "Agent";
      const duplicateAgentName = agentMap.get(review.duplicateAgentId)?.displayName || "Agent";
      const queue = review.status === "open" ? "disputes" : "duplicate_customers";
      duplicateRows.push({
        id: `review:${review.id}`,
        queue,
        title: queue === "disputes" ? "Lead ownership dispute" : "Duplicate customer review",
        riskLevel: review.status === "open" ? "high" : "medium",
        phone,
        agents: [primaryAgentName, duplicateAgentName],
        saleIds: [review.primarySaleId, review.duplicateSaleId],
        customerNames: Array.from(
          new Set([primarySale?.customerName, duplicateSale?.customerName].filter((value): value is string => Boolean(value))),
        ),
        county: String(primarySale?.customerCounty || duplicateSale?.customerCounty || primarySale?.customerLocation || duplicateSale?.customerLocation || ""),
        createdAt: review.createdAt,
        note: review.resolutionNote || "Review ownership and decide whether to keep first, merge, reassign, or reject duplicate.",
      });
    }

    for (const signal of signals) {
      const sale = signal.saleId ? saleMap.get(signal.saleId) : null;
      let queue: FraudQueueRow["queue"] = "suspicious_agents";
      if (signal.signalType === "duplicate_customer") queue = "duplicate_customers";
      else if (signal.signalType === "phone_reuse") queue = "phone_reuse";
      else if (signal.signalType === "self_submission") queue = "suspicious_agents";
      if (!["all", queue].includes(filters.queue || "all")) continue;
      duplicateRows.push({
        id: `signal:${signal.id}`,
        queue,
        title: signal.title,
        riskLevel: String(signal.riskLevel).toLowerCase() === "high" ? "high" : String(signal.riskLevel).toLowerCase() === "medium" ? "medium" : "low",
        phone: sale?.customerPhone || "",
        agents: signal.agentId ? [agentMap.get(signal.agentId)?.displayName || "Agent"] : [],
        saleIds: signal.saleId ? [signal.saleId] : [],
        customerNames: sale?.customerName ? [sale.customerName] : [],
        county: String(sale?.customerCounty || sale?.customerLocation || ""),
        createdAt: signal.createdAt,
        note: signal.description || "Investigate this flagged submission.",
      });
    }
  } catch (error) {
    if (!isAgentSalesSchemaError(error)) throw error;
  }

  const suspiciousRows = agents
    .filter((agent) => agent.riskLevel !== "low")
    .map((agent) => ({
      id: `agent:${agent.profile.userId}`,
      queue: "suspicious_agents" as const,
      title: agent.performanceLabel,
      riskLevel: agent.riskLevel,
      phone: agent.profile.phone || "",
      agents: [agent.displayName],
      saleIds: [],
      customerNames: [],
      county: agent.profile.county || "",
      createdAt: agent.lastActiveAt,
      note: `${agent.duplicateLeadCount} duplicate leads · ${agent.cancellationRate}% cancellation rate.`,
    }));

  const rows = [...duplicateRows, ...suspiciousRows]
    .filter((row) => {
      if (!filters.queue || filters.queue === "all") return true;
      return row.queue === filters.queue;
    })
    .filter((row) => {
      if (!filters.q?.trim()) return true;
      const q = filters.q.trim().toLowerCase();
      return [
        row.title,
        row.phone,
        row.note,
        row.county,
        ...row.agents,
        ...row.customerNames,
      ].some((value) => String(value || "").toLowerCase().includes(q));
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const summary = rows.reduce(
    (acc, row) => {
      acc.total += 1;
      if (row.riskLevel === "high") acc.high += 1;
      if (row.riskLevel === "medium") acc.medium += 1;
      if (row.queue === "disputes") acc.disputes += 1;
      return acc;
    },
    { total: 0, high: 0, medium: 0, disputes: 0 },
  );

  return { rows, summary };
}
