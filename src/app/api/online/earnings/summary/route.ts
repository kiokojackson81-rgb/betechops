import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/nextAuth";
import { getEarningsSummaryForUser } from "@/lib/earningsSummary";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import {
  summarizeMarketingReportsForPeriod,
  recomputeMarketingCommissionLedger,
} from "@/lib/marketingPeriodTotals";
import { getSupportPeriodAggregates } from "@/lib/supportEntries";
import { prisma } from "@/lib/prisma";
import {
  computeSalesCommissionFromTiers,
  getOrCreateCommissionPeriod,
} from "@/lib/commission";
import { normalizeReceiptId } from "@/lib/receiptKey";
import { summarizePosReceiptsForPeriod } from "@/lib/posReceiptSummary";

export const dynamic = "force-dynamic";

type ContributionSource = "marketing" | "support";

type ReceiptContribution = {
  receiptId: string;
  rawId: string;
  source: ContributionSource;
  sales: number;
  profit: number;
  items: number;
  paymentMethod: "CASH" | "MPESA" | null;
  attribution: {
    submittedById?: string | null;
  };
  createdAt: Date;
};

type ReceiptDebugSample = {
  receiptId: string;
  rawId: string;
  source: ContributionSource;
  sales: number;
  profit: number;
  items: number;
  paymentMethod: "CASH" | "MPESA" | null;
  attribution: {
    submittedById?: string | null;
  };
};

