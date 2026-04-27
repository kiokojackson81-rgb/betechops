import { NextResponse } from "next/server";
import { requireRole, getActorId } from "@/lib/api";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import { getCurrentTradingPeriodFor } from "@/lib/marketingPeriod";
import { summarizeMarketingReportsForPeriod } from "@/lib/marketingPeriodTotals";
import { getSupportPeriodAggregates } from "@/lib/supportEntries";
import { computeSalesCommissionFromTiers, getOrCreateCommissionPeriod } from "@/lib/commission";
import { getCommissionSummaryForSales } from "@/lib/marketingCommission";
import { getUnpricedDailySalesForCurrentPeriod } from "@/lib/marketingUnpricedSales";
import { computeBrendahDirectCommission } from "@/lib/onlineCommission";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { nowInNairobi } from "@/lib/timezone";
import { type PosReceiptSummary } from "@/lib/posReceiptSummary";
import { getUserCommissionConfigLike } from "@/lib/userCommissionConfig";
import { computeJenifferProratedCommission } from "@/lib/commission";
import { computeAdminReceiptSummary } from "@/lib/adminReceiptsSummary";
import { getReleasedPosProductCommissionForStaffPeriod } from "@/lib/posProductCommission";

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
    select: { email: true, name: true, attendantCategory: true },
  });
  const targetUserEmail = targetUser?.email?.toLowerCase().trim() ?? null;
  const targetUserName = targetUser?.name ?? null;
  const commissionConfig = await getUserCommissionConfigLike(targetUserId);
  const usePosTotals = commissionConfig.posTotalsMode !== "NONE";
  const isBrendah = commissionConfig.salesCommissionMode === "BRENDAH_DIRECT";
  const isJeniffer = commissionConfig.salesCommissionMode === "JENIFFER_PRORATED";

  const today = nowInNairobi();
  const { tiers } = await getOrCreateCommissionPeriod(today);
  const current = await getCurrentTradingPeriodFor(today);
  const periodKeyParam = url.searchParams.get("periodKey");
  const requestedPeriod = parseTradingPeriodKey(periodKeyParam ?? undefined);

  let argPeriod: {
    start: Date;
    end: Date;
    key: string;
    label: string;
  } = requestedPeriod
    ? {
        start: requestedPeriod.start,
        end: requestedPeriod.end,
        key: requestedPeriod.key,
        label: requestedPeriod.label,
      }
    : {
        start: current.startDate,
        end: current.endDate,
        key: current.key,
        label: current.label,
      };

  if (!requestedPeriod && !(today >= argPeriod.start && today <= argPeriod.end)) {
    const fallback = getTradingPeriodFor(today);
    argPeriod = {
      start: fallback.start,
      end: fallback.end,
      key: fallback.key,
      label: fallback.label,
    };
  }

  const [marketingSummary, supportSummary] = await Promise.all([
    summarizeMarketingReportsForPeriod({
      userId: targetUserId,
      userEmail: targetUserEmail,
      period: argPeriod,
    }),
    getSupportPeriodAggregates({ userId: targetUserId, period: argPeriod }),
  ]);
  // Note: WeeklySale totals are global (not per-attendant) so we do not mix them
  // into attendant-scoped marketing tracker summaries. Keep a placeholder for
  // debug payload compatibility.
  const weeklySalesTotal = 0;

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
  // Always compute merged (marketing+support) totals as a fallback/diagnostic baseline.
  // Precedence per receipt: MARKETING > SUPPORT (unless marketing profit missing but support has profit).
  const merged = new Map<string, { sales: number; profit: number; items: number; mpesa: number; cash: number }>();
  for (const [k, v] of Object.entries(marketingPer) as [string, any][]) {
    merged.set(k, { sales: v.sales ?? 0, profit: v.profit ?? 0, items: v.items ?? 0, mpesa: v.mpesa ?? 0, cash: v.cash ?? 0 });
  }
  for (const [k, v] of Object.entries(supportPer) as [string, any][]) {
    const supportObj = { sales: v.sales ?? 0, profit: v.profit ?? 0, items: v.items ?? 0, mpesa: v.mpesa ?? 0, cash: v.cash ?? 0 };
    if (merged.has(k)) {
      const existing = merged.get(k)!;
      if ((existing.profit ?? 0) <= 0 && (supportObj.profit ?? 0) > 0) {
        merged.set(k, supportObj);
      }
      continue;
    }
    merged.set(k, supportObj);
  }
  let mergedSales = 0;
  let mergedProfit = 0;
  let mergedItems = 0;
  const mergedStats = { totalSalesMpesa: 0, totalSalesCash: 0, countMpesaReceipts: 0, countCashReceipts: 0 };
  for (const [, v] of merged) {
    mergedSales += v.sales;
    mergedProfit += v.profit;
    mergedItems += v.items;
    mergedStats.totalSalesMpesa += v.mpesa;
    mergedStats.totalSalesCash += v.cash;
    if (v.mpesa > 0) mergedStats.countMpesaReceipts += 1;
    if (v.cash > 0) mergedStats.countCashReceipts += 1;
  }
  const mergedReceipts = merged.size;

  if (usePosTotals) {
    const adminSummary = await computeAdminReceiptSummary({
      start: argPeriod.start,
      end: argPeriod.end,
      scope: commissionConfig.posTotalsMode === "GLOBAL" ? "global" : "mine",
      currentUserId: commissionConfig.posTotalsMode === "GLOBAL" ? undefined : targetUserId,
      salesOnly: true,
    });
    posSummary = {
      totalSales: adminSummary.totalSales,
      totalProfit: adminSummary.totalProfit,
      totalItems: adminSummary.itemsCount,
      totalReceipts: adminSummary.receiptsCount,
      receiptKeys: [],
      paymentStats: {
        totalSalesMpesa: adminSummary.paymentTotals.mpesa.totalSales,
        totalSalesCash: adminSummary.paymentTotals.cash.totalSales,
        countMpesaReceipts: adminSummary.paymentTotals.mpesa.count,
        countCashReceipts: adminSummary.paymentTotals.cash.count,
      },
    };

    // For the tracker quick-stats we align with the POS receipts view (PDF/report).
    // Avoid mixing in WeeklySale totals (global, not per attendant) for user-scoped views.
    totalSales = posSummary.totalSales;
    totalProfit = posSummary.totalProfit;
    totalItems = posSummary.totalItems;
    totalReceipts = posSummary.totalReceipts;
    mergedPaymentStats = posSummary.paymentStats;
  } else {
    totalSales = mergedSales;
    totalProfit = mergedProfit;
    totalItems = mergedItems;
    totalReceipts = mergedReceipts;
    mergedPaymentStats = mergedStats;
  }

  let commission = 0;
  if (usePosTotals && posSummary) {
    if (isBrendah) {
      commission = computeBrendahDirectCommission(posSummary.totalSales, posSummary.totalProfit).amount;
    } else if (isJeniffer) {
      const res = computeJenifferProratedCommission(
        posSummary.totalSales,
        tiers.map((t: any) => ({
          minSales: Number(t.minSales),
          maxSales: t.maxSales == null ? null : Number(t.maxSales),
          payoutFlat: Number(t.payoutFlat),
        })),
      );
      commission = Math.round(Number(res.commission ?? 0));
    } else {
      const fallbackPercent = posSummary.totalProfit > 0 ? 0.05 : 0;
      commission = Math.round(computeSalesCommissionFromTiers(posSummary.totalSales, posSummary.totalProfit, tiers, fallbackPercent));
    }
  } else if (totalSales > 0) {
    commission = isBrendah
      ? computeBrendahDirectCommission(totalSales, totalProfit).amount
      : computeSalesCommissionFromTiers(totalSales, totalProfit, tiers);
  }

  try {
    if (!usePosTotals && targetUserEmail && !isBrendah) {
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

  if (!usePosTotals && !isBrendah) {
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
        const persistedTotal = Number((ledger as any).commissionTotal ?? (ledger as any).commission_total ?? 0);
        if (persistedTotal > 0) {
          commission = persistedTotal;
        } else {
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
      }
    } catch {
      // ignore
    }
  }

  const releasedPosCommission = await getReleasedPosProductCommissionForStaffPeriod(
    targetUserId,
    argPeriod.start,
    argPeriod.end,
  );
  if (releasedPosCommission > 0) {
    totalProfit -= releasedPosCommission;
    commission += releasedPosCommission;
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
      totalReceiptRows: usePosTotals && posSummary ? posSummary.totalReceipts : marketingSummary?.rawRowCount ?? 0,
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

    // POS receipts counts:
    // - total POS receipts in the period (uses `generatedAt`, same as POS summary)
    // - POS receipts issued by this user (also uses `generatedAt` + issuedById)
    const posCountAll = await prisma.receipt.count({ where: {
      generatedAt: { gte: argPeriod.start, lte: argPeriod.end },
      // Exclude POD-pending receipts by using a top-level NOT filter for
      // `podDelivery.status = 'pending'`. This is more robust than nested
      // `not: { equals: 'pending' }` on the JSON path.
      NOT: { data: { path: ['podDelivery', 'status'], equals: 'pending' } },
    } });
    const posCountIssuedByUser = await prisma.receipt.count({ where: {
      generatedAt: { gte: argPeriod.start, lte: argPeriod.end },
      issuedById: targetUserId,
      NOT: { data: { path: ['podDelivery', 'status'], equals: 'pending' } },
    } });

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
      receiptsPerSource: { marketing: marketingKeys.length, support: supportKeys.length, pos: posCountAll, posIssuedBy: posCountIssuedByUser },
    };

    const selection = {
      usePosTotals,
      mergedSales,
      mergedReceipts,
      weeklySalesTotal,
      posSales: posSummary?.totalSales ?? null,
      posReceipts: posSummary?.totalReceipts ?? null,
      selectedSales: totalSales,
      selectedReceipts: totalReceipts,
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

    payload.debug = { identity, db: dbMeta, sourceCounts, marketing: marketingAudit, support: supportAudit, selection, diagnosis, sanity };
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
