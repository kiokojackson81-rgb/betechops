import { NextResponse } from "next/server";
import { requireRole, getActorId } from "@/lib/api";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { getEarningsSummaryForUser } from "@/lib/earningsSummary";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const impersonate = url.searchParams.get("impersonateId") || url.searchParams.get("attendantId");

  let attendantId: string | null = null;
  try {
    if (impersonate && auth.role === "ADMIN") {
      attendantId = impersonate;
    } else {
      attendantId = await getActorId();
    }
  } catch (e) {
    attendantId = await getActorId();
  }

  if (!attendantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const period = getTradingPeriodFor(new Date());
  // Enforce server-resolved trading period for dashboard totals.
  // Do not accept client-supplied `periodKey` or `periodLabel`.
  const urlObj = new URL(req.url);
  if (urlObj.searchParams.has("periodKey") || urlObj.searchParams.has("periodLabel")) {
    return NextResponse.json({ error: "This endpoint requires a server-resolved trading period; do not supply periodKey/periodLabel." }, { status: 400 });
  }

  const periodKey = period.key;
  const periodLabel = period.label;

  try {
    const userSummary = await getEarningsSummaryForUser({ userId: attendantId });
    const ledger = await prisma.commissionLedger.findUnique({
      where: {
        userId_periodStart_periodEnd: {
          userId: attendantId,
          periodStart: period.start,
          periodEnd: period.end,
        },
      },
    });

    const detail = ledger?.detail as Record<string, any> | undefined;
    const marketingCommission = detail && typeof detail === "object" ? Number(detail.marketing?.commission ?? 0) : 0;
    const supportCommission = detail && typeof detail === "object" ? Number(detail.support?.commission ?? 0) : 0;

    let salesCommission = marketingCommission + supportCommission;
    if (salesCommission === 0 && ledger) {
      salesCommission = Number(ledger.grossCommission ?? 0);
    }
    if (salesCommission === 0) {
      salesCommission = userSummary.salesCommission;
    }

    const grossCommission =
      salesCommission +
      userSummary.newProductCommission +
      userSummary.copiedCommission +
      userSummary.editedCommission +
      userSummary.commissionTopUpTotal;

    const totalEarnings =
      userSummary.baseSalary + userSummary.transportAllowance + grossCommission + userSummary.bonusTotal;
    const totalDeductions =
      userSummary.chamaTotal +
      userSummary.latenessTotal +
      userSummary.disciplineTotal +
      userSummary.otherDeductionsTotal;
    const netPay = totalEarnings - totalDeductions;

    const summary = {
      periodKey,
      periodLabel,
      sales: userSummary.totalSales,
      baseSalary: userSummary.baseSalary,
      transportAllowance: userSummary.transportAllowance,
      commission: grossCommission,
      bonusTotal: userSummary.bonusTotal,
      chamaTotal: userSummary.chamaTotal,
      latenessTotal: userSummary.latenessTotal,
      disciplineTotal: userSummary.disciplineTotal,
      otherDeductionsTotal: userSummary.otherDeductionsTotal,
      totalEarnings,
      totalDeductions,
      netPay,
    };

    return NextResponse.json({ periodKey, periodLabel, summary });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to compute earnings";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
