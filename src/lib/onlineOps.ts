"use server";

import type { AttendantPayrollAdjustment, PayrollAdjustmentType } from "@prisma/client";
import { Prisma, WeeklySaleStatus } from "@prisma/client";
import type { MarketplaceAssignmentRole } from "@/lib/marketplaceAssignment";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor, type TradingPeriod } from "@/lib/tradingPeriod";
import { getOnlineOpsWindowForTradingPeriod } from "@/lib/onlineOpsWeeks";
import { calculateCumulativeCommission } from "@/lib/commissionCommon";
import { getOrCreateCommissionPeriod, computeProductCommissions } from "@/lib/commission";
import {
  computeBrendahDirectCommission,
  computeOnlinePeriodCommission,
  resolveDirectCommissionMode,
} from "@/lib/onlineCommission";
import { resolveOnlinePosOwnershipMode } from "@/lib/onlineCommission";
import { summarizeMarketingReportsForPeriod } from "@/lib/marketingPeriodTotals";
import { getSupportPeriodAggregates } from "@/lib/supportEntries";
import { getPeriodKeyVariantsFromDates } from "@/lib/payrollPeriodKey";
import { summarizePosReceiptsForPeriod } from "@/lib/posReceiptSummary";
import { resolveShopIdsForMarketplaceAccount } from "@/lib/marketplaceAccountShopResolve";

type AssignmentWithAccount = any;

export type MarketplaceAssignmentSummary = {
  assignments: AssignmentWithAccount[];
  accountIds: string[];
  roles: MarketplaceAssignmentRole[];
};

export type AssignedMarketplaceAccountSales = {
  accountId: string;
  displayName: string | null;
  platform: string;
  payoutSales: number;
  manualSales: number;
  profitEntrySales: number;
  sales: number;
  orders: number;
  shopIds: string[];
};

export type AssignedMarketplaceAccountWeekSales = {
  accountId: string;
  displayName: string | null;
  platform: string;
  weekStart: string;
  weekEnd: string;
  payoutSales: number;
  manualSales: number;
  profitEntrySales: number;
  sales: number;
  orders: number;
  shopIds: string[];
};

export type AssignedMarketplaceSalesSummary = {
  rows: AssignedMarketplaceAccountSales[];
  weeklyRows: AssignedMarketplaceAccountWeekSales[];
  totals: {
    sales: number;
    jumiaSales: number;
    kilimallSales: number;
    orders: number;
  };
};

export type OnlineQuickStats = {
  periodKey: string;
  periodLabel: string;
  receipts: number;
  salesKes: number;
  commissionKes: number;
  commissionSource?: string;
  itemsSold: number;
  directSales: number;
  marketplaceSales: number;
  progressTarget: number;
  nextTierThreshold: number;
  remainingToNextTier: number;
};

export type OnlineEarningsSummary = {
  periodKey: string;
  periodLabel: string;
  attendantCategory?: string | null;
  directSales: number;
  directProfit: number;
  marketplaceSales: number;
  directCommission: number;
  commissionDirect?: number;
  commissionMarketplaceJumia?: number;
  commissionMarketplaceKilimall?: number;
  marketplaceCommission: number;
  supervisorBonus: number;
  returnsDeduction: number;
  grossCommission: number;
  baseSalary: number;
  transportAllowance: number;
  bonusTotal: number;
  commissionTopUpTotal: number;
  chamaTotal: number;
  latenessTotal: number;
  disciplineTotal: number;
  otherDeductionsTotal: number;
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  commissionTotal?: number;
  adjustmentEntries?: Array<{
    id: string;
    label: string;
    amount: number;
    adjustmentType: string;
    adjustmentKind: string;
  }>;
};

const COMMISSION_PROGRESS_TARGET = 2_000_000;
const DIRECT_SALES_TIER_THRESHOLD = 500_000;

type PreferredLedger = Prisma.CommissionLedgerGetPayload<{
  select: {
    id: true;
    grossCommission: true;
    netCommission: true;
    penalties: true;
    commissionTotal: true;
    detail: true;
    createdAt: true;
  };
}> & { commissionTotal: Prisma.Decimal | null };

type ReceiptRecord = {
  sales?: number;
  profit?: number;
  items?: number;
};

type OnlineCommissionBreakdown = ReturnType<typeof computeOnlinePeriodCommission>;

function sumOnlineCommissionLines(
  breakdown: OnlineCommissionBreakdown | null,
  channels: Array<"DIRECT" | "JUMIA" | "KILIMALL">,
) {
  if (!breakdown) return 0;
  return breakdown.lines
    .filter((line) => channels.includes(line.channel as "DIRECT" | "JUMIA" | "KILIMALL"))
    .reduce((sum, line) => sum + Number(line.commission ?? 0), 0);
}

