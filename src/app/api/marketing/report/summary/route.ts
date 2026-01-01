import { NextResponse } from "next/server";
import { requireRole, getActorId } from "@/lib/api";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { getCurrentTradingPeriodFor } from "@/lib/marketingPeriod";
import { summarizeMarketingReportsForPeriod } from "@/lib/marketingPeriodTotals";
import { getSupportPeriodAggregates } from "@/lib/supportEntries";
import { computeSalesCommissionFromTiers, getOrCreateCommissionPeriod } from "@/lib/commission";
import { getCommissionSummaryForSales } from "@/lib/marketingCommission";
import { getUnpricedDailySalesForCurrentPeriod } from "@/lib/marketingUnpricedSales";
import { prisma } from "@/lib/prisma";
import { nowInNairobi } from "@/lib/timezone";
import { summarizePosReceiptsForPeriod, type PosReceiptSummary } from "@/lib/posReceiptSummary";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  // debug gate: add ?debug=1 to get diagnostic info (no change to payload when off)
  const debug = url.searchParams.get("debug") === "1";
  const impersonateId = url.searchParams.get("impersonateId");
  const actorId = await getActorId();
  const targetUserId =
    impersonateId && auth.role === "ADMIN" ? impersonateId : actorId;
  if (!targetUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { email: true, name: true },
  });
  const targetUserEmail = targetUser?.email?.toLowerCase() ?? null;
  const targetUserName = targetUser?.name ?? null;
  const isJeniffer = targetUserEmail === "jeniffer@betech.co.ke";

  const today = nowInNairobi();
  const { tiers } = await getOrCreateCommissionPeriod(today);
  const current = await getCurrentTradingPeriodFor(today);

  let argPeriod: {
    start: Date;
    end: Date;
    key: string;
    label: string;
  } = {
    start: current.startDate,
    end: current.endDate,
    key: current.key,
    label: current.label,
  };

  if (!(today >= argPeriod.start && today <= argPeriod.end)) {
    const fallback = getTradingPeriodFor(today);
    argPeriod = {
      start: fallback.start,
      end: fallback.end,
      key: fallback.key,
      label: fallback.label,
    };
  }

  const [marketingSummary, supportSummary] = await Promise.all([
    summarizeMarketingReportsForPeriod({ userId: targetUserId, period: argPeriod }),
    getSupportPeriodAggregates({ userId: targetUserId, period: argPeriod }),
  ]);

  const marketingTotals = marketingSummary?.totals ?? {
    totalSales: 0,
    totalProfit: 0,
    totalReceipts: 0,
    totalItems: 0,
    totalNewProducts: 0,
    totalEditedProducts: 0,
    totalCopiedProducts: 0,
    walkInsServed: 0,
    walkInsPurchased: 0,
    paymentStats: { totalSalesMpesa: 0, totalSalesCash: 0, countMpesaReceipts: 0, countCashReceipts: 0 },
  };

  const supportAggregates = supportSummary?.aggregates ?? {
    totalSales: 0,
    totalProfit: 0,
    totalReceipts: 0,
    totalItems: 0,
    newBatteries: 0,
    changedBatteries: 0,
    paymentStats: { totalSalesMpesa: 0, totalSalesCash: 0, countMpesaReceipts: 0, countCashReceipts: 0 },
  };

  // per-receipt maps returned by the summarizers (keyed by canonical receipt id)
  const marketingPer = (marketingSummary as any)?.perReceipts ?? {};
  const supportPer = (supportSummary as any)?.perReceipts ?? {};

  let totalSales = 0;
  let totalProfit = 0;
  let totalItems = 0;
  let totalReceipts = 0;
  let mergedPaymentStats = { totalSalesMpesa: 0, totalSalesCash: 0, countMpesaReceipts: 0, countCashReceipts: 0 };
  let posSummary: PosReceiptSummary | null = null;
  if (isJeniffer) {
    posSummary = await summarizePosReceiptsForPeriod({ start: argPeriod.start, end: argPeriod.end });
    totalSales = posSummary.totalSales;
    totalProfit = posSummary.totalProfit;
    totalItems = posSummary.totalItems;
    totalReceipts = posSummary.totalReceipts;
    mergedPaymentStats = posSummary.paymentStats;
  } else {
    // Merge with precedence: MARKETING > SUPPORT
    const merged = new Map<string, { sales: number; profit: number; items: number; mpesa: number; cash: number }>();

    for (const [k, v] of Object.entries(marketingPer) as [string, any][]) {
      merged.set(k, { sales: v.sales ?? 0, profit: v.profit ?? 0, items: v.items ?? 0, mpesa: v.mpesa ?? 0, cash: v.cash ?? 0 });
    }

    for (const [k, v] of Object.entries(supportPer) as [string, any][]) {
      if (merged.has(k)) continue; // marketing wins
      merged.set(k, { sales: v.sales ?? 0, profit: v.profit ?? 0, items: v.items ?? 0, mpesa: v.mpesa ?? 0, cash: v.cash ?? 0 });
    }

    for (const [, v] of merged) {
      totalSales += v.sales;
      totalProfit += v.profit;
      totalItems += v.items;
      mergedPaymentStats.totalSalesMpesa += v.mpesa;
      mergedPaymentStats.totalSalesCash += v.cash;
      if (v.mpesa > 0) mergedPaymentStats.countMpesaReceipts += 1;
      if (v.cash > 0) mergedPaymentStats.countCashReceipts += 1;
    }
    totalReceipts = merged.size;
  }

  let commission = 0;
  if (isJeniffer && posSummary) {
    commission = computeSalesCommissionFromTiers(
      posSummary.totalSales,
      posSummary.totalProfit,
      tiers,
      0,
    );
  } else if (totalSales > 0) {
    commission = computeSalesCommissionFromTiers(totalSales, totalProfit, tiers);
  }

  try {
    if (targetUserEmail) {
      const unpriced = await getUnpricedDailySalesForCurrentPeriod();
      const hasUnpricedForUser = unpriced.some(
        (s) => (s.attendantEmail ?? "").toLowerCase() === targetUserEmail,
      );
      if (hasUnpricedForUser) {
        commission = 0;
      }
    }
  } catch {
    // ignore
  }

  if (!isJeniffer) {
    try {
      const ledger = await prisma.commissionLedger.findUnique({
        where: {
          userId_periodStart_periodEnd: {
            userId: targetUserId,
            periodStart: argPeriod.start,
            periodEnd: argPeriod.end,
          },
        },
      });

      if (ledger) {
        const detail: any = ledger.detail ?? {};
        const marketingCommission = Number(detail.marketing?.commission ?? 0);
        const supportCommission = Number(detail.support?.commission ?? 0);
        const combinedDetailCommission = marketingCommission + supportCommission;

        if (combinedDetailCommission > 0) {
          commission = combinedDetailCommission;
        } else {
          const ledgerNet = Number(
            ledger.netCommission ?? ledger.grossCommission ?? commission,
          );
          commission = Number.isFinite(ledgerNet) ? ledgerNet : commission;
        }
      }
    } catch {
      // ignore
    }
  }

  // base response
  const payload: any = {
    period: {
      key: String(argPeriod.key ?? ""),
      label: String(argPeriod.label ?? ""),
      start: argPeriod.start.toISOString(),
      end: argPeriod.end.toISOString(),
    },
    aggregates: {
      totalSales,
      totalReceipts,
      totalItems,
      paymentStats: mergedPaymentStats,
      commission: { commission },
    },
  };

  // When debug=1, attach identity proof and contribution audits
  if (debug) {
    // identity proof (include name/email and server time)
    const identity = {
      authRole: auth.role,
      actorId,
      impersonateId,
      targetUserId,
      targetUserEmail,
      impersonationHonored: Boolean(impersonateId && auth.role === "ADMIN"),
      serverNowISO: new Date().toISOString(),
    };

    // MARKETING audit
    const marketingPer = (marketingSummary as any)?.perReceipts ?? {};
    const marketingKeys = Object.keys(marketingPer || {});
    let marketingReceipts: any[] = [];
    // count marketing receipts in period for this target (by submittedById/email/name when available)
    const marketingCount = await prisma.marketingReceipt.count({
      where: {
        createdAt: { gte: argPeriod.start, lte: argPeriod.end },
        OR: [
          { dailyEntry: { submittedById: targetUserId } },
          ...(targetUserEmail ? [{ dailyEntry: { submittedByEmail: targetUserEmail } }] : []),
          ...(targetUserName ? [{ dailyEntry: { submittedByName: targetUserName } }] : []),
        ],
      },
    });
    if (marketingKeys.length > 0) {
      marketingReceipts = await prisma.marketingReceipt.findMany({
        where: { receiptKey: { in: marketingKeys } },
        select: {
          id: true,
          receiptNumber: true,
          receiptKey: true,
          createdAt: true,
          sellingTotal: true,
          buyingTotal: true,
          dailyEntry: { select: { submittedById: true, submittedByEmail: true, submittedByName: true } },
        },
      });
    }

    const marketingOwners = new Set<string>();
    const marketingOwnerEmails = new Set<string>();
    const marketingRecords = marketingReceipts.map((r) => {
      const ownerId = r.dailyEntry?.submittedById ?? null;
      const ownerEmail = r.dailyEntry?.submittedByEmail ?? null;
      if (ownerId) marketingOwners.add(ownerId);
      if (ownerEmail) marketingOwnerEmails.add(String(ownerEmail).toLowerCase());
      return {
        id: r.id,
        receiptNumber: r.receiptNumber,
        receiptKey: r.receiptKey,
        createdAt: r.createdAt,
        sellingTotal: r.sellingTotal,
        buyingTotal: r.buyingTotal,
        ownerId,
        ownerEmail,
      };
    });

    const marketingForeign = marketingRecords.filter((r) => {
      if (r.ownerId) return r.ownerId !== targetUserId;
      if (r.ownerEmail && targetUserEmail) return String(r.ownerEmail).toLowerCase() !== String(targetUserEmail).toLowerCase();
      return false;
    });

    const marketingAudit = {
      countReceiptsInMap: marketingKeys.length,
      distinctOwnerIds: Array.from(marketingOwners),
      distinctOwnerEmails: Array.from(marketingOwnerEmails),
      foreignCount: marketingForeign.length,
      foreignExamples: marketingForeign.slice(0, 5),
      topReceipts: marketingRecords.slice(0, 10),
    };

    // SUPPORT audit
    const supportPer = (supportSummary as any)?.perReceipts ?? {};
    const supportKeys = Object.keys(supportPer || {});
    let supportReceipts: any[] = [];
    // support receipts count (supportDailyEntry uses submittedById)
    const supportCount = await prisma.supportReceipt.count({
      where: {
        createdAt: { gte: argPeriod.start, lte: argPeriod.end },
        dailyEntry: { submittedById: targetUserId },
      },
    });
    if (supportKeys.length > 0) {
      supportReceipts = await prisma.supportReceipt.findMany({
        where: { receiptKey: { in: supportKeys } },
        select: {
          id: true,
          receiptNumber: true,
          receiptKey: true,
          createdAt: true,
          sellingTotal: true,
          buyingTotal: true,
          dailyEntry: { select: { submittedById: true } },
        },
      });
    }

    // count supportDailyEntry rows for this attendant in period
    const supportEntryCount = await prisma.supportDailyEntry.count({ where: { date: { gte: argPeriod.start, lte: argPeriod.end }, submittedById: targetUserId } });

    // POS receipts count (issuedById)
    const posCount = await prisma.receipt.count({ where: { createdAt: { gte: argPeriod.start, lte: argPeriod.end }, issuedById: targetUserId } });

    const supportOwners = new Set<string>();
    const supportOwnerEmails = new Set<string>();
    const supportRecords = supportReceipts.map((r) => {
      const ownerId = r.dailyEntry?.submittedById ?? null;
      const ownerEmail = r.dailyEntry?.submittedByEmail ?? null;
      if (ownerId) supportOwners.add(ownerId);
      if (ownerEmail) supportOwnerEmails.add(String(ownerEmail).toLowerCase());
      return {
        id: r.id,
        receiptNumber: r.receiptNumber,
        receiptKey: r.receiptKey,
        createdAt: r.createdAt,
        sellingTotal: r.sellingTotal,
        buyingTotal: r.buyingTotal,
        ownerId,
        ownerEmail,
      };
    });

    const supportForeign = supportRecords.filter((r) => {
      if (r.ownerId) return r.ownerId !== targetUserId;
      if (r.ownerEmail && targetUserEmail) return String(r.ownerEmail).toLowerCase() !== String(targetUserEmail).toLowerCase();
      return false;
    });

    const supportAudit = {
      countReceiptsInMap: supportKeys.length,
      distinctOwnerIds: Array.from(supportOwners),
      distinctOwnerEmails: Array.from(supportOwnerEmails),
      foreignCount: supportForeign.length,
      foreignExamples: supportForeign.slice(0, 5),
      topReceipts: supportRecords.slice(0, 10),
    };
    // build db metadata
    let dbMeta = { dbName: null, schema: null, host: null, urlSuffix: null } as any;
    try {
      const meta = await prisma.$queryRaw`select current_database() as db, current_schema() as schema`;
      if (Array.isArray(meta) && meta[0]) {
        dbMeta.dbName = meta[0].db ?? null;
        dbMeta.schema = meta[0].schema ?? null;
      } else if (meta && (meta as any).db) {
        dbMeta.dbName = (meta as any).db ?? null;
        dbMeta.schema = (meta as any).schema ?? null;
      }
    } catch (e) {
      // ignore
    }
    try {
      const rawUrl = process.env.DATABASE_URL ?? null;
      if (rawUrl) {
        try {
          const parsed = new URL(rawUrl);
          dbMeta.host = parsed.hostname ?? null;
          const s = String(rawUrl);
          dbMeta.urlSuffix = s.slice(-4);
        } catch (e) {
          // fallback: try to extract host via regex
          const m = rawUrl.match(/@([^:/?#]+)([:/?#]|$)/);
          dbMeta.host = m ? m[1] : null;
          dbMeta.urlSuffix = String(rawUrl).slice(-4);
        }
      }
    } catch (e) {
      // ignore
    }

    // source counts and totals
    const marketingTotalsVal = marketingTotals ?? { totalSales: 0, totalItems: 0 };
    const supportTotalsVal = supportAggregates ?? { totalSales: 0, totalItems: 0 };

    const sourceCounts = {
      marketingTotals: { totalSales: Number(marketingTotalsVal.totalSales ?? 0), totalItems: Number(marketingTotalsVal.totalItems ?? 0) },
      supportTotals: { totalSales: Number(supportTotalsVal.totalSales ?? 0), totalItems: Number(supportTotalsVal.totalItems ?? 0) },
      supportEntryCount,
      marketingRowCount: marketingCount,
      receiptsPerSource: { marketing: marketingKeys.length, support: supportKeys.length, pos: posCount },
    };

    // final diagnosis
    const diagnosis = {
      impersonationHonored: Boolean(impersonateId && auth.role === "ADMIN"),
      actorEqualsTarget: actorId === targetUserId,
      marketingHasForeignRows: marketingAudit.foreignCount > 0,
      supportHasForeignRows: supportAudit.foreignCount > 0,
      marketingHasMultipleOwners: (marketingAudit.distinctOwnerIds.length > 1),
      supportHasMultipleOwners: (supportAudit.distinctOwnerIds.length > 1),
    };

    const sanity = {
      targetHasAnyRows: (marketingCount + supportCount) > 0,
      totalsNonZero: totalSales > 0 || totalItems > 0,
    };

    payload.debug = { identity, db: dbMeta, sourceCounts, marketing: marketingAudit, support: supportAudit, diagnosis, sanity };
  }

  const res = NextResponse.json(payload);
  res.headers.set("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate");
  return res;
}

/*
Sample curl (admin session cookie required):

curl -s -H "Cookie: <ADMIN_SESSION_COOKIE>" "https://ops.betech.co.ke/api/marketing/report/summary?impersonateId=cmimxqfgo0004v5mc5pn1r486&debug=1"

curl -s -H "Cookie: <ADMIN_SESSION_COOKIE>" "https://ops.betech.co.ke/api/marketing/report/summary?impersonateId=cmimxqfve0006v5mcewkm8waa&debug=1"

*/
