import Link from "next/link";
import { redirect } from "next/navigation";
import { ReceiptText, Wallet } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { buildPayrollRow } from "@/lib/adminPayroll";
import { buildEarningsCardBreakdown } from "@/lib/earningsCardBreakdown";
import getLandingPage from "@/lib/getLandingPage";
import { isTechnicalTeamCategory } from "@/lib/technicalTeam";
import { getTechnicalProjectCommissionSummary } from "@/lib/technicalCompensation";

export const dynamic = "force-dynamic";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

async function resolveViewer() {
  const session = await auth().catch(() => null);
  const sessionUser = session?.user as
    | {
        id?: string | null;
        role?: string | null;
        attendantCategory?: string | null;
      }
    | undefined;

  if (!session || !sessionUser?.id) {
    redirect("/login");
  }

  const isAdmin = sessionUser.role === "ADMIN";

  const adminPreviewUser = isAdmin
    ? await prisma.user.findFirst({
        where: {
          attendantCategory: "TECHNICAL_TEAM",
          isActive: true,
        },
        orderBy: [{ name: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          email: true,
          attendantCategory: true,
          isActive: true,
        },
      })
    : null;

  const targetId = adminPreviewUser?.id || sessionUser.id;
  const viewer = adminPreviewUser
    ? adminPreviewUser
    : await prisma.user.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          name: true,
          email: true,
          attendantCategory: true,
          isActive: true,
        },
      });

  if (!viewer || !viewer.isActive) {
    redirect("/login");
  }

  if (sessionUser.role !== "ADMIN" && !isTechnicalTeamCategory(viewer.attendantCategory)) {
    redirect(getLandingPage(viewer.attendantCategory ?? null, sessionUser.role ?? undefined));
  }

  return viewer;
}

