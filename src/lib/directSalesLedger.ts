import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { summarizePosReceiptsForPeriod } from "@/lib/posReceiptSummary";
import { computeSalesCommissionFromTiers, getOrCreateCommissionPeriod } from "@/lib/commission";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";

export async function recomputeDirectSalesLedger(opts: {
  userId: string;
  date?: Date;
  period?: { start: Date; end: Date };
  client?: PrismaClient;
}) {
  const client = opts.client ?? prisma;
  const period = opts.period ?? getTradingPeriodFor(opts.date ?? new Date());
  if (!period) throw new Error("No trading period for given date");
  const { tiers } = await getOrCreateCommissionPeriod(period.start);

  const totals = await summarizePosReceiptsForPeriod({ start: period.start, end: period.end, userId: opts.userId });
  const totalSales = totals.totalSales ?? 0;
  const totalProfit = totals.totalProfit ?? 0;

  // Jeniffer rule: fallbackPercent = 0 (no commission below first tier)
  const directSalesCommission = computeSalesCommissionFromTiers(totalSales, totalProfit, tiers, 0);

  // Merge with existing ledger without clobbering other sections
  const existingLedger = await client.commissionLedger.findUnique({
    where: {
      userId_periodStart_periodEnd: {
        userId: opts.userId,
        periodStart: period.start,
        periodEnd: period.end,
      },
    },
  });

  const existingDetail = typeof existingLedger?.detail === "object" && existingLedger?.detail ? { ...(existingLedger.detail as any) } : {};
  const previousDirect = typeof existingDetail.directSales === "object" ? (existingDetail.directSales as any) : null;
  const previousDirectCommission = previousDirect?.commission ?? 0;

  const grossBefore = Math.max(0, Number(existingLedger?.grossCommission ?? 0) - Number(previousDirectCommission ?? 0));
  const grossCommission = grossBefore + directSalesCommission;
  const penalties = Number(existingLedger?.penalties ?? 0);
  const netCommission = grossCommission - penalties;

  const nextDetail = {
    ...existingDetail,
    directSales: {
      periodKey: `${period.start.toISOString()}_${period.end.toISOString()}`,
      totals,
      commission: directSalesCommission,
      computedAt: new Date().toISOString(),
    },
  } as any;

  // Best-effort: remove overlapping ledgers that reference same periodKey but different start/end
  try {
    await client.$executeRaw`
      DELETE FROM "CommissionLedger"
      WHERE "userId" = ${opts.userId}
        AND (detail->'directSales'->>'periodKey') = ${nextDetail.directSales.periodKey}
        AND NOT ("periodStart" = ${period.start} AND "periodEnd" = ${period.end})
    `;
  } catch (_e) {
    // ignore
  }

  const ledger = await client.commissionLedger.upsert({
    where: {
      userId_periodStart_periodEnd: {
        userId: opts.userId,
        periodStart: period.start,
        periodEnd: period.end,
      },
    },
    update: {
      grossCommission: grossCommission.toFixed(2),
      netCommission: netCommission.toFixed(2),
      commissionTotal: (Number(existingLedger?.commissionTotal ?? 0) - Number(previousDirectCommission ?? 0) + directSalesCommission).toFixed(2),
      detail: nextDetail,
    },
    create: {
      userId: opts.userId,
      periodStart: period.start,
      periodEnd: period.end,
      grossCommission: grossCommission.toFixed(2),
      netCommission: netCommission.toFixed(2),
      commissionTotal: directSalesCommission.toFixed(2),
      detail: nextDetail,
    },
  });

  return { ledgerId: ledger.id, commission: directSalesCommission, totals, period };
}
