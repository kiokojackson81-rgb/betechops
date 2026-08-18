"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarIcon, FileDown, Receipt, WalletCards } from "lucide-react";
import Card from "@/app/_components/Card";
import SensitiveValue from "@/components/SensitiveValue";
import Button from "@/app/_components/Button";
import { showToast } from "@/lib/ui/toast";
import PeriodSwitcher from "@/app/_components/PeriodSwitcher";
import useTradingPeriodQueryState from "@/app/_components/useTradingPeriodQueryState";
import getLandingPage from "@/lib/getLandingPage";
import { useCardLock, LockButton } from "@/app/_components/useCardLock";
import { buildEarningsCardBreakdown } from "@/lib/earningsCardBreakdown";
import { mapPayrollToEarningsSummary, type PayrollSummary } from "@/lib/payrollMapping";
import { withImpersonateId } from "@/lib/impersonation";

type PaymentMethod = "MPESA" | "CASH" | "";

type ReceiptItem = {
  id: string;
  productName: string;
  buyingPrice: number | "";
};

type ReceiptRow = {
  id: string;
  receiptNumber: string;
  sellingTotal: number | "";
  paymentMethod: PaymentMethod;
  items: ReceiptItem[];
};

type SupportSummaryResponse = {
  period: { key: string; label: string; start: string; end: string };
  aggregates: {
    totalSales: number;
    totalProfit: number;
    totalReceipts: number;
    totalItems: number;
    newBatteries: number;
    changedBatteries: number;
    batteryEarnings: number;
    commission: number;
    directCommission?: number;
  };
};

type SupportEarningsSummary = {
  periodLabel: string;
  baseSalary: number;
  transportAllowance: number;
  salesCommission: number;
  batteryEarnings: number;
  bonusTotal: number;
  chamaTotal: number;
  latenessTotal: number;
  disciplineTotal: number;
  otherDeductionsTotal: number;
  netPay: number;
  adjustmentEntries?: { id: string; label: string; amount: number; adjustmentType: string; adjustmentKind: string }[];
};

type PayrollSummaryResponse = {
  row?: PayrollSummary | null;
  rows?: PayrollSummary[];
};

const inputClasses =
  "w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";

const safeLocale = (value?: number | null, fallback = "0") => {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num.toLocaleString() : fallback;
};

