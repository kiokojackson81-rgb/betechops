import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/nextAuth";
import { prisma } from "@/lib/prisma";
import {
  getOrCreateCommissionPeriod,
  computeSalesCommissionFromTiers,
  computeProductCommissions,
  computeJenifferProratedCommission,
} from "@/lib/commission";
import { summarizePosReceiptsForPeriod } from "@/lib/posReceiptSummary";
import { computeBrendahDirectCommission } from "@/lib/onlineCommission";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();
  const { period, tiers, tradingPeriod } = await getOrCreateCommissionPeriod(now);
  // Normalize tradingPeriod shape: some helpers return { key,label,startDate,endDate }
  // while others return { periodKey,periodLabel,startDate,endDate }.
  let periodKey: string;
  let periodLabel: string;
  let start: Date;
  let end: Date;
  if ("periodKey" in tradingPeriod) {
    periodKey = (tradingPeriod as any).periodKey;
    periodLabel = (tradingPeriod as any).periodLabel;
    start = (tradingPeriod as any).startDate ?? (tradingPeriod as any).start;
    end = (tradingPeriod as any).endDate ?? (tradingPeriod as any).end;
  } else {
    periodKey = (tradingPeriod as any).key;
    periodLabel = (tradingPeriod as any).label;
    start = (tradingPeriod as any).startDate ?? (tradingPeriod as any).start;
    end = (tradingPeriod as any).endDate ?? (tradingPeriod as any).end;
  }

  const snapshots = await prisma.profitSnapshot.findMany({
    where: {
      orderItem: {
        order: {
          attendantId: userId,
          createdAt: { gte: start, lte: end },
        },
      },
    },
    select: {
      revenue: true,
      profit: true,
    },
  });

  let totalSales = 0;
  let totalProfit = 0;
  for (const row of snapshots) {
    totalSales += Number(row.revenue ?? 0);
    totalProfit += Number(row.profit ?? 0);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, attendantCategory: true },
  });
  const normalizedEmail = (user?.email ?? "").toLowerCase().trim();
  const isJeniffer = normalizedEmail === "jeniffer@betech.co.ke";
  const isBrendah = normalizedEmail === "brendah@betech.co.ke";
  const isDirectSalesOps = user?.attendantCategory === "DIRECT_SALES_OPS";
  const usePosTotals = isJeniffer || isBrendah || isDirectSalesOps;

  let posSummary: Awaited<ReturnType<typeof summarizePosReceiptsForPeriod>> | null = null;
  if (usePosTotals) {
    posSummary = await summarizePosReceiptsForPeriod({ start, end, userId, ownershipMode: "staffOnly" });
    totalSales = posSummary.totalSales;
    totalProfit = posSummary.totalProfit;
  }

  const reports = await prisma.dailyReport.findMany({
    where: { userId, date: { gte: start, lte: end } },
    select: {
      newProducts: true,
      productsEdited: true,
      copiesUploaded: true,
      walkInServed: true,
      purchasesMade: true,
    },
  });

  let newProducts = 0;
  let editedProducts = 0;
  let copiedProducts = 0;
  let walkInsServed = 0;
  let walkInsPurchased = 0;
  for (const rep of reports) {
    newProducts += rep.newProducts ?? 0;
    editedProducts += rep.productsEdited ?? 0;
    copiedProducts += rep.copiesUploaded ?? 0;
    walkInsServed += rep.walkInServed ?? 0;
    walkInsPurchased += rep.purchasesMade ?? 0;
  }

  const totalReceipts = usePosTotals ? (posSummary?.totalReceipts ?? 0) : reports.length;
  const totalItems = usePosTotals
    ? (posSummary?.totalItems ?? 0)
    : await prisma.dailySale.count({
        where: {
          dailyReport: {
            userId,
            date: { gte: start, lte: end },
          },
        },
      });

  let salesCommission = 0;
  if (isBrendah) {
    salesCommission = computeBrendahDirectCommission(totalSales, totalProfit).amount;
  } else if (isJeniffer) {
    const res = computeJenifferProratedCommission(
      totalSales,
      tiers.map((t: any) => ({ minSales: Number(t.minSales), maxSales: t.maxSales == null ? null : Number(t.maxSales), payoutFlat: Number(t.payoutFlat) })),
    );
    salesCommission = Number(res.commission ?? 0);
  } else {
    // Use default profit fallback here so attendant endpoints keep previous
    // commission behaviour (fallback percent configured in commission helper).
    salesCommission = computeSalesCommissionFromTiers(totalSales, totalProfit, tiers);
  }
  const { newProductCommission, copiedCommission, editedCommission } = computeProductCommissions({
    newProducts,
    copiedProducts,
    editedProducts,
  });

  const grossCommission = salesCommission + newProductCommission + copiedCommission + editedCommission;
  const detail = {
    periodKey,
    periodLabel,
    totalSales,
    totalProfit,
    salesCommission,
    newProductCommission,
    copiedCommission,
    editedCommission,
    totalNewProducts: newProducts,
    totalEditedProducts: editedProducts,
    totalCopiedProducts: copiedProducts,
    walkInsServed,
    walkInsPurchased,
    totalReceipts,
    totalItems,
  };

  const existingLedger = await prisma.commissionLedger.findUnique({
    where: {
      userId_periodStart_periodEnd: {
        userId,
        periodStart: period.startDate,
        periodEnd: period.endDate,
      },
    },
  });

  const prevDetail: any = existingLedger?.detail ?? {};
  const prevSales = Number(prevDetail.salesCommission ?? 0);
  const prevNew = Number(prevDetail.newProductCommission ?? 0);
  const prevCopied = Number(prevDetail.copiedCommission ?? 0);
  const prevEdited = Number(prevDetail.editedCommission ?? 0);
  const prevSum = prevSales + prevNew + prevCopied + prevEdited;

  await prisma.commissionLedger.upsert({
    where: {
      userId_periodStart_periodEnd: {
        userId,
        periodStart: period.startDate,
        periodEnd: period.endDate,
      },
    },
    update: {
      grossCommission: grossCommission.toString(),
      netCommission: grossCommission.toString(),
      commissionTotal: (Number(existingLedger?.commissionTotal ?? 0) - prevSum + grossCommission).toString(),
      detail,
    },
    create: {
      userId,
      periodStart: period.startDate,
      periodEnd: period.endDate,
      grossCommission: grossCommission.toString(),
      netCommission: grossCommission.toString(),
      commissionTotal: grossCommission.toString(),
      detail,
    },
  });

  return NextResponse.json({
    periodKey,
    periodLabel,
    totalSales,
    totalProfit,
    salesCommission,
    newProductCommission,
    copiedCommission,
    editedCommission,
    grossCommission,
    totalNewProducts: newProducts,
    totalEditedProducts: editedProducts,
    totalCopiedProducts: copiedProducts,
    walkInsServed,
    walkInsPurchased,
    totalReceipts,
    totalItems,
  });
}
