import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import { composeIdentityResponse, resolveTargetUserId } from "@/lib/resolveTargetUser";
import type { Role } from "@prisma/client";
import { canonicalReceiptNumber } from "@/lib/receiptGuard";
import { summarizePosReceiptsForPeriod } from "@/lib/posReceiptSummary";
import getAttendantCommissionSummary from "@/lib/attendantCommission";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const identity = await resolveTargetUserId(req, { allowedImpersonationRoles: ["ADMIN" as Role] });
  const meta = identity;
  const userId = identity.resolvedUserId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const url = new URL(req.url);
  const periodKeyParam = url.searchParams.get("periodKey");
  const debug = url.searchParams.get("debug") === "1";
  const period = parseTradingPeriodKey(periodKeyParam ?? undefined) ?? getTradingPeriodFor(now);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, attendantCategory: true },
  });
  const normalizedEmail = (user?.email ?? "").toLowerCase().trim();
  const isBrendah = normalizedEmail === "brendah@betech.co.ke";
  const isJeniffer = normalizedEmail === "jeniffer@betech.co.ke";
  const isDirectSalesOps = user?.attendantCategory === "DIRECT_SALES_OPS";
  const shouldFetchPosTotals = isBrendah || isJeniffer || isDirectSalesOps;

  const [agg, salesRows] = await Promise.all([
    prisma.dailyReport.aggregate({
      where: { userId, date: { gte: period.start, lte: period.end } },
      _sum: {
        totalSales: true,
        newProducts: true,
        productsEdited: true,
        copiesUploaded: true,
        walkInServed: true,
        purchasesMade: true,
      },
      _count: { _all: true },
    }),
    prisma.dailySale.findMany({
      where: { dailyReport: { userId, date: { gte: period.start, lte: period.end } } },
      select: { receiptNumber: true, price: true },
    }),
  ]);

  const receiptSet = new Set<string>();
  let dailySalesTotal = 0;
  for (const row of salesRows) {
    const normalized = canonicalReceiptNumber(row.receiptNumber ?? "");
    if (normalized) receiptSet.add(normalized);
    dailySalesTotal += Number(row.price ?? 0);
  }

  const aggregateSalesTotal = Number(agg._sum.totalSales ?? 0);
  const totalSales = Math.max(aggregateSalesTotal, dailySalesTotal);

  const dailySummary = {
    periodKey: period.key,
    periodLabel: period.label,
    totalSales,
    totalItems: salesRows.length,
    totalReceipts: receiptSet.size,
    totalNewProducts: Number(agg._sum.newProducts ?? 0),
    totalEditedProducts: Number(agg._sum.productsEdited ?? 0),
    totalCopiedProducts: Number(agg._sum.copiesUploaded ?? 0),
    walkInsServed: Number(agg._sum.walkInServed ?? 0),
    walkInsPurchased: Number(agg._sum.purchasesMade ?? 0),
    totalReports: Number((agg as any)?._count?._all ?? 0),
  };

  // POS receipts summary (paid-only), used for attendants whose source-of-truth is POS.
  // We still return daily-report metrics so the UI can show task counts.
  const posSummary = shouldFetchPosTotals
    ? await summarizePosReceiptsForPeriod({ start: period.start, end: period.end, userId })
    : null;
  const usePosTotals =
    isJeniffer ||
    isDirectSalesOps ||
    (isBrendah && Number(posSummary?.totalSales ?? 0) > 0);

  const basePayload: any = {
    ...dailySummary,
    usePosTotals,
    pos: posSummary
      ? {
          totalSales: Number(posSummary.totalSales ?? 0),
          totalProfit: Number(posSummary.totalProfit ?? 0),
          totalItems: Number(posSummary.totalItems ?? 0),
          totalReceipts: Number(posSummary.totalReceipts ?? 0),
        }
      : null,
  };

  // Attach canonical commission summary to ensure UI uses authoritative totals.
  try {
    const attendantCanonical = await getAttendantCommissionSummary({ attendantId: userId, start: period.start, end: period.end });
    basePayload.commission = Number(attendantCanonical.totalCommission ?? 0);
    basePayload.commissionBreakdown = attendantCanonical.breakdown ?? undefined;
    basePayload.directSalesCommission = Number(attendantCanonical.directSalesCommission ?? 0);
    basePayload.posProductCommission = Number(attendantCanonical.posProductCommission ?? 0);
    basePayload.newProductCommission = Number(attendantCanonical.newProductCommission ?? 0);
    basePayload.copiedCommission = Number(attendantCanonical.copiedCommission ?? 0);
    basePayload.editedCommission = Number(attendantCanonical.editedCommission ?? 0);
    basePayload.commissionTopUpTotal = Number(attendantCanonical.commissionTopUpTotal ?? 0);
  } catch (err) {
    // best-effort: leave basePayload unchanged when canonical helper fails
  }

  if (debug && usePosTotals) {
    const ownerOr = [
      { issuedById: userId },
      { order: { attendantId: userId } },
      { data: { path: ["attendantId"], equals: userId } },
    ];

    const sampleByGeneratedAt = await prisma.receipt.findMany({
      where: {
        generatedAt: { gte: period.start, lte: period.end },
        AND: [{ OR: ownerOr }],
      },
      select: {
        id: true,
        generatedAt: true,
        createdAt: true,
        receiptNumber: true,
        totals: true,
        issuedById: true,
        data: true,
        order: { select: { orderNumber: true, attendantId: true, paymentStatus: true, status: true, totalAmount: true } },
      },
      orderBy: { generatedAt: "desc" },
      take: 20,
    });

    const sampleByCreatedAt =
      sampleByGeneratedAt.length > 0
        ? []
        : await prisma.receipt.findMany({
            where: {
              createdAt: { gte: period.start, lte: period.end },
              AND: [{ OR: ownerOr }],
            },
            select: {
              id: true,
              generatedAt: true,
              createdAt: true,
              receiptNumber: true,
              totals: true,
              issuedById: true,
              data: true,
              order: { select: { orderNumber: true, attendantId: true, paymentStatus: true, status: true, totalAmount: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 20,
          });

    basePayload.debug = {
      periodStartIso: period.start.toISOString(),
      periodEndIso: period.end.toISOString(),
      userId,
      normalizedEmail,
      sampleByGeneratedAtCount: sampleByGeneratedAt.length,
      sampleByCreatedAtCount: sampleByCreatedAt.length,
      sampleByGeneratedAt,
      sampleByCreatedAt,
    };
  }

  return NextResponse.json(composeIdentityResponse(meta, basePayload));
}