export default function SupportOpsPage() {
  const router = useRouter();
  const [impersonateId, setImpersonateId] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [dayOfWeek, setDayOfWeek] = useState(() =>
    new Date().toLocaleDateString("en-KE", { weekday: "long" })
  );
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [newBatteries, setNewBatteries] = useState<number | "">("");
  const [changedBatteries, setChangedBatteries] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [serverSummary, setServerSummary] = useState<SupportSummaryResponse | null>(
    null,
  );
  const [earningsSummary, setEarningsSummary] = useState<SupportEarningsSummary | null>(
    null,
  );
  const { currentPeriod, selectedPeriod, selectedPeriodKey, setSelectedPeriod } =
    useTradingPeriodQueryState();
  const tradingPeriodLabel = selectedPeriod.label;
  const payslipHref = useMemo(() => {
    const params = new URLSearchParams({ periodKey: selectedPeriodKey });
    if (impersonateId) params.set("impersonateId", impersonateId);
    return `/api/attendant/payslip?${params.toString()}`;
  }, [impersonateId, selectedPeriodKey]);
  const performanceReportHref = useMemo(() => {
    const params = new URLSearchParams({ periodKey: selectedPeriodKey });
    if (impersonateId) params.set("impersonateId", impersonateId);
    params.set("ts", String(Date.now()));
    return `/api/attendant/daily-report/performance-receipt/pdf?${params.toString()}`;
  }, [impersonateId, selectedPeriodKey]);
  const wellnessHref = useMemo(
    () => withImpersonateId("/attendant/wellness", impersonateId),
    [impersonateId],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setImpersonateId(params.get("impersonateId"));
  }, []);

  // Guard route for support attendants
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/attendants/me", { credentials: "same-origin" });
        if (!res.ok) {
          router.replace("/attendant/login");
          return;
        }
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        const user = data?.user;
        if (!user) {
          router.replace("/attendant/login");
          return;
        }
        setCurrentUserId(typeof user.id === "string" ? user.id : null);
        const category = user.attendantCategory as string | undefined;
        const role = user.role as string | undefined;
        if (role === "ADMIN" || category === "SUPPORT_OPS") {
          setInitialized(true);
          return;
        }
        router.replace(getLandingPage(category, role));
      } catch {
        if (!cancelled) router.replace("/attendant/login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const fetchSummaries = useCallback(async () => {
    try {
      const summaryParams = new URLSearchParams({ periodKey: selectedPeriodKey });
      const earningsParams = new URLSearchParams({ periodKey: selectedPeriodKey });
      if (impersonateId) {
        summaryParams.set("impersonateId", impersonateId);
        earningsParams.set("attendantId", impersonateId);
      }
      const [summaryRes, earningsRes] = await Promise.all([
        fetch(`/api/support/report/summary?${summaryParams.toString()}`, { credentials: "same-origin" }),
        fetch(`/api/payroll/summary?${earningsParams.toString()}`, { credentials: "same-origin" }),
      ]);
      if (summaryRes.ok) {
        const data = (await summaryRes.json().catch(() => null)) as
          | SupportSummaryResponse
          | null;
        if (data) setServerSummary(data);
      }
      if (earningsRes.ok) {
        const data = (await earningsRes.json().catch(() => null)) as PayrollSummaryResponse | null;
        const row = data?.row ?? data?.rows?.[0] ?? null;
        if (row) {
          setEarningsSummary(
            mapPayrollToEarningsSummary(row, Number(row.totalReceipts ?? 0)) as unknown as SupportEarningsSummary,
          );
        }
      }
    } catch {
      // no-op; UI already reflects optimistic data
    }
  }, [impersonateId, selectedPeriodKey]);

  useEffect(() => {
    if (!initialized) return;
    fetchSummaries();
    const interval = setInterval(fetchSummaries, 15_000);
    return () => clearInterval(interval);
  }, [fetchSummaries, initialized]);

  const totals = useMemo(() => {
    return receipts.reduce(
      (acc, receipt) => {
        const sale = Number(receipt.sellingTotal || 0);
        acc.totalSales += sale;
        acc.totalItems += receipt.items.length;
        const buying = receipt.items.reduce(
          (sum, item) => sum + Number(item.buyingPrice || 0),
          0,
        );
        acc.totalProfit += sale - buying;
        return acc;
      },
      { totalSales: 0, totalProfit: 0, totalItems: 0 },
    );
  }, [receipts]);

  const localPerformance = useMemo(
    () => ({
      new: Number(newBatteries || 0),
      changed: Number(changedBatteries || 0),
    }),
    [changedBatteries, newBatteries],
  );

  const combined = useMemo(() => {
    const aggregates = serverSummary?.aggregates;
    const base = {
      sales: aggregates?.totalSales ?? 0,
      receipts: aggregates?.totalReceipts ?? 0,
      items: aggregates?.totalItems ?? 0,
      newBatteries: aggregates?.newBatteries ?? 0,
      changedBatteries: aggregates?.changedBatteries ?? 0,
    };
    return {
      sales: base.sales + totals.totalSales,
      receipts: base.receipts + receipts.length,
      items: base.items + totals.totalItems,
      newBatteries: base.newBatteries + localPerformance.new,
      changedBatteries: base.changedBatteries + localPerformance.changed,
    };
  }, [localPerformance, receipts.length, serverSummary?.aggregates, totals]);

  const performanceBonus = (combined.newBatteries + combined.changedBatteries) * 70;
  const commissionDisplay = Number(
    serverSummary?.aggregates.directCommission ??
      serverSummary?.aggregates.commission ??
      earningsSummary?.salesCommission ??
      0,
  );

  const handleReset = () => {
    setReceipts([]);
    setNewBatteries("");
    setChangedBatteries("");
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        date,
        dayOfWeek,
        receipts: receipts.map((receipt) => ({
          receiptNumber: receipt.receiptNumber,
          sellingTotal: receipt.sellingTotal === "" ? 0 : Number(receipt.sellingTotal),
          paymentMethod: receipt.paymentMethod || "MPESA",
          items: receipt.items.map((item) => ({
            productName: item.productName,
            buyingPrice: 0,
          })),
        })),
        performance: {
          newBatteries: localPerformance.new,
          changedBatteries: localPerformance.changed,
        },
      };

      const res = await fetch("/api/support/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = data?.error || "Failed to submit support report.";
        setError(message);
        showToast(message, "error");
        return;
      }

      showToast("Support report submitted", "success");
      handleReset();
      fetchSummaries();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to submit support report.";
      setError(message);
      showToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        <p>Loading support dashboard.</p>
      </div>
    );
  }

  const periodLabel = serverSummary?.period.label ?? tradingPeriodLabel;

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-[1400px] space-y-5 sm:space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-cyan-400/15 bg-gradient-to-br from-[#132235] via-[#0d1929] to-[#07111f] p-5 shadow-2xl shadow-black/20 sm:p-7">
          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr] xl:items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-cyan-200">Support desk</p>
              <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">Keep customer support activity and daily performance in one place.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">Capture battery activity, monitor receipt performance, and review the earnings generated during the selected period.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <a href="#daily-report" className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300">Complete daily report <ArrowRight className="h-4 w-4" /></a>
                {currentUserId ? <Link href={`/receipts?attendantId=${encodeURIComponent(currentUserId)}`} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-sm text-white transition hover:bg-white/5"><Receipt className="h-4 w-4" />View receipts</Link> : null}
                <Link href={wellnessHref} className="inline-flex items-center rounded-full border border-white/15 px-4 py-2.5 text-sm text-white transition hover:bg-white/5">Wellness</Link>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-[#081426]/80 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Statistics period</p>
              <p className="mt-2 text-xl font-semibold text-white">{selectedPeriod.label}</p>
              <p className="mt-1 text-sm text-slate-400">{selectedPeriodKey === currentPeriod.key ? "Current active period" : "Archived performance period"}</p>
              <div className="my-4 h-px bg-white/10" />
              <div className="flex flex-wrap gap-2">
                <PeriodSwitcher
                  currentPeriod={currentPeriod}
                  selectedPeriod={selectedPeriod}
                  onSelectPeriod={setSelectedPeriod}
                />
                <a href={performanceReportHref} download className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-100"><FileDown className="h-4 w-4" />Report</a>
              </div>
            </div>
          </div>
        </section>

        <section id="performance" className="scroll-mt-36">
          <SupportQuickStats
            periodLabel={periodLabel}
            receipts={combined.receipts}
            salesKes={combined.sales}
            items={combined.items}
            commissionKes={commissionDisplay}
            newBatteries={combined.newBatteries}
            changedBatteries={combined.changedBatteries}
            performanceBonus={performanceBonus}
            totalProfit={Number(serverSummary?.aggregates.totalProfit ?? totals.totalProfit)}
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-12">
          <section id="daily-report" className="scroll-mt-36 space-y-5 rounded-3xl border border-white/10 bg-[#0d1828] p-4 sm:p-6 lg:col-span-7">
              <div className="flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Daily activity</p>
                  <h2 className="mt-1 text-xl font-semibold text-white">Battery performance report</h2>
                  <p className="mt-1 text-sm text-slate-400">Record completed battery support work for payroll and reporting.</p>
                </div>
                <div className="w-fit rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1 text-xs text-emerald-200">KES 70 per battery</div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-slate-400">Report date</span>
                  <div className="mt-2 flex items-center gap-2"><CalendarIcon size={16} className="text-slate-400" /><input type="date" value={date} onChange={(event) => { setDate(event.target.value); const next = new Date(event.target.value); if (!Number.isNaN(next.getTime())) setDayOfWeek(next.toLocaleDateString("en-KE", { weekday: "long" })); }} className={inputClasses} /></div>
                </label>
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-slate-400">Day</span>
                  <select value={dayOfWeek} onChange={(event) => setDayOfWeek(event.target.value)} className={`${inputClasses} mt-2`}>
                    {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => <option key={day} value={day}>{day}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <NumberRow
                  label="New batteries written"
                  value={newBatteries}
                  onChange={setNewBatteries}
                />
                <NumberRow
                  label="Batteries changed"
                  value={changedBatteries}
                  onChange={setChangedBatteries}
                />
              </div>

              {error && <div className="rounded-xl border border-rose-700/40 bg-rose-900/20 px-4 py-3 text-sm text-rose-200">{error}</div>}

            <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={handleReset}
                className="px-5"
              >
                Reset
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={submitting}
                className="bg-emerald-500 px-6 text-black hover:brightness-95 disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Submit report"}
              </Button>
            </div>
          </section>

          <section id="earnings" className="scroll-mt-36 space-y-4 lg:col-span-5">
            <div className="flex items-center gap-3 px-1"><WalletCards className="h-5 w-5 text-emerald-300" /><div><h2 className="font-semibold text-white">Earnings & payroll</h2><p className="text-sm text-slate-400">Current selected-period breakdown</p></div></div>
            <SupportEarningsCard summary={earningsSummary} downloadHref={payslipHref} />
          </section>
        </div>
      </form>
  );
}