async function fetchMarketingContributions(userId: string, period: { start: Date; end: Date }) {
  const rows = await prisma.marketingReceipt.findMany({
    where: {
      dailyEntry: {
        submittedById: userId,
        date: { gte: period.start, lte: period.end },
      },
    },
    select: {
      id: true,
      receiptNumber: true,
      sellingTotal: true,
      buyingTotal: true,
      paymentMethod: true,
      createdAt: true,
      _count: { select: { items: true } },
      dailyEntry: { select: { submittedById: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows
    .map((row) => {
      const receiptId = normalizeReceiptId(row.receiptNumber) || normalizeReceiptId(row.id);
      if (!receiptId) return null;
      const sales = Number(row.sellingTotal ?? 0);
      const profit = Math.max(0, sales - Number(row.buyingTotal ?? 0));
      const items = Number(row._count?.items ?? 0);
      return {
        receiptId,
        rawId: row.receiptNumber ?? row.id,
        source: "marketing" as const,
        sales,
        profit,
        items,
        paymentMethod: row.paymentMethod ?? null,
        attribution: { submittedById: row.dailyEntry?.submittedById ?? null },
        createdAt: row.createdAt,
      };
    })
      .filter((it) => Boolean(it)) as ReceiptContribution[];
}

async function fetchSupportContributions(userId: string, period: { start: Date; end: Date }) {
  const rows = await prisma.supportReceipt.findMany({
    where: {
      dailyEntry: {
        submittedById: userId,
        date: { gte: period.start, lte: period.end },
      },
    },
    select: {
      id: true,
      receiptNumber: true,
      sellingTotal: true,
      buyingTotal: true,
      paymentMethod: true,
      createdAt: true,
      _count: { select: { items: true } },
      dailyEntry: { select: { submittedById: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows
    .map((row) => {
      const receiptId = normalizeReceiptId(row.receiptNumber) || normalizeReceiptId(row.id);
      if (!receiptId) return null;
      const sales = Number(row.sellingTotal ?? 0);
      const profit = Math.max(0, sales - Number(row.buyingTotal ?? 0));
      const items = Number(row._count?.items ?? 0);
      return {
        receiptId,
        rawId: row.receiptNumber ?? row.id,
        source: "support" as const,
        sales,
        profit,
        items,
        paymentMethod: row.paymentMethod ?? null,
        attribution: { submittedById: row.dailyEntry?.submittedById ?? null },
        createdAt: row.createdAt,
      };
    })
    .filter((it) => Boolean(it)) as ReceiptContribution[];
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const impersonateId = url.searchParams.get("impersonateId");
  const isDebug = url.searchParams.get("debug") === "1";

  const session: any = await getServerSession(authOptions as any);
  const actorId = session?.user?.id;

  if (!actorId && !impersonateId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (impersonateId && session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = impersonateId ?? actorId;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  const isJeniffer = (user?.email ?? "").toLowerCase() === "jeniffer@betech.co.ke";

  const now = new Date();
  const { tiers } = await getOrCreateCommissionPeriod(now);
  const period = getTradingPeriodFor(now);
  const jenifferPosSummary = isJeniffer ? await summarizePosReceiptsForPeriod(period) : null;

  const [summary, marketingSummary, supportSummary] = await Promise.all([
    getEarningsSummaryForUser({ userId }),
    summarizeMarketingReportsForPeriod({ userId, period }),
    getSupportPeriodAggregates({ userId, period }),
  ]);

  const [marketingContributions, supportContributions] = await Promise.all([
    fetchMarketingContributions(userId, period),
    fetchSupportContributions(userId, period),
  ]);

  await recomputeMarketingCommissionLedger({ userId, period, client: prisma });

  const ledger = await prisma.commissionLedger.findUnique({
    where: {
      userId_periodStart_periodEnd: {
        userId,
        periodStart: period.start,
        periodEnd: period.end,
      },
    },
  });

  const supportTotals = supportSummary?.aggregates ?? {
    totalSales: 0,
    totalProfit: 0,
    totalReceipts: 0,
    totalItems: 0,
  };

  const contributions = [...marketingContributions, ...supportContributions];
  const priority: Record<ContributionSource, number> = {
    marketing: 2,
    support: 1,
  };
  const orderedContributions = [...contributions].sort((a, b) => {
    if (priority[b.source] !== priority[a.source]) {
      return priority[b.source] - priority[a.source];
    }
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const dedupedMap = new Map<string, ReceiptContribution>();
  const intersectionMap = new Map<string, Set<ContributionSource>>();
  const mismatches: ReceiptContribution[] = [];
  for (const contribution of orderedContributions) {
    if (!dedupedMap.has(contribution.receiptId)) {
      dedupedMap.set(contribution.receiptId, contribution);
    }
    const sources = intersectionMap.get(contribution.receiptId) ?? new Set();
    sources.add(contribution.source);
    intersectionMap.set(contribution.receiptId, sources);
    if (contribution.attribution.submittedById && contribution.attribution.submittedById !== userId) {
      mismatches.push(contribution);
    }
  }

  let dedupedSales = 0;
  let dedupedProfit = 0;
  let dedupedItems = 0;
  const dedupedPaymentStats = {
    totalSalesCash: 0,
    totalSalesMpesa: 0,
    countCashReceipts: 0,
    countMpesaReceipts: 0,
  };
  dedupedMap.forEach((contribution) => {
    dedupedSales += contribution.sales;
    dedupedProfit += contribution.profit;
    dedupedItems += contribution.items;
    const method = contribution.paymentMethod;
    if (method === "CASH") {
      dedupedPaymentStats.totalSalesCash += contribution.sales;
      dedupedPaymentStats.countCashReceipts += 1;
    } else if (method === "MPESA") {
      dedupedPaymentStats.totalSalesMpesa += contribution.sales;
      dedupedPaymentStats.countMpesaReceipts += 1;
    }
  });

  const dedupedTotals = {
    totalSales: dedupedSales,
    totalProfit: dedupedProfit,
    totalItems: dedupedItems,
    totalReceipts: dedupedMap.size,
    paymentStats: dedupedPaymentStats,
  };

  const marketingSamples = marketingContributions
    .slice(0, 50)
    .map<ReceiptDebugSample>((c) => ({
      receiptId: c.receiptId,
      rawId: c.rawId,
      source: c.source,
      sales: c.sales,
      profit: c.profit,
      items: c.items,
      paymentMethod: c.paymentMethod,
      attribution: c.attribution,
    }));
  const supportSamples = supportContributions
    .slice(0, 50)
    .map<ReceiptDebugSample>((c) => ({
      receiptId: c.receiptId,
      rawId: c.rawId,
      source: c.source,
      sales: c.sales,
      profit: c.profit,
      items: c.items,
      paymentMethod: c.paymentMethod,
      attribution: c.attribution,
    }));

  const intersections = Array.from(intersectionMap.entries())
    .filter(([, sources]) => sources.size > 1)
    .map(([receiptId, sources]) => ({
      receiptId,
      sources: Array.from(sources),
    }));

  const debugInfo = isDebug
    ? {
        totals: {
          earnings: {
            totalSales: summary.totalSales,
            totalProfit: summary.totalProfit,
            totalReceipts: summary.totalReceipts ?? 0,
          },
          marketing: marketingSummary.totals,
          support: supportTotals,
          deduped: dedupedTotals,
        },
        samples: {
          marketing: marketingSamples,
          support: supportSamples,
        },
        intersections,
        mismatches: mismatches.slice(0, 50).map((c) => ({
          receiptId: c.receiptId,
          rawId: c.rawId,
          source: c.source,
          sales: c.sales,
          profit: c.profit,
          items: c.items,
          paymentMethod: c.paymentMethod,
          attribution: c.attribution,
        })),
      }
    : undefined;

  const combinedSales = jenifferPosSummary?.totalSales ?? dedupedTotals.totalSales;
  const combinedProfit = jenifferPosSummary?.totalProfit ?? dedupedTotals.totalProfit;
  const combinedItems = jenifferPosSummary?.totalItems ?? dedupedTotals.totalItems;
  const combinedReceipts = jenifferPosSummary?.totalReceipts ?? dedupedTotals.totalReceipts;

  const detail = ledger?.detail as Record<string, any> | undefined;
  const marketingCommission = detail && typeof detail === "object" ? Number(detail.marketing?.commission ?? 0) : 0;
  const supportCommission = detail && typeof detail === "object" ? Number(detail.support?.commission ?? 0) : 0;

  let salesCommission = marketingCommission + supportCommission;
  // Prefer persisted, authoritative commissionTotal when present
  if (ledger && Number(ledger.commissionTotal ?? 0) > 0) {
    salesCommission = Number(ledger.commissionTotal);
  } else {
    if (salesCommission === 0 && ledger) {
      salesCommission = Number(ledger.grossCommission ?? 0);
    }
    if (salesCommission === 0) {
      salesCommission = summary.salesCommission;
    }
  }

  if (isJeniffer && jenifferPosSummary) {
    salesCommission = computeSalesCommissionFromTiers(
      jenifferPosSummary.totalSales,
      jenifferPosSummary.totalProfit,
      tiers,
      0,
    );
  }

  const grossCommission =
    salesCommission +
    summary.newProductCommission +
    summary.copiedCommission +
    summary.editedCommission +
    summary.commissionTopUpTotal;

  const totalEarnings = summary.baseSalary + summary.transportAllowance + grossCommission + summary.bonusTotal;
  const totalDeductions =
    summary.chamaTotal + summary.latenessTotal + summary.disciplineTotal + summary.otherDeductionsTotal;
  const netPay = totalEarnings - totalDeductions;

  const baseResponse = {
    // canonical/per-receipt helpers for clients to dedupe local receipts
    perReceiptIds: Array.from(dedupedMap.keys()),
    perReceiptCanonicalKeys: Array.from(dedupedMap.values()).map((c) => {
      try {
        const date = c.createdAt ? new Date(c.createdAt) : new Date();
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        const businessDate = `${y}-${m}-${d}`;
        const serial = String(c.rawId ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (serial && serial.length > 0) return `${businessDate}:${serial}`;
        return `ID:${String(c.rawId ?? c.receiptId ?? "")}`;
      } catch (e) {
        return String(c.receiptId ?? c.rawId ?? "");
      }
    }),
    
    ...summary,
    totalSales: combinedSales,
    totalProfit: combinedProfit,
    totalNewProducts: marketingSummary.totals.totalNewProducts,
    totalEditedProducts: marketingSummary.totals.totalEditedProducts,
    totalCopiedProducts: marketingSummary.totals.totalCopiedProducts,
    salesCommission,
    grossCommission,
    totalEarnings,
    totalDeductions,
    netPay,
    totalItems: combinedItems,
    totalReceipts: combinedReceipts,
    walkInsServed: marketingSummary.totals.walkInsServed,
    walkInsPurchased: marketingSummary.totals.walkInsPurchased,
    ledger: ledger
      ? {
          grossCommission: Number(ledger.grossCommission),
          netCommission: Number(ledger.netCommission),
          commissionTotal: Number(ledger.commissionTotal ?? 0),
          penalties: Number(ledger.penalties),
          detail: ledger.detail,
        }
      : null,
  };
  if (debugInfo) {
    return NextResponse.json({ ...baseResponse, debug: debugInfo });
  }
  return NextResponse.json(baseResponse);
}