function resolveOnlineCommissionTotal(args: {
  directCommissionMode: string;
  ledger: PreferredLedger | null;
  grossCommission: number;
  brendahComputedCommission: number | null;
}) {
  const ledgerCommissionValue = args.ledger ? Number(args.ledger.commissionTotal ?? 0) : 0;

  if (args.directCommissionMode === "PROFIT_10") {
    return { commissionTotal: args.grossCommission, commissionSourceLabel: "computed-profit10" };
  }
  if (ledgerCommissionValue > 0) {
    return {
      commissionTotal: ledgerCommissionValue,
      commissionSourceLabel: `ledger${args.ledger?.id ? ` (${args.ledger.id})` : ""}`,
    };
  }
  if (args.brendahComputedCommission != null) {
    return { commissionTotal: args.brendahComputedCommission, commissionSourceLabel: "computed-brendah" };
  }
  return { commissionTotal: args.grossCommission, commissionSourceLabel: "computed-gross" };
}

function resolveQuickStatsTierProgress(args: {
  totalTrackedSales: number;
  tiers: Array<{ minSales: number; maxSales: number | null }>;
}) {
  let nextTierThreshold = COMMISSION_PROGRESS_TARGET;
  if (args.tiers.length) {
    const sorted = [...args.tiers].sort((a, b) => a.minSales - b.minSales);
    const upcomingTier = sorted.find((tier) => args.totalTrackedSales < tier.minSales);
    if (upcomingTier) {
      nextTierThreshold = upcomingTier.minSales;
    } else {
      const lastTier = sorted[sorted.length - 1];
      nextTierThreshold = lastTier.maxSales ?? lastTier.minSales;
      if (args.totalTrackedSales > nextTierThreshold) {
        nextTierThreshold = args.totalTrackedSales;
      }
    }
  }
  return {
    nextTierThreshold: nextTierThreshold || COMMISSION_PROGRESS_TARGET,
    remainingToNextTier: Math.max(0, nextTierThreshold - args.totalTrackedSales),
  };
}

function resolveQuickStatsCommissionDisplay(args: {
  earningsCommission: number;
  grossCommission: number;
  ledger: PreferredLedger | null;
}) {
  const ledgerCommission = args.ledger
    ? Number(args.ledger.commissionTotal ?? args.ledger.netCommission ?? args.ledger.grossCommission ?? 0)
    : 0;

  if (args.earningsCommission > 0) {
    return { commissionKesValue: args.earningsCommission, commissionSource: "earnings" };
  }
  if (ledgerCommission > 0) {
    return {
      commissionKesValue: ledgerCommission,
      commissionSource: args.ledger?.id ? `ledger ${args.ledger.id}` : "ledger",
    };
  }
  return { commissionKesValue: args.grossCommission, commissionSource: "computed" };
}

async function computeBrendahCommissionContext(args: {
  attendantId: string;
  period: TradingPeriod;
  commissionTopUpTotal: number;
}) {
  const [marketingSummary, supportSummary] = await Promise.all([
    summarizeMarketingReportsForPeriod({ userId: args.attendantId, period: args.period }),
    getSupportPeriodAggregates({ userId: args.attendantId, period: args.period }),
  ]);

  const marketingPer = (marketingSummary?.perReceipts ?? {}) as Record<string, ReceiptRecord>;
  const supportPer = (supportSummary?.perReceipts ?? {}) as Record<string, ReceiptRecord>;
  const merged = new Map<string, { sales: number; profit: number; items: number }>();
  const normalize = (entry: ReceiptRecord) => ({
    sales: Number(entry.sales ?? 0),
    profit: Number(entry.profit ?? 0),
    items: Number(entry.items ?? 0),
  });

  for (const [key, value] of Object.entries(marketingPer)) {
    merged.set(key, normalize(value));
  }
  for (const [key, value] of Object.entries(supportPer)) {
    const normalized = normalize(value);
    if (merged.has(key)) {
      const existing = merged.get(key)!;
      if ((existing.profit ?? 0) <= 0 && normalized.profit > 0) {
        merged.set(key, normalized);
      }
      continue;
    }
    merged.set(key, normalized);
  }

  let mergedSales = 0;
  let mergedProfit = 0;
  for (const entry of merged.values()) {
    if ((entry.profit ?? 0) <= 0) continue;
    mergedSales += entry.sales;
    mergedProfit += entry.profit;
  }

  const direct = computeBrendahDirectCommission(mergedSales, mergedProfit);
  const marketingTotals = marketingSummary?.totals ?? {};
  const { newProductCommission, copiedCommission, editedCommission } = computeProductCommissions({
    newProducts: marketingTotals.totalNewProducts ?? 0,
    copiedProducts: marketingTotals.totalCopiedProducts ?? 0,
    editedProducts: marketingTotals.totalEditedProducts ?? 0,
  });
  const productCommissionTotal = newProductCommission + copiedCommission + editedCommission;

  return {
    directSalesCommission: direct.amount,
    commissionTotal: direct.amount + productCommissionTotal + args.commissionTopUpTotal,
    mergedSales,
    mergedProfit,
  };
}