function SupportQuickStats({
  periodLabel,
  receipts,
  salesKes,
  items,
  commissionKes,
  newBatteries,
  changedBatteries,
  performanceBonus,
  totalProfit,
}: {
  periodLabel: string;
  receipts: number;
  salesKes: number;
  items: number;
  commissionKes: number;
  newBatteries: number;
  changedBatteries: number;
  performanceBonus: number;
  totalProfit: number;
}) {
  const totalBatteries = newBatteries + changedBatteries;

    const { locked, toggle } = useCardLock("support:quickstats");
    const mask = (v: React.ReactNode) => (locked ? "•••" : v);

    const stats = [
    { label: "Receipts", value: safeLocale(receipts) },
    { label: "Sales (KES)", value: safeLocale(salesKes) },
    { label: "Items sold", value: safeLocale(items) },
    // commission shown using SensitiveValue so it can be hidden; unhide requires login
    {
      label: "POS commission (KES)",
      value: (
        <SensitiveValue
          value={commissionKes}
          format={(v) => `KES ${Number(v).toLocaleString()}`}
          storageKey={`support:commission`}
          forceHidden={locked}
          forceVisible={!locked}
        />
      ),
    },
    { label: "New batteries", value: safeLocale(newBatteries) },
    { label: "Changed batteries", value: safeLocale(changedBatteries) },
    { label: "Total batteries", value: safeLocale(totalBatteries) },
    {
      label: "Performance earnings",
      value: mask(`KES ${safeLocale(performanceBonus)}`),
    },
    // Placeholder total commission: commission + performance earnings
    {
      label: "POS + performance",
      value: (
        <SensitiveValue
          value={commissionKes + performanceBonus}
          format={(v) => `KES ${safeLocale(Number(v))}`}
          storageKey={`support:total-commission`}
          forceHidden={locked}
          forceVisible={!locked}
        />
      ),
    },
  ];

  return (
    <Card className="space-y-5 border-white/10 bg-[#0d1828] shadow-xl shadow-black/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Quick stats</h2>
          <p className="text-xs text-slate-400">{periodLabel}</p>
        </div>
        <LockButton locked={locked} onToggle={toggle} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl bg-slate-950/60 px-3 py-2 text-left"
          >
            <p className="text-[10px] uppercase tracking-wide text-slate-400">
              {stat.label}
            </p>
            <p className="mt-1 text-lg font-semibold text-emerald-400">
              {typeof stat.value === "string" || typeof stat.value === "number"
                ? mask(stat.value)
                : stat.value}
            </p>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-400">
          Commission basis
        </p>
        <p className="text-xs text-slate-200">
          {mask(
            `10% of POS receipt profit. Current profit total: KES ${safeLocale(totalProfit)}. Any extra support adjustment appears separately in payroll.`
          )}
        </p>
      </div>
    </Card>
  );
}

