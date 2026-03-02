import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import { composeIdentityResponse, resolveTargetUserId } from "@/lib/resolveTargetUser";
import type { Role } from "@prisma/client";
import { canonicalReceiptNumber } from "@/lib/receiptGuard";
import { summarizePosReceiptsForPeriod } from "@/lib/posReceiptSummary";

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
  const period = parseTradingPeriodKey(periodKeyParam ?? undefined) ?? getTradingPeriodFor(now);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, attendantCategory: true },
  });
  const normalizedEmail = (user?.email ?? "").toLowerCase().trim();
  const usePosTotals =
    normalizedEmail === "brendah@betech.co.ke" ||
    normalizedEmail === "jeniffer@betech.co.ke" ||
    user?.attendantCategory === "DIRECT_SALES_OPS";

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
      select: { receiptNumber: true },
    }),
  ]);

  const receiptSet = new Set<string>();
  for (const row of salesRows) {
    const normalized = canonicalReceiptNumber(row.receiptNumber ?? "");
    if (normalized) receiptSet.add(normalized);
  }

  const dailySummary = {
    periodKey: period.key,
    periodLabel: period.label,
    totalSales: Number(agg._sum.totalSales ?? 0),
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
  const posSummary = usePosTotals
    ? await summarizePosReceiptsForPeriod({ start: period.start, end: period.end, userId })
    : null;

  return NextResponse.json(
    composeIdentityResponse(meta, {
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
    }),
  );
}
