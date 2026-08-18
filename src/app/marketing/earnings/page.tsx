import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, Download, Minus, WalletCards } from "lucide-react";
import { auth } from "@/lib/auth";
import { buildPayrollRow } from "@/lib/adminPayroll";
import { buildEarningsCardBreakdown, type EarningsCardLine } from "@/lib/earningsCardBreakdown";
import { withImpersonateId } from "@/lib/impersonation";
import { applyCanonicalPayrollOverrides } from "@/lib/payrollCanonical";
import { prisma } from "@/lib/prisma";
import {
  getPreviousTradingPeriod,
  getRecentTradingPeriods,
  getTradingPeriodFor,
  parseTradingPeriodKey,
  type TradingPeriod,
} from "@/lib/tradingPeriod";

export const dynamic = "force-dynamic";

type EarningsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type PeriodPayroll = {
  period: TradingPeriod;
  row: Awaited<ReturnType<typeof buildPayrollRow>>;
  breakdown: ReturnType<typeof buildEarningsCardBreakdown>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatKes(value: number) {
  return `KES ${Math.round(Number(value || 0)).toLocaleString("en-KE")}`;
}

function percentageChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function Delta({ current, previous }: { current: number; previous: number }) {
  const change = percentageChange(current, previous);
  if (change === null) return <span className="text-xs text-slate-500">No previous-period baseline</span>;
  const rounded = Math.round(change * 10) / 10;
  const positive = rounded > 0;
  const negative = rounded < 0;
  const Icon = positive ? ArrowUpRight : negative ? ArrowDownRight : Minus;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${positive ? "text-emerald-300" : negative ? "text-rose-300" : "text-slate-400"}`}>
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(rounded).toLocaleString("en-KE")}% vs previous period
    </span>
  );
}

function SummaryCard({
  label,
  value,
  current,
  previous,
  tone,
}: {
  label: string;
  value: string;
  current: number;
  previous: number;
  tone: "emerald" | "amber" | "rose" | "cyan";
}) {
  const tones = {
    emerald: "border-emerald-400/20 from-emerald-400/10 text-emerald-200",
    amber: "border-amber-400/20 from-amber-400/10 text-amber-200",
    rose: "border-rose-400/20 from-rose-400/10 text-rose-200",
    cyan: "border-cyan-400/20 from-cyan-400/10 text-cyan-200",
  };
  return (
    <div className={`rounded-[22px] border bg-gradient-to-br ${tones[tone]} to-transparent p-4`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
      <div className="mt-2"><Delta current={current} previous={previous} /></div>
    </div>
  );
}

function BreakdownSection({
  id,
  title,
  subtitle,
  lines,
  emptyLabel,
  tone,
}: {
  id: string;
  title: string;
  subtitle: string;
  lines: EarningsCardLine[];
  emptyLabel: string;
  tone: "emerald" | "amber" | "rose";
}) {
  const tones = {
    emerald: "border-emerald-400/20 bg-emerald-400/[0.04] text-emerald-200",
    amber: "border-amber-400/20 bg-amber-400/[0.04] text-amber-200",
    rose: "border-rose-400/20 bg-rose-400/[0.04] text-rose-200",
  };
  return (
    <section id={id} className="scroll-mt-36 rounded-[24px] border border-white/10 bg-[#091223] p-4 sm:scroll-mt-24 sm:p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      </div>
      <div className="space-y-2">
        {lines.length ? lines.map((line) => (
          <div key={`${line.label}-${line.amount}`} className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 ${tones[tone]}`}>
            <span className="min-w-0 text-sm text-slate-200">{line.label}</span>
            <span className="shrink-0 font-semibold">{line.kind === "deduction" ? "-" : ""}{formatKes(Math.abs(line.amount))}</span>
          </div>
        )) : (
          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-slate-500">{emptyLabel}</div>
        )}
      </div>
    </section>
  );
}

function canAccessMarketing(role: string | null | undefined, category: string | null | undefined) {
  return role === "ADMIN" || role === "SUPERVISOR" || category === "MARKETING_OPS" || category === "DIRECT_SALES_OPS";
}

function canAccessOnlineEarnings(role: string | null | undefined, category: string | null | undefined) {
  return (
    role === "ADMIN" ||
    role === "SUPERVISOR" ||
    [
      "TECHNICAL_TEAM",
      "DIRECT_SALES_OPS",
      "MARKETING_OPS",
      "JUMIA_KILIMALL_OPS",
      "SUPPORT_OPS",
      "GENERAL_OPS",
      "BETECH_OPS",
    ].includes(String(category ?? ""))
  );
}