export default async function TechnicalEarningsPage() {
  const viewer = await resolveViewer();
  const period = getTradingPeriodFor(new Date());
  const [payrollRow, projectCommission] = await Promise.all([
    buildPayrollRow(
      {
        id: viewer.id,
        name: viewer.name,
        email: viewer.email,
        attendantCategory: viewer.attendantCategory,
        isActive: viewer.isActive,
      },
      period,
    ),
    getTechnicalProjectCommissionSummary(viewer.id, period),
  ]);

  const breakdown = buildEarningsCardBreakdown({
    baseSalary: payrollRow.baseSalary,
    transportAllowance: payrollRow.transportAllowance,
    commissionTotal: payrollRow.commissionTotal,
    salesCommission: payrollRow.commissionDirect,
    grossCommission: payrollRow.commissionGross,
    bonusTotal: payrollRow.bonusTotal,
    commissionTopUpTotal: payrollRow.adjustmentBreakdown.commissionTopUp,
    chamaTotal: payrollRow.adjustmentBreakdown.chama,
    latenessTotal: payrollRow.adjustmentBreakdown.lateness,
    disciplineTotal: payrollRow.adjustmentBreakdown.discipline + payrollRow.adjustmentBreakdown.penalties,
    otherDeductionsTotal: payrollRow.adjustmentBreakdown.other,
    totalEarnings: payrollRow.totalEarnings,
    totalDeductions: payrollRow.totalDeductions,
    netPay: payrollRow.netPay,
    adjustmentEntries: payrollRow.adjustmentEntries.map((entry) => ({
      id: entry.id,
      label: entry.label,
      amount: entry.amount,
      adjustmentType: entry.adjustmentType,
      adjustmentKind: entry.kind,
    })),
  });

  const earningLines = breakdown.lines.filter((line) => line.kind !== "deduction");
  const deductionLines = breakdown.lines.filter((line) => line.kind === "deduction");
  const payslipHref = `/api/attendant/payslip?periodKey=${encodeURIComponent(period.key)}`;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/8 via-white/4 to-transparent p-6 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.26em] text-emerald-300/80">Employee earnings</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Payroll, commission, and deductions
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Review your current period payslip summary, commission totals, additions, and deductions without leaving the technical workspace.
            </p>
          </div>
          <div className="grid gap-3 rounded-3xl border border-white/10 bg-[#091223] p-4 text-sm text-slate-300 sm:grid-cols-2">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Period</div>
              <div className="mt-1 font-medium text-white">{period.label}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Staff</div>
              <div className="mt-1 font-medium text-white">{viewer.name || viewer.email || "Technical Team"}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-slate-400">Net pay</div>
          <div className="mt-2 text-3xl font-semibold text-emerald-300">{formatCurrency(breakdown.netPay)}</div>
          <div className="mt-1 text-sm text-slate-500">After all deductions</div>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-slate-400">Total earnings</div>
          <div className="mt-2 text-3xl font-semibold text-white">{formatCurrency(breakdown.totalEarnings)}</div>
          <div className="mt-1 text-sm text-slate-500">Salary, commission, and additions</div>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-slate-400">Commission</div>
          <div className="mt-2 text-3xl font-semibold text-white">{formatCurrency(payrollRow.commissionTotal)}</div>
          <div className="mt-1 text-sm text-slate-500">POS profit share and completed project commission</div>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-slate-400">Total deductions</div>
          <div className="mt-2 text-3xl font-semibold text-rose-300">{formatCurrency(breakdown.totalDeductions)}</div>
          <div className="mt-1 text-sm text-slate-500">Chama, lateness, penalties, and other deductions</div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-4">
          <div className="rounded-[28px] border border-white/10 bg-[#091223] p-5">
            <div className="mb-4 flex items-center gap-2 text-white">
              <Wallet className="h-4 w-4 text-emerald-300" />
              <span className="text-lg font-semibold">Earnings breakdown</span>
            </div>
            <div className="space-y-3">
              {earningLines.map((line) => (
                <div key={line.label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
                  <span className="text-slate-300">{line.label}</span>
                  <span className="font-semibold text-emerald-300">{formatCurrency(line.amount)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#091223] p-5">
            <div className="mb-4 flex items-center gap-2 text-white">
              <ReceiptText className="h-4 w-4 text-rose-300" />
              <span className="text-lg font-semibold">Deductions</span>
            </div>
            <div className="space-y-3">
              {deductionLines.length ? (
                deductionLines.map((line) => (
                  <div key={line.label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
                    <span className="text-slate-300">{line.label}</span>
                    <span className="font-semibold text-rose-300">-{formatCurrency(Math.abs(line.amount))}</span>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-slate-400">
                  No deductions recorded in this period.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold text-white">Payslip tools</div>
            <div className="mt-2 text-sm text-slate-400">
              Download the current period payslip or return to your daily report section.
            </div>
            <div className="mt-5 grid gap-3">
              <Link href={payslipHref} className="rounded-2xl bg-emerald-500 px-4 py-3 text-center text-sm font-semibold text-black">
                Download payslip
              </Link>
              <Link href="/technical/daily-report" className="rounded-2xl border border-white/10 px-4 py-3 text-center text-sm font-semibold text-white">
                Open daily report
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold text-white">Performance snapshot</div>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <div className="flex items-center justify-between"><span>Total sales</span><span>{formatCurrency(payrollRow.totalSales)}</span></div>
              <div className="flex items-center justify-between"><span>Total profit</span><span>{formatCurrency(payrollRow.totalProfit)}</span></div>
              <div className="flex items-center justify-between"><span>Total receipts</span><span>{payrollRow.totalReceipts}</span></div>
              <div className="flex items-center justify-between"><span>Total items</span><span>{payrollRow.totalItems}</span></div>
              <div className="flex items-center justify-between"><span>Pending project commission</span><span>{formatCurrency(projectCommission.pendingAmount)}</span></div>
              <div className="flex items-center justify-between"><span>Completed project commission</span><span>{formatCurrency(projectCommission.completedAmount)}</span></div>
              <div className="flex items-center justify-between"><span>Bonuses / additions</span><span>{formatCurrency(payrollRow.bonusTotal)}</span></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