const normalizeReceiptNumber = (input: unknown) => {
  if (input == null) return "";
  return String(input).trim().toUpperCase().replace(/[\s\-_]+/g, "").replace(/[^A-Z0-9]/g, "");
};

const extractReceiptSales = (receipt: {
  totals?: Record<string, unknown> | null;
  data?: Record<string, unknown> | null;
  order?: { totalAmount?: number | null } | null;
}) => {
  const totals = receipt.totals ?? {};
  const data = receipt.data ?? {};
  const candidates = [
    (totals as any).total,
    (totals as any).sellingTotal,
    (totals as any).grandTotal,
    (totals as any).amount,
    (totals as any).subtotal,
    (data as any).total,
    (data as any).amount,
    receipt.order?.totalAmount,
  ];
  for (const value of candidates) {
    const num = Number(value ?? 0);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return 0;
};

export async function computeProfit10DirectProfitFallback(args: {
  userId: string;
  start: Date;
  end: Date;
}) {
  const receipts = await prisma.receipt.findMany({
    where: {
      AND: [
        {
          OR: [
            { generatedAt: { gte: args.start, lte: args.end } },
            { createdAt: { gte: args.start, lte: args.end } },
          ],
        },
        {
          OR: [
            { issuedById: args.userId },
            { order: { attendantId: args.userId } },
            { data: { path: ["attendantId"], equals: args.userId } },
          ],
        },
      ],
    },
    select: {
      receiptNumber: true,
      generatedAt: true,
      createdAt: true,
      totals: true,
      data: true,
      order: {
        select: {
          orderNumber: true,
          paymentStatus: true,
          totalAmount: true,
          attendantId: true,
        },
      },
    },
  });

  const paidReceipts = receipts.filter((receipt) => {
    const paymentStatus = String(receipt.order?.paymentStatus ?? "").trim().toUpperCase();
    return paymentStatus === "PAID";
  });

  const receiptMeta = paidReceipts.map((receipt) => {
    const salesDate = receipt.generatedAt ?? receipt.createdAt ?? args.start;
    const canonical =
      normalizeReceiptNumber(receipt.order?.orderNumber) ||
      normalizeReceiptNumber(receipt.receiptNumber) ||
      normalizeReceiptNumber((receipt.data as Record<string, unknown> | null)?.orderRef);
    const ymd = salesDate.toISOString().slice(0, 10);
    return {
      canonical,
      receiptKey: canonical ? `${ymd}:${canonical}` : "",
      sales: extractReceiptSales(receipt as any),
    };
  });

  const canonicalNumbers = Array.from(new Set(receiptMeta.map((item) => item.canonical).filter(Boolean)));
  const receiptKeys = Array.from(new Set(receiptMeta.map((item) => item.receiptKey).filter(Boolean)));
  if (!canonicalNumbers.length && !receiptKeys.length) return 0;

  const supportReceipts = await prisma.supportReceipt.findMany({
    where: {
      OR: [
        ...(canonicalNumbers.length ? [{ receiptNumber: { in: canonicalNumbers } }] : []),
        ...(receiptKeys.length ? [{ receiptKey: { in: receiptKeys } }] : []),
      ],
    },
    select: {
      receiptNumber: true,
      receiptKey: true,
      buyingTotal: true,
      items: {
        select: {
          buyingPrice: true,
        },
      },
    },
  });

  const buyingByCanonical = new Map<string, number>();
  for (const row of supportReceipts) {
    const itemBuyingTotal = Array.isArray(row.items)
      ? row.items.reduce((sum, item) => sum + Number(item.buyingPrice ?? 0), 0)
      : 0;
    const buyingTotal = Math.max(Number(row.buyingTotal ?? 0), itemBuyingTotal);
    if (!(buyingTotal > 0)) continue;
    const keys = [
      normalizeReceiptNumber(row.receiptNumber),
      normalizeReceiptNumber(row.receiptKey),
      normalizeReceiptNumber(String(row.receiptKey ?? "").split(":").pop() ?? ""),
    ].filter(Boolean);
    for (const key of keys) {
      if (!buyingByCanonical.has(key)) buyingByCanonical.set(key, buyingTotal);
    }
  }

  return receiptMeta.reduce((sum, receipt) => {
    if (!receipt.canonical || receipt.sales <= 0) return sum;
    const buyingTotal = Number(buyingByCanonical.get(receipt.canonical) ?? 0);
    if (!(buyingTotal > 0)) return sum;
    return sum + (receipt.sales - buyingTotal);
  }, 0);
}

function money(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function normalize(value: unknown): string {
  return String(value ?? "").trim();
}

function summarizeProfitRows(
  rows: Array<{ itemCreditTxn: string; netPayout: number }>,
): { net: number; orderCount: number } {
  let net = 0;
  let orderCount = 0;
  const seen = new Set<string>();
  for (const row of rows) {
    const txn = normalize(row.itemCreditTxn).toLowerCase();
    if (txn) {
      if (seen.has(txn)) continue;
      seen.add(txn);
    }
    net += money(row.netPayout);
    orderCount += 1;
  }
  return { net, orderCount };
}

function collectAssignmentWeekKeys(args: {
  accountId: string;
  shopIds: string[];
  manualByShopIdWeek: Map<string, { sales: number; orders: number }>;
  profitRowsByAccountWeek: Map<string, Array<{ itemCreditTxn: string; netPayout: number }>>;
}) {
  const weekKeys = new Set<string>();

  for (const key of args.profitRowsByAccountWeek.keys()) {
    if (key.startsWith(`${args.accountId}::`)) weekKeys.add(key);
  }
  for (const shopId of args.shopIds) {
    for (const key of args.manualByShopIdWeek.keys()) {
      if (key.startsWith(`${shopId}::`)) {
        weekKeys.add(`${args.accountId}::${key.split("::")[1]}`);
      }
    }
  }

  return Array.from(weekKeys).sort();
}

function summarizeManualWeekSales(args: {
  shopIds: string[];
  weekStartIso: string;
  manualByShopIdWeek: Map<string, { sales: number; orders: number }>;
}) {
  return args.shopIds.reduce(
    (acc, shopId) => {
      const stats = args.manualByShopIdWeek.get(`${shopId}::${args.weekStartIso}`) ?? { sales: 0, orders: 0 };
      acc.sales += stats.sales;
      acc.orders += stats.orders;
      return acc;
    },
    { sales: 0, orders: 0 },
  );
}

function buildAssignedMarketplaceAccountRows(args: {
  assignment: AssignmentWithAccount;
  shopIds: string[];
  manualByShopIdWeek: Map<string, { sales: number; orders: number }>;
  profitRowsByAccountWeek: Map<string, Array<{ itemCreditTxn: string; netPayout: number }>>;
}) {
  const weeklyRows: AssignedMarketplaceAccountWeekSales[] = [];
  const totals = { payoutSales: 0, manualSales: 0, profitEntrySales: 0, sales: 0, orders: 0 };
  const sortedWeekKeys = collectAssignmentWeekKeys({
    accountId: args.assignment.accountId,
    shopIds: args.shopIds,
    manualByShopIdWeek: args.manualByShopIdWeek,
    profitRowsByAccountWeek: args.profitRowsByAccountWeek,
  });

  for (const key of sortedWeekKeys) {
    const weekStartIso = key.split("::")[1];
    const profitSummary = summarizeProfitRows(args.profitRowsByAccountWeek.get(key) ?? []);
    const manual = summarizeManualWeekSales({
      shopIds: args.shopIds,
      weekStartIso,
      manualByShopIdWeek: args.manualByShopIdWeek,
    });
    const sales = profitSummary.net > 0 ? profitSummary.net : manual.sales;
    const orders = profitSummary.orderCount > 0 ? profitSummary.orderCount : manual.orders;

    totals.manualSales += manual.sales;
    totals.profitEntrySales += profitSummary.net;
    totals.sales += sales;
    totals.orders += orders;

    weeklyRows.push({
      accountId: args.assignment.accountId,
      displayName: args.assignment.account?.displayName ?? null,
      platform: String(args.assignment.account?.platform ?? "UNKNOWN").toUpperCase(),
      weekStart: weekStartIso,
      weekEnd: new Date(new Date(weekStartIso).getTime() + 7 * 24 * 3600 * 1000 - 1).toISOString(),
      payoutSales: 0,
      manualSales: manual.sales,
      profitEntrySales: profitSummary.net,
      sales,
      orders,
      shopIds: args.shopIds,
    });
  }

  const row: AssignedMarketplaceAccountSales = {
    accountId: args.assignment.accountId,
    displayName: args.assignment.account?.displayName ?? null,
    platform: String(args.assignment.account?.platform ?? "UNKNOWN").toUpperCase(),
    payoutSales: totals.payoutSales,
    manualSales: totals.manualSales,
    profitEntrySales: totals.profitEntrySales,
    sales: totals.sales,
    orders: totals.orders,
    shopIds: args.shopIds,
  };

  return { row, weeklyRows };
}

let marketplaceProfitEntryTableAvailable: Promise<boolean> | null = null;

async function isMarketplaceProfitEntryTableAvailable(): Promise<boolean> {
  if (marketplaceProfitEntryTableAvailable) return marketplaceProfitEntryTableAvailable;
  marketplaceProfitEntryTableAvailable = (async () => {
    try {
      await (prisma as any).marketplaceProfitEntry.findFirst({ select: { id: true } });
      return true;
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
        return false;
      }
      return false;
    }
  })();
  return marketplaceProfitEntryTableAvailable;
}

export async function findPreferredCommissionLedger(
  userId: string,
  period: TradingPeriod,
): Promise<PreferredLedger | null> {
  const windowMs = 24 * 60 * 60 * 1000;
  const exact = await prisma.commissionLedger.findUnique({
    where: {
      userId_periodStart_periodEnd: {
        userId,
        periodStart: period.start,
        periodEnd: period.end,
      },
    },
    select: {
      id: true,
      grossCommission: true,
      netCommission: true,
      penalties: true,
      commissionTotal: true,
      detail: true,
      createdAt: true,
    },
  });
  if (exact) return exact;

  const nearPositive = await prisma.commissionLedger.findFirst({
    where: {
      userId,
      periodStart: {
        gte: new Date(period.start.getTime() - windowMs),
        lte: new Date(period.start.getTime() + windowMs),
      },
      commissionTotal: { gt: 0 },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      grossCommission: true,
      netCommission: true,
      penalties: true,
      commissionTotal: true,
      detail: true,
      createdAt: true,
    },
  });
  if (nearPositive) return nearPositive;

  const near = await prisma.commissionLedger.findFirst({
    where: {
      userId,
      periodStart: {
        gte: new Date(period.start.getTime() - windowMs),
        lte: new Date(period.start.getTime() + windowMs),
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      grossCommission: true,
      netCommission: true,
      penalties: true,
      commissionTotal: true,
      detail: true,
      createdAt: true,
    },
  });
  return near;
}

export async function getMarketplaceAssignmentsForUser(attendantId: string): Promise<MarketplaceAssignmentSummary> {
  const now = new Date();
  const assignmentRows = await prisma.marketplaceAccountAssignment.findMany({
    where: {
      attendantId,
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      accountId: true,
      attendantId: true,
      role: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const accountIds = Array.from(new Set(assignmentRows.map((assignment) => assignment.accountId)));
  const accounts = accountIds.length
    ? await prisma.marketplaceAccount.findMany({
        where: { id: { in: accountIds } },
        select: {
          id: true,
          platform: true,
          displayName: true,
          countryCode: true,
          currency: true,
          jumiaShopSid: true,
          kilimallShopCode: true,
          isActive: true,
        },
      })
    : [];
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const assignments = assignmentRows.map((assignment) => ({
    ...assignment,
    account: accountsById.get(assignment.accountId) ?? null,
  }));
  return {
    assignments,
    accountIds,
    roles: assignments.map((a) => a.role),
  };
}

export async function getAssignedMarketplaceSalesForPeriod(
  attendantId: string,
  period: TradingPeriod,
): Promise<AssignedMarketplaceSalesSummary> {
  const { assignments } = await getMarketplaceAssignmentsForUser(attendantId);
  const uniqueAssignments = assignments.filter(
    (assignment, index, all) => all.findIndex((candidate) => candidate.accountId === assignment.accountId) === index,
  );
  if (!uniqueAssignments.length) {
    return {
      rows: [],
      weeklyRows: [],
      totals: { sales: 0, jumiaSales: 0, kilimallSales: 0, orders: 0 },
    };
  }

  const shopIdsByAccount = new Map<string, string[]>();
  for (const assignment of uniqueAssignments) {
    const shopIds = await resolveShopIdsForMarketplaceAccount(assignment.accountId);
    shopIdsByAccount.set(assignment.accountId, Array.from(new Set(shopIds.filter(Boolean))));
  }

  const allShopIds = Array.from(
    new Set(Array.from(shopIdsByAccount.values()).flatMap((shopIds) => shopIds)),
  );
  const manualRows = allShopIds.length
    ? await prisma.weeklySale.findMany({
        where: {
          shopId: { in: allShopIds },
          AND: [{ weekEnd: { gte: period.start } }, { weekStart: { lte: period.end } }],
        },
        select: {
          shopId: true,
          amount: true,
          weekStart: true,
          weekEnd: true,
          platform: true,
          status: true,
        },
      })
    : [];
  const manualByShopIdWeek = new Map<string, { sales: number; orders: number }>();
  for (const row of manualRows) {
    if (String(row.status ?? "").toUpperCase() === "REJECTED") continue;
    const shopId = String(row.shopId ?? "").trim();
    if (!shopId) continue;
    const weekKey = `${shopId}::${new Date(row.weekStart).toISOString()}`;
    const current = manualByShopIdWeek.get(weekKey) ?? { sales: 0, orders: 0 };
    current.sales += Number(row.amount ?? 0);
    current.orders += 1;
    manualByShopIdWeek.set(weekKey, current);
  }

  const accountIds = uniqueAssignments.map((assignment) => assignment.accountId);
  const profitEntryTableAvailable = await isMarketplaceProfitEntryTableAvailable();
  const profitEntryRows =
    profitEntryTableAvailable && accountIds.length
      ? await (prisma as any).marketplaceProfitEntry.findMany({
          where: {
            accountId: { in: accountIds },
            weekStart: { lte: period.end },
            weekEnd: { gte: period.start },
          },
          select: {
            accountId: true,
            weekStart: true,
            itemCreditTxn: true,
            netPayout: true,
          },
          take: 30000,
        })
      : [];

  const profitRowsByAccountWeek = new Map<string, Array<{ itemCreditTxn: string; netPayout: number }>>();
  for (const row of profitEntryRows as any[]) {
    const key = `${String(row.accountId)}::${new Date(row.weekStart).toISOString()}`;
    if (!profitRowsByAccountWeek.has(key)) {
      profitRowsByAccountWeek.set(key, []);
    }
    profitRowsByAccountWeek.get(key)!.push({
      itemCreditTxn: String(row.itemCreditTxn ?? ""),
      netPayout: money(row.netPayout),
    });
  }

  const accountSummaries = uniqueAssignments.map((assignment) =>
    buildAssignedMarketplaceAccountRows({
      assignment,
      shopIds: shopIdsByAccount.get(assignment.accountId) ?? [],
      manualByShopIdWeek,
      profitRowsByAccountWeek,
    }),
  );
  const rows = accountSummaries.map((summary) => summary.row);
  const weeklyRows = accountSummaries.flatMap((summary) => summary.weeklyRows);

  const totals = rows.reduce(
    (acc, row) => {
      acc.sales += row.sales;
      acc.orders += row.orders;
      if (row.platform === "JUMIA") acc.jumiaSales += row.sales;
      if (row.platform === "KILIMALL") acc.kilimallSales += row.sales;
      return acc;
    },
    { sales: 0, jumiaSales: 0, kilimallSales: 0, orders: 0 },
  );

  return { rows, weeklyRows, totals };
}

export async function getOnlineQuickStats(attendantId: string, opts?: { period?: TradingPeriod }): Promise<OnlineQuickStats> {
  const period = opts?.period ?? getTradingPeriodFor(new Date());
  const marketplaceWindow = getOnlineOpsWindowForTradingPeriod(period, period.end, 4);
  const [directStats, marketplaceSalesSummary, earnings, commissionConfig] = await Promise.all([
    getDirectSalesStats(attendantId, period),
    getAssignedMarketplaceSalesForPeriod(attendantId, {
      key: marketplaceWindow.key,
      label: marketplaceWindow.label,
      start: marketplaceWindow.start,
      end: marketplaceWindow.end,
    }),
    getOnlineEarningsSummary(attendantId, { period }),
    getOrCreateCommissionPeriod(period.start),
  ]);

  const ledger = await findPreferredCommissionLedger(attendantId, period);

  const marketplaceSales = marketplaceSalesSummary.totals.sales;
  const totalTrackedSales = directStats.sales + marketplaceSales;

  const { nextTierThreshold, remainingToNextTier } = resolveQuickStatsTierProgress({
    totalTrackedSales,
    tiers: (commissionConfig?.tiers ?? []).map((tier) => ({
      minSales: tier.minSales,
      maxSales: tier.maxSales ?? null,
    })),
  });
  const { commissionKesValue, commissionSource } = resolveQuickStatsCommissionDisplay({
    earningsCommission: Number(earnings.commissionTotal ?? 0),
    grossCommission: earnings.grossCommission,
    ledger,
  });

  console.info(
    `[onlineQuickStats] user=${attendantId} period=${period.key} ledger=${ledger?.id ?? "none"} source=${commissionSource} value=${commissionKesValue.toFixed(
      2,
    )}`,
  );

  return {
    periodKey: period.key,
    periodLabel: period.label,
    receipts: directStats.receipts,
    salesKes: totalTrackedSales,
    commissionKes: commissionKesValue,
    commissionSource,
    itemsSold: directStats.items + marketplaceSalesSummary.totals.orders,
    directSales: directStats.sales,
    marketplaceSales,
    progressTarget: nextTierThreshold,
    nextTierThreshold,
    remainingToNextTier,
  };
}

export async function getOnlineEarningsSummary(attendantId: string, opts?: { period?: TradingPeriod }): Promise<OnlineEarningsSummary> {
  const period = opts?.period ?? getTradingPeriodFor(new Date());
  const marketplaceWindow = getOnlineOpsWindowForTradingPeriod(period, period.end, 4);
  const { roles } = await getMarketplaceAssignmentsForUser(attendantId);

  const [directStats, marketplaceSalesSummary, plan, adjustments, returns, user] = await Promise.all([
    getDirectSalesStats(attendantId, period),
    getAssignedMarketplaceSalesForPeriod(attendantId, {
      key: marketplaceWindow.key,
      label: marketplaceWindow.label,
      start: marketplaceWindow.start,
      end: marketplaceWindow.end,
    }),
    prisma.attendantCompPlan.findUnique({ where: { attendantId } }),
    prisma.attendantPayrollAdjustment.findMany({
      where: { attendantId, periodKey: { in: getPeriodKeyVariantsFromDates(period.start, period.end) } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    prisma.marketplaceReturn.findMany({
      where: {
        attendantId,
        status: "CHARGED_TO_ATTENDANT",
        dueAt: { gte: period.start, lte: period.end },
      },
    }),
    prisma.user.findUnique({ where: { id: attendantId }, select: { email: true, attendantCategory: true } }),
  ]);

  const payoutJumiaSales = marketplaceSalesSummary.totals.jumiaSales;
  const payoutKilimallSales = marketplaceSalesSummary.totals.kilimallSales;
  const marketplaceSales = marketplaceSalesSummary.totals.sales;
  const combinedDirectSales = directStats.sales;
  const combinedDirectProfit = directStats.profit;

  const isSupervisor = roles.includes("SUPERVISOR");
  const returnsDeduction = returns.reduce((sum, entry) => sum + Number(entry.expectedAmount ?? 0), 0);

  const summed = sumAdjustments(adjustments);
  const directCommissionMode = resolveDirectCommissionMode(user?.email);
  const isBrendah = directCommissionMode === "BRENDAH";
  const fallbackDirectProfit =
    directCommissionMode === "PROFIT_10" &&
    Number(directStats.sales ?? 0) > 0 &&
    Number(directStats.profit ?? 0) <= 0
      ? await computeProfit10DirectProfitFallback({ userId: attendantId, start: period.start, end: period.end })
      : 0;
  const effectiveDirectProfit =
    directCommissionMode === "PROFIT_10" && fallbackDirectProfit > 0
      ? fallbackDirectProfit
      : directStats.profit;
  const profit10Commission =
    directCommissionMode === "PROFIT_10"
      ? computeOnlinePeriodCommission(
          {
            attendantId,
            periodStart: period.start,
            periodEnd: period.end,
            directSales: directStats.sales,
            directProfit: effectiveDirectProfit,
            jumiaSales: payoutJumiaSales,
            kilimallSales: payoutKilimallSales,
          },
          { directCommissionMode },
        )
      : null;
  const marketplaceCommission =
    profit10Commission != null
      ? sumOnlineCommissionLines(profit10Commission, ["JUMIA", "KILIMALL"])
      : calculateCumulativeCommission(Math.max(0, marketplaceSales)).commission;
  const marketplaceCommissionJumia =
    profit10Commission != null
      ? sumOnlineCommissionLines(profit10Commission, ["JUMIA"])
      : calculateCumulativeCommission(Math.max(0, payoutJumiaSales)).commission;
  const marketplaceCommissionKilimall =
    profit10Commission != null
      ? sumOnlineCommissionLines(profit10Commission, ["KILIMALL"])
      : calculateCumulativeCommission(Math.max(0, payoutKilimallSales)).commission;
  const supervisorBonus = isSupervisor ? computeSupervisorBonus(marketplaceSales) : 0;

  let directSalesCommission: number;
  let brendahComputedCommission: number | null = null;
  let brendahMergedSales = 0;
  let brendahMergedProfit = 0;

  if (isBrendah) {
    const brendahContext = await computeBrendahCommissionContext({
      attendantId,
      period,
      commissionTopUpTotal: summed.commissionTopUpTotal,
    });
    directSalesCommission = brendahContext.directSalesCommission;
    brendahComputedCommission = brendahContext.commissionTotal;
    brendahMergedSales = brendahContext.mergedSales;
    brendahMergedProfit = brendahContext.mergedProfit;
  } else {
    directSalesCommission =
      directCommissionMode === "PROFIT_10"
        ? sumOnlineCommissionLines(profit10Commission, ["DIRECT"])
        : combinedDirectSales < DIRECT_SALES_TIER_THRESHOLD
          ? Math.max(0, Math.round(combinedDirectProfit * 0.05))
          : calculateCumulativeCommission(Math.max(0, combinedDirectSales)).commission;
  }

  const grossCommission = directSalesCommission + marketplaceCommission + supervisorBonus - returnsDeduction;
  const baseSalary = plan?.baseSalary ?? 0;
  const transportAllowance = plan?.defaultTransportAllowance ?? 0;

  const totalEarnings = baseSalary + transportAllowance + grossCommission + summed.bonusTotal + summed.commissionTopUpTotal;
  const totalDeductions = summed.chamaTotal + summed.latenessTotal + summed.disciplineTotal + summed.otherDeductionsTotal;
  const netPay = totalEarnings - totalDeductions;

  const ledger = await findPreferredCommissionLedger(attendantId, period);
  const { commissionTotal, commissionSourceLabel } = resolveOnlineCommissionTotal({
    directCommissionMode,
    ledger,
    grossCommission,
    brendahComputedCommission: isBrendah ? brendahComputedCommission : null,
  });

  const brendahDebug = isBrendah ? ` dedupSales=${brendahMergedSales} dedupProfit=${brendahMergedProfit}` : "";
  console.info(
    `[onlineEarningsSummary] user=${attendantId} period=${period.key} ledger=${ledger?.id ?? "none"} source=${commissionSourceLabel} total=${commissionTotal.toFixed(
      2,
    )}${brendahDebug}`,
  );

  const adjustmentEntries = adjustments.map((adjustment) => ({
    id: adjustment.id,
    label: String(adjustment.label ?? adjustment.adjustmentType ?? "Adjustment"),
    amount: Number(adjustment.amount ?? 0),
    adjustmentType: String(adjustment.adjustmentType ?? "OTHER"),
    adjustmentKind: String(
      adjustment.adjustmentKind ??
        (adjustment.adjustmentType === "BONUS" || adjustment.adjustmentType === "COMMISSION_TOPUP"
          ? "ADDITION"
          : "DEDUCTION"),
    ).toUpperCase(),
  }));

  return {
    periodKey: period.key,
    periodLabel: period.label,
    attendantCategory: user?.attendantCategory ?? null,
    directSales: directCommissionMode === "PROFIT_10" ? directStats.sales : combinedDirectSales,
    directProfit: directCommissionMode === "PROFIT_10" ? effectiveDirectProfit : directStats.profit,
    marketplaceSales,
    directCommission: directSalesCommission,
    commissionDirect: directSalesCommission,
    commissionMarketplaceJumia: marketplaceCommissionJumia,
    commissionMarketplaceKilimall: marketplaceCommissionKilimall,
    marketplaceCommission,
    supervisorBonus,
    returnsDeduction,
    grossCommission,
    baseSalary,
    transportAllowance,
    bonusTotal: summed.bonusTotal,
    commissionTopUpTotal: summed.commissionTopUpTotal,
    chamaTotal: summed.chamaTotal,
    latenessTotal: summed.latenessTotal,
    disciplineTotal: summed.disciplineTotal,
    otherDeductionsTotal: summed.otherDeductionsTotal,
    totalEarnings,
    totalDeductions,
    netPay,
    commissionTotal,
    adjustmentEntries,
  };
}

async function getDirectSalesStats(attendantId: string, period: TradingPeriod) {
  const user = await prisma.user.findUnique({ where: { id: attendantId }, select: { email: true } });
  const posSummary = await summarizePosReceiptsForPeriod({
    start: period.start,
    end: period.end,
    userId: attendantId,
    ownershipMode: resolveOnlinePosOwnershipMode(user?.email),
    supportPricingScope: "any",
    profitRecognitionMode: "salesDate",
  });

  return {
    sales: Number(posSummary.totalSales ?? 0),
    profit: Number(posSummary.totalProfit ?? 0),
    receipts: Number(posSummary.totalReceipts ?? 0),
    items: Number(posSummary.totalItems ?? 0),
  };
}

async function getWeeklyManualSales(attendantId: string, period: TradingPeriod) {
  const [summary, byPlatform] = await Promise.all([
    prisma.weeklySale.aggregate({
      _sum: { amount: true },
      _count: { _all: true },
      where: {
        userId: attendantId,
        status: WeeklySaleStatus.APPROVED,
        AND: [{ weekEnd: { gte: period.start } }, { weekStart: { lte: period.end } }],
      },
    }),
    prisma.weeklySale.groupBy({
      by: ["platform"],
      _sum: { amount: true },
      where: {
        userId: attendantId,
        status: WeeklySaleStatus.APPROVED,
        AND: [{ weekEnd: { gte: period.start } }, { weekStart: { lte: period.end } }],
      },
    }),
  ]);

  const jumiaSales = byPlatform
    .filter((row) => String(row.platform).toUpperCase() === "JUMIA")
    .reduce((sum, row) => sum + Number(row._sum?.amount ?? 0), 0);
  const kilimallSales = byPlatform
    .filter((row) => String(row.platform).toUpperCase() === "KILIMALL")
    .reduce((sum, row) => sum + Number(row._sum?.amount ?? 0), 0);

  const entries =
    typeof summary._count === "number" ? summary._count : summary._count?._all ?? 0;

  return {
    totalSales: Number(summary._sum?.amount ?? 0),
    entries,
    jumiaSales,
    kilimallSales,
  };
}

function sumAdjustments(adjustments: AttendantPayrollAdjustment[]): {
  bonusTotal: number;
  commissionTopUpTotal: number;
  chamaTotal: number;
  latenessTotal: number;
  disciplineTotal: number;
  otherDeductionsTotal: number;
} {
  const sum = (types: PayrollAdjustmentType[]) =>
    adjustments
      .filter((a) => types.includes(a.adjustmentType))
      .reduce((acc, a) => acc + (a.amount ?? 0), 0);

  return {
    bonusTotal: sum(["BONUS"]),
    commissionTopUpTotal: sum(["COMMISSION_TOPUP"]),
    chamaTotal: sum(["CHAMA"]),
    latenessTotal: sum(["LATENESS"]),
    disciplineTotal: sum(["DISCIPLINE"]),
    otherDeductionsTotal: sum(["OTHER"]),
  };
}

function computeSupervisorBonus(totalSales: number) {
  if (totalSales < 10_000_000) return 0;
  const millions = Math.floor(totalSales / 1_000_000);
  const over = Math.max(0, millions - 9);
  return over * 10_000;
}

