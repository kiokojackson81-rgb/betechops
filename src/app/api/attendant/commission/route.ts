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
  const session = await getServerSession(authOptions as any);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();
  const { period, tiers, tradingPeriod } = await getOrCreateCommissionPeriod(now);
  const { periodKey, periodLabel, startDate: start, endDate: end } = tradingPeriod;

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
    },
  });

  let newProducts = 0;
  let editedProducts = 0;
  let copiedProducts = 0;
  for (const rep of reports) {
    newProducts += rep.newProducts ?? 0;
    editedProducts += rep.productsEdited ?? 0;
    copiedProducts += rep.copiesUploaded ?? 0;
  }

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
  });
}
