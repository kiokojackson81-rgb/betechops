import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/nextAuth";
import { prisma } from "@/lib/prisma";
import {
  getOrCreateCommissionPeriod,
  computeSalesCommissionFromTiers,
  computeProductCommissions,
} from "@/lib/commission";

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

  const totalReceipts = reports.length;
  const totalItems = await prisma.dailySale.count({
    where: {
      dailyReport: {
        userId,
        date: { gte: start, lte: end },
      },
    },
  });

  // Use default profit fallback here so attendant endpoints keep previous
  // commission behaviour (fallback percent configured in commission helper).
  const salesCommission = computeSalesCommissionFromTiers(totalSales, totalProfit, tiers);
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
      detail,
    },
    create: {
      userId,
      periodStart: period.startDate,
      periodEnd: period.endDate,
      grossCommission: grossCommission.toString(),
      netCommission: grossCommission.toString(),
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
