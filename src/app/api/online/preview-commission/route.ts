import { NextResponse } from "next/server";
import { requireAttendant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import { getOnlineOpsWindowForTradingPeriod } from "@/lib/onlineOpsWeeks";
import { computeOnlinePeriodCommission, resolveDirectCommissionMode, resolveOnlinePosOwnershipMode } from "@/lib/onlineCommission";
import { composeIdentityResponse, resolveTargetUserId } from "@/lib/resolveTargetUser";
import { summarizePosReceiptsForPeriod } from "@/lib/posReceiptSummary";
import { getAssignedMarketplaceSalesForPeriod } from "@/lib/onlineOps";

export const dynamic = "force-dynamic";

const parseDateParam = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export async function GET(req: Request) {
  const auth = await requireAttendant(req, ["JUMIA_KILIMALL_OPS", "BETECH_OPS", "SUPERVISOR", "ADMIN"]);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const identity = await resolveTargetUserId(req);
  const meta = identity;
  const attendantId = identity.resolvedUserId;
  if (!attendantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const startParam = parseDateParam(url.searchParams.get("start"));
  const endParam = parseDateParam(url.searchParams.get("end"));
  const requestedPeriod = parseTradingPeriodKey(url.searchParams.get("periodKey") ?? undefined);

  const period = getTradingPeriodFor(new Date());
  const start = startParam ?? period.start;
  const end = endParam ?? period.end;
  const marketplaceWindow = requestedPeriod
    ? getOnlineOpsWindowForTradingPeriod(requestedPeriod, requestedPeriod.end, 4)
    : { start, end };
  const user = await prisma.user.findUnique({ where: { id: attendantId }, select: { email: true } });

  // direct sales from POS receipts created by this attendant
  const [posSummary, marketplaceTotals] = await Promise.all([
    summarizePosReceiptsForPeriod({
      start,
      end,
      userId: attendantId,
      ownershipMode: resolveOnlinePosOwnershipMode(user?.email),
      supportPricingScope: "any",
      profitRecognitionMode: "salesDate",
    }),
    getAssignedMarketplaceSalesForPeriod(attendantId, {
      key: "custom",
      label: "Selected period",
      start: marketplaceWindow.start,
      end: marketplaceWindow.end,
    }),
  ]);

  const periodInputs = {
    attendantId,
    periodStart: start,
    periodEnd: end,
    directSales: posSummary.totalSales,
    directProfit: posSummary.totalProfit,
    jumiaSales: marketplaceTotals.totals.jumiaSales,
    kilimallSales: marketplaceTotals.totals.kilimallSales,
  };

  const result = computeOnlinePeriodCommission(periodInputs as any, {
    directCommissionMode: resolveDirectCommissionMode(user?.email),
  });
  return NextResponse.json(composeIdentityResponse(meta, result as unknown as Record<string, unknown>));
}