export default async function MarketingEarningsPage({ searchParams }: EarningsPageProps) {
  const session = await auth();
  const actor = session?.user as {
    id?: string | null;
    role?: string | null;
    attendantCategory?: string | null;
  } | undefined;

  if (!actor?.id) redirect("/admin/login");

  const params = (await searchParams) ?? {};
  const workspace = firstParam(params.workspace) === "online" ? "online" : "marketing";
  const canAccessWorkspace = workspace === "online" ? canAccessOnlineEarnings : canAccessMarketing;
  if (!canAccessWorkspace(actor.role, actor.attendantCategory)) redirect("/not-authorized");
  const impersonateId = String(firstParam(params.impersonateId) ?? "").trim() || null;
  const requestedPeriod = parseTradingPeriodKey(firstParam(params.periodKey));
  const selectedPeriod = requestedPeriod ?? getTradingPeriodFor(new Date());
  const targetId = actor.role === "ADMIN" && impersonateId ? impersonateId : actor.id;
  const attendant = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, name: true, email: true, attendantCategory: true, isActive: true },
  });

  if (!attendant || !canAccessWorkspace(actor.role, attendant.attendantCategory)) redirect("/not-authorized");

  const comparisonPeriods: TradingPeriod[] = [];
  let cursor = selectedPeriod;
  for (let index = 0; index < 6; index += 1) {
    comparisonPeriods.push(cursor);
    cursor = getPreviousTradingPeriod(cursor);
  }

  const payrollPeriods: PeriodPayroll[] = await Promise.all(
    comparisonPeriods.map(async (period) => {
      const row = await applyCanonicalPayrollOverrides(await buildPayrollRow(attendant, period), period);
      return { period, row, breakdown: buildEarningsCardBreakdown(row) };
    }),
  );
  const current = payrollPeriods[0];
  const previous = payrollPeriods[1];
  const earningLines = current.breakdown.lines.filter((line) => line.category === "earning");
  const commissionLines = current.breakdown.lines.filter((line) => line.category === "commission");
  const deductionLines = current.breakdown.lines.filter((line) => line.category === "deduction");
  const maximumNetPay = Math.max(1, ...payrollPeriods.map((item) => item.breakdown.netPay));
  const recentOptions = getRecentTradingPeriods(12);
  if (!recentOptions.some((period) => period.key === selectedPeriod.key)) recentOptions.push(selectedPeriod);

  const earningsPath = workspace === "online" ? "/attendant/online/earnings" : "/marketing/earnings";
  const pageHref = (periodKey: string) => withImpersonateId(`${earningsPath}?periodKey=${encodeURIComponent(periodKey)}`, impersonateId);
  const payslipHref = withImpersonateId(`/api/attendant/payslip?periodKey=${encodeURIComponent(selectedPeriod.key)}`, impersonateId);
  const reportHref = withImpersonateId(`/api/attendant/daily-report/performance-receipt/pdf?periodKey=${encodeURIComponent(selectedPeriod.key)}`, impersonateId);

  return (
    <div className="mx-auto min-w-0 max-w-[1420px] space-y-5">
      <section className="rounded-[26px] border border-emerald-300/15 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,.16),transparent_34%),linear-gradient(135deg,#122033,#07111f_62%)] p-4 shadow-2xl shadow-black/25 sm:p-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.72fr)] xl:items-end">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200/80">
              <WalletCards className="h-4 w-4" /> Earnings intelligence
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{attendant.name || "Your"} payroll overview</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Understand what was earned, where commission came from, what was deducted, and how this period compares with earlier payroll periods.</p>
          </div>
          <form className="rounded-2xl border border-white/10 bg-black/20 p-3" method="get">
            {impersonateId ? <input type="hidden" name="impersonateId" value={impersonateId} /> : null}
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400" htmlFor="periodKey">Payroll period</label>
            <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <select id="periodKey" name="periodKey" defaultValue={selectedPeriod.key} className="min-w-0 rounded-xl border border-white/10 bg-[#07111f] px-3 py-2.5 text-sm text-white">
                {recentOptions.map((period) => <option key={period.key} value={period.key}>{period.label}</option>)}
              </select>
              <button className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-300" type="submit">View period</button>
            </div>
          </form>
        </div>
      </section>

      <nav aria-label="Earnings sections" className="grid grid-cols-2 gap-2 rounded-[22px] border border-white/10 bg-[#091223] p-2 sm:grid-cols-4">
        <a href="#earnings" className="rounded-xl bg-emerald-400/10 px-3 py-2 text-center text-sm font-medium text-emerald-100">Earnings</a>
        <a href="#commissions" className="rounded-xl bg-amber-400/10 px-3 py-2 text-center text-sm font-medium text-amber-100">Commissions</a>
        <a href="#deductions" className="rounded-xl bg-rose-400/10 px-3 py-2 text-center text-sm font-medium text-rose-100">Deductions</a>
        <a href="#history" className="rounded-xl bg-cyan-400/10 px-3 py-2 text-center text-sm font-medium text-cyan-100">Period history</a>
      </nav>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Net pay" value={formatKes(current.breakdown.netPay)} current={current.breakdown.netPay} previous={previous.breakdown.netPay} tone="emerald" />
        <SummaryCard label="Gross earnings" value={formatKes(current.breakdown.totalEarnings)} current={current.breakdown.totalEarnings} previous={previous.breakdown.totalEarnings} tone="cyan" />
        <SummaryCard label="Commission" value={formatKes(current.row.commissionTotal)} current={current.row.commissionTotal} previous={previous.row.commissionTotal} tone="amber" />
        <SummaryCard label="Deductions" value={formatKes(current.breakdown.totalDeductions)} current={current.breakdown.totalDeductions} previous={previous.breakdown.totalDeductions} tone="rose" />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Sales influenced", formatKes(current.row.totalSales)],
          ["Receipts", current.row.totalReceipts.toLocaleString("en-KE")],
          ["Products added", current.row.newProducts.toLocaleString("en-KE")],
          ["Products edited", current.row.editedProducts.toLocaleString("en-KE")],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
            <div className="mt-2 text-xl font-semibold text-white">{value}</div>
          </div>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-3">
        <BreakdownSection id="earnings" title="Salary and earnings" subtitle="Fixed pay, allowances, bonuses, and other non-commission earnings." lines={earningLines} emptyLabel="No salary or additional earnings recorded for this period." tone="emerald" />
        <BreakdownSection id="commissions" title="Commission breakdown" subtitle="Commission generated from eligible marketing and sales activity." lines={commissionLines} emptyLabel="No commission recorded for this period." tone="amber" />
        <BreakdownSection id="deductions" title="Deduction breakdown" subtitle="Chama, lateness, discipline, penalties, and other approved deductions." lines={deductionLines} emptyLabel="No deductions recorded for this period." tone="rose" />
      </div>

      <section id="history" className="scroll-mt-36 rounded-[24px] border border-white/10 bg-[#091223] p-4 sm:scroll-mt-24 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Six-period comparison</h2>
            <p className="mt-1 text-sm text-slate-400">Compare net pay, commission, and deductions. Select any period for its complete breakdown.</p>
          </div>
          <div className="text-xs text-slate-500">Latest period first</div>
        </div>
        <div className="mt-5 space-y-3">
          {payrollPeriods.map((item) => {
            const selected = item.period.key === selectedPeriod.key;
            return (
              <Link key={item.period.key} href={pageHref(item.period.key)} className={`block rounded-2xl border p-4 transition ${selected ? "border-emerald-400/35 bg-emerald-400/[0.06]" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"}`}>
                <div className="grid gap-3 lg:grid-cols-[minmax(180px,1fr)_repeat(3,minmax(120px,.7fr))] lg:items-center">
                  <div>
                    <div className="font-medium text-white">{item.period.label}</div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400" style={{ width: `${Math.max(2, (item.breakdown.netPay / maximumNetPay) * 100)}%` }} /></div>
                  </div>
                  <div><div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Net pay</div><div className="mt-1 font-semibold text-emerald-200">{formatKes(item.breakdown.netPay)}</div></div>
                  <div><div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Commission</div><div className="mt-1 font-semibold text-amber-200">{formatKes(item.row.commissionTotal)}</div></div>
                  <div><div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Deductions</div><div className="mt-1 font-semibold text-rose-200">{formatKes(item.breakdown.totalDeductions)}</div></div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-3 rounded-[24px] border border-white/10 bg-[#091223] p-4 sm:grid-cols-2 sm:p-5">
        <a href={payslipHref} download className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-300"><Download className="h-4 w-4" />Download selected payslip</a>
        <a href={reportHref} download className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/15"><Download className="h-4 w-4" />Download performance report</a>
      </section>
    </div>
  );
}