function SupportEarningsCard({
  summary,
  downloadHref,
}: {
  summary: SupportEarningsSummary | null;
  downloadHref?: string;
}) {
  const { locked, toggle } = useCardLock("support:earnings");
  if (!summary) return null;
  const mask = (v: React.ReactNode) => (locked ? "•••" : v);
  const breakdown = buildEarningsCardBreakdown(summary);

  const formatCurrency = (value: number) => `KES ${value.toLocaleString()}`;

  return (
    <Card className="space-y-4 border-white/10 bg-[#0d1828] shadow-xl shadow-black/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Earnings this period
            </p>
            <p className="text-sm text-slate-400">{summary.periodLabel}</p>
          </div>
          <LockButton locked={locked} onToggle={toggle} />
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Net pay</p>
          <p className="text-2xl font-semibold text-emerald-300">
            {mask(formatCurrency(breakdown.netPay))}
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {breakdown.lines.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between rounded-xl bg-slate-950/40 px-3 py-2"
          >
            <span className="text-sm text-slate-300">{row.label}</span>
            <span className={`font-semibold ${row.kind === "deduction" ? "text-rose-300" : "text-emerald-300"}`}>
              {mask(`${row.kind === "deduction" ? "-" : ""}${formatCurrency(Math.abs(row.amount))}`)}
            </span>
          </div>
        ))}
      </div>
      {downloadHref ? (
        <div className="pt-1">
          <Link
            href={downloadHref}
            className="inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/30 hover:bg-white/10"
          >
            Download payslip
          </Link>
        </div>
      ) : null}
    </Card>
  );
}

function NumberRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | "";
  onChange: (value: number | "") => void;
}) {
  return (
    <label className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <span className="text-sm text-slate-200">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(event) =>
          onChange(event.target.value === "" ? "" : Number(event.target.value))
        }
        className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-3 text-right text-lg font-semibold text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
      />
    </label>
  );
}
