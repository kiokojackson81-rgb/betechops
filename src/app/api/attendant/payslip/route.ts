import { NextResponse } from "next/server";
import { calculateCumulativeCommission } from "@/lib/commissionCommon";
import { getBranding } from "@/lib/branding";
import { requireAttendant } from "@/lib/auth";
import { getEarningsSummaryForUser } from "@/lib/earningsSummary";
import { getOnlineOpsWindowForTradingPeriod } from "@/lib/onlineOpsWeeks";
import {
  findPreferredCommissionLedger,
  getAssignedMarketplaceSalesForPeriod,
  getOnlineEarningsSummary,
} from "@/lib/onlineOps";
import { resolveOnlinePosOwnershipMode } from "@/lib/onlineCommission";
import { getPeriodKeyVariantsFromDates } from "@/lib/payrollPeriodKey";
import { launchChromiumBrowser } from "@/lib/pdf/chromium";
import { summarizePosReceiptsForPeriod } from "@/lib/posReceiptSummary";
import { prisma } from "@/lib/prisma";
import {
  buildPayslipPayload,
  renderPayslipDocumentHtml,
  sanitizeFilename,
} from "@/lib/payrollPayslip";
import { resolveTargetUserId } from "@/lib/resolveTargetUser";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import type {
  AdjustmentBreakdown,
  AdjustmentEntry,
  AdjustmentKind,
  PayrollRow,
} from "@/app/admin/payroll/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AttendantRecord = {
  id: string;
  name?: string | null;
  email?: string | null;
  attendantCategory?: string | null;
  isActive: boolean;
};

function baseAdjustmentSummary() {
  return {
    totalBonus: 0,
    totalDeduction: 0,
    breakdown: {
      chama: 0,
      lateness: 0,
      discipline: 0,
      other: 0,
      bonus: 0,
      commissionTopUp: 0,
      penalties: 0,
    } satisfies AdjustmentBreakdown,
    entries: [] as AdjustmentEntry[],
  };
}

function summarizeAdjustments(
  adjustments: Array<{
    id: string;
    label: string;
    amount: number | null;
    adjustmentType: string;
    adjustmentKind?: string | null;
  }>,
) {
  const summary = baseAdjustmentSummary();

  for (const adjustment of adjustments) {
    const amount = Number(adjustment.amount ?? 0);
    const bonusType = adjustment.adjustmentType === "BONUS";
    const topUpType = adjustment.adjustmentType === "COMMISSION_TOPUP";
    const kind =
      (adjustment.adjustmentKind as AdjustmentKind | undefined) ??
      (bonusType || topUpType ? "ADDITION" : "DEDUCTION");

    summary.entries.push({
      id: adjustment.id,
      label: adjustment.label,
      amount,
      adjustmentType: adjustment.adjustmentType,
      kind,
    });

    if (kind === "ADDITION") {
      if (bonusType) {
        summary.totalBonus += amount;
        summary.breakdown.bonus += amount;
      } else if (topUpType) {
        summary.totalBonus += amount;
        summary.breakdown.commissionTopUp += amount;
      } else if (adjustment.adjustmentType === "CHAMA") {
        summary.totalDeduction -= amount;
        summary.breakdown.chama -= amount;
      } else if (adjustment.adjustmentType === "LATENESS") {
        summary.totalDeduction -= amount;
        summary.breakdown.lateness -= amount;
      } else if (adjustment.adjustmentType === "DISCIPLINE") {
        summary.totalDeduction -= amount;
        summary.breakdown.discipline -= amount;
      } else if (adjustment.adjustmentType === "OTHER") {
        summary.totalDeduction -= amount;
        summary.breakdown.other -= amount;
      } else {
        summary.totalBonus += amount;
        summary.breakdown.bonus += amount;
      }
      continue;
    }

    if (bonusType) {
      summary.totalBonus -= amount;
      summary.breakdown.bonus -= amount;
    } else if (topUpType) {
      summary.totalBonus -= amount;
      summary.breakdown.commissionTopUp -= amount;
    } else if (adjustment.adjustmentType === "CHAMA") {
      summary.totalDeduction += amount;
      summary.breakdown.chama += amount;
    } else if (adjustment.adjustmentType === "LATENESS") {
      summary.totalDeduction += amount;
      summary.breakdown.lateness += amount;
    } else if (adjustment.adjustmentType === "DISCIPLINE") {
      summary.totalDeduction += amount;
      summary.breakdown.discipline += amount;
    } else {
      summary.totalDeduction += amount;
      summary.breakdown.other += amount;
    }
  }

  return summary;
}

async function buildPayslipRow(attendant: AttendantRecord, period: ReturnType<typeof getTradingPeriodFor>): Promise<PayrollRow> {
  const periodKeyVariants = getPeriodKeyVariantsFromDates(period.start, period.end);
  const [plan, ledger, adjustments] = await Promise.all([
    prisma.attendantCompPlan.findUnique({ where: { attendantId: attendant.id } }),
    findPreferredCommissionLedger(attendant.id, period),
    prisma.attendantPayrollAdjustment.findMany({
      where: { attendantId: attendant.id, periodKey: { in: periodKeyVariants } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const adjustmentSummary = summarizeAdjustments(adjustments as any[]);
  const penalties = Number(ledger?.penalties ?? 0);
  adjustmentSummary.breakdown.penalties = penalties;

  if (attendant.attendantCategory === "JUMIA_KILIMALL_OPS" || attendant.attendantCategory === "BETECH_OPS") {
    const marketplaceWindow = getOnlineOpsWindowForTradingPeriod(period, period.end, 4);
    const [onlineSummary, marketplaceSalesSummary, posSummary] = await Promise.all([
      getOnlineEarningsSummary(attendant.id, { period }),
      getAssignedMarketplaceSalesForPeriod(attendant.id, {
        key: marketplaceWindow.key,
        label: marketplaceWindow.label,
        start: marketplaceWindow.start,
        end: marketplaceWindow.end,
      }),
      summarizePosReceiptsForPeriod({
        start: period.start,
        end: period.end,
        userId: attendant.id,
        ownershipMode: resolveOnlinePosOwnershipMode(attendant.email),
        supportPricingScope: "any",
        profitRecognitionMode: "salesDate",
      }),
    ]);

    const jumiaSales = Number(marketplaceSalesSummary.totals.jumiaSales ?? 0);
    const kilimallSales = Number(marketplaceSalesSummary.totals.kilimallSales ?? 0);
    const ledgerDirect = Number((ledger as any)?.commissionDirect ?? 0);
    const ledgerJumia = Number((ledger as any)?.commissionMarketplaceJumia ?? 0);
    const ledgerKilimall = Number((ledger as any)?.commissionMarketplaceKilimall ?? 0);
    const directCommission =
      ledgerDirect > 0 ? ledgerDirect : Number(onlineSummary.directCommission ?? 0);
    const jumiaCommission =
      ledgerJumia > 0 ? ledgerJumia : Number(calculateCumulativeCommission(jumiaSales).commission ?? 0);
    const kilimallCommission =
      ledgerKilimall > 0 ? ledgerKilimall : Number(calculateCumulativeCommission(kilimallSales).commission ?? 0);
    const commissionTotal =
      Number(onlineSummary.commissionTotal ?? 0) ||
      Number(ledger?.commissionTotal ?? ledger?.netCommission ?? ledger?.grossCommission ?? 0) ||
      directCommission + jumiaCommission + kilimallCommission;
    const bonusTotal = adjustmentSummary.totalBonus;
    const totalDeductions = adjustmentSummary.totalDeduction + penalties;
    const totalEarnings =
      Number(onlineSummary.baseSalary ?? 0) +
      Number(onlineSummary.transportAllowance ?? 0) +
      commissionTotal +
      bonusTotal;

    return {
      attendantId: attendant.id,
      name: attendant.name,
      email: attendant.email,
      attendantCategory: attendant.attendantCategory,
      isActive: attendant.isActive,
      baseSalary: Number(onlineSummary.baseSalary ?? 0),
      transportAllowance: Number(onlineSummary.transportAllowance ?? 0),
      commission: commissionTotal,
      commissionGross: commissionTotal,
      commissionDirect: directCommission,
      commissionMarketplaceJumia: jumiaCommission,
      commissionMarketplaceKilimall: kilimallCommission,
      commissionTotal,
      commissionBreakdown: {
        direct: directCommission,
        jumia: jumiaCommission,
        kilimall: kilimallCommission,
        total: commissionTotal,
      },
      bonusTotal,
      deductionTotal: totalDeductions,
      totalEarnings,
      totalDeductions,
      netPay: totalEarnings - totalDeductions,
      totalSales: Number(onlineSummary.directSales ?? 0) + Number(onlineSummary.marketplaceSales ?? 0),
      totalProfit: Number(posSummary.totalProfit ?? 0),
      totalReceipts: Number(posSummary.totalReceipts ?? 0),
      totalItems: Number(posSummary.totalItems ?? 0),
      newProducts: 0,
      editedProducts: 0,
      copiedProducts: 0,
      adjustmentBreakdown: adjustmentSummary.breakdown,
      adjustmentEntries: adjustmentSummary.entries,
    };
  }

  const earningsSummary = await getEarningsSummaryForUser({ userId: attendant.id, asOf: period.start });
  let commissionTotal = Number(ledger?.commissionTotal ?? 0);
  if (commissionTotal <= 0) {
    commissionTotal = Number(earningsSummary?.salesCommission ?? 0);
  }
  if (commissionTotal <= 0) {
    commissionTotal = Number(ledger?.netCommission ?? ledger?.grossCommission ?? 0);
  }

  const totalEarnings =
    Number(plan?.baseSalary ?? earningsSummary?.baseSalary ?? 0) +
    Number(plan?.defaultTransportAllowance ?? earningsSummary?.transportAllowance ?? 0) +
    commissionTotal +
    adjustmentSummary.totalBonus;
  const totalDeductions = adjustmentSummary.totalDeduction + penalties;

  return {
    attendantId: attendant.id,
    name: attendant.name,
    email: attendant.email,
    attendantCategory: attendant.attendantCategory,
    isActive: attendant.isActive,
    baseSalary: Number(plan?.baseSalary ?? earningsSummary?.baseSalary ?? 0),
    transportAllowance: Number(plan?.defaultTransportAllowance ?? earningsSummary?.transportAllowance ?? 0),
    commission: commissionTotal,
    commissionGross: commissionTotal,
    commissionDirect: Number((ledger as any)?.commissionDirect ?? commissionTotal),
    commissionMarketplaceJumia: Number((ledger as any)?.commissionMarketplaceJumia ?? 0),
    commissionMarketplaceKilimall: Number((ledger as any)?.commissionMarketplaceKilimall ?? 0),
    commissionTotal,
    commissionBreakdown: (ledger?.detail as Record<string, unknown> | null) ?? null,
    bonusTotal: adjustmentSummary.totalBonus,
    deductionTotal: totalDeductions,
    totalEarnings,
    totalDeductions,
    netPay: totalEarnings - totalDeductions,
    totalSales: Number(earningsSummary?.totalSales ?? 0),
    totalProfit: Number(earningsSummary?.totalProfit ?? 0),
    totalReceipts: Number(earningsSummary?.totalReceipts ?? 0),
    totalItems: Number(earningsSummary?.totalItems ?? 0),
    newProducts: Number(earningsSummary?.totalNewProducts ?? 0),
    editedProducts: Number(earningsSummary?.totalEditedProducts ?? 0),
    copiedProducts: Number(earningsSummary?.totalCopiedProducts ?? 0),
    adjustmentBreakdown: adjustmentSummary.breakdown,
    adjustmentEntries: adjustmentSummary.entries,
  };
}

export async function GET(req: Request) {
  const auth = await requireAttendant(req, [
    "ADMIN",
    "SUPERVISOR",
    "DIRECT_SALES_OPS",
    "MARKETING_OPS",
    "JUMIA_KILIMALL_OPS",
    "SUPPORT_OPS",
    "BETECH_OPS",
  ]);
  if (!auth.ok) return auth.res;

  const identity = await resolveTargetUserId(req);
  const attendantId = identity.resolvedUserId ?? auth.user.id;
  if (!attendantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const periodKey = (url.searchParams.get("periodKey") || "").trim();
  const period = parseTradingPeriodKey(periodKey) ?? getTradingPeriodFor(new Date());

  const attendant = await prisma.user.findUnique({
    where: { id: attendantId },
    select: { id: true, name: true, email: true, attendantCategory: true, isActive: true },
  });

  if (!attendant) {
    return NextResponse.json({ error: "Attendant not found" }, { status: 404 });
  }

  const [row, branding] = await Promise.all([
    buildPayslipRow(attendant, period),
    getBranding(),
  ]);

  const html = renderPayslipDocumentHtml({
    documentTitle: `${attendant.name || attendant.email || attendant.id} payslip ${period.label}`,
    slips: [
      buildPayslipPayload({
        attendant,
        row,
        period,
        branding,
      }),
    ],
  });

  const browser = await launchChromiumBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
    const safeName = sanitizeFilename(`${attendant.name || attendant.email || attendant.id} payslip ${period.key}.pdf`);
    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "no-store",
        "X-Receipt-Renderer": "pdf",
      },
    });
  } finally {
    await browser.close();
  }
}
