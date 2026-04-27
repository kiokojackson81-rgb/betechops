"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { CalendarIcon } from "lucide-react";
import Card from "@/app/_components/Card";
import SensitiveValue from "@/components/SensitiveValue";
import Button from "@/app/_components/Button";
import { showToast } from "@/lib/ui/toast";
import PeriodSwitcher from "@/app/_components/PeriodSwitcher";
import useTradingPeriodQueryState from "@/app/_components/useTradingPeriodQueryState";
import { getCommissionSummaryForSales } from "@/lib/marketingCommission";
import getLandingPage from "@/lib/getLandingPage";
import { useCardLock, LockButton } from "@/app/_components/useCardLock";
import { buildEarningsCardBreakdown } from "@/lib/earningsCardBreakdown";
import { mapPayrollToEarningsSummary } from "@/lib/payrollMapping";
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
  const payslipHref = useMemo(() => `/api/attendant/payslip?periodKey=${encodeURIComponent(selectedPeriodKey)}`, [selectedPeriodKey]);
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
        const data = (await earningsRes.json().catch(() => null)) as any;
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
  }, [selectedPeriodKey]);

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

  const commissionSummary = useMemo(
    () => getCommissionSummaryForSales(combined.sales),
    [combined.sales],
  );

  const performanceBonus = (combined.newBatteries + combined.changedBatteries) * 70;
  const commissionDisplay =
    typeof earningsSummary?.salesCommission === "number"
      ? earningsSummary.salesCommission
      : commissionSummary.commission;

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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <form onSubmit={handleSubmit} className="mx-auto max-w-6xl space-y-6 p-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Support Operations</h1>
            <p className="text-sm text-slate-300">
              Sales capture, performance tracking, and quick earnings breakdown.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {currentUserId ? (
              <Link
                href={`/receipts?attendantId=${encodeURIComponent(currentUserId)}`}
                className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/40 hover:bg-white/10"
              >
                Receipts
              </Link>
            ) : null}
            <Link
              href={wellnessHref}
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/40 hover:bg-white/10"
            >
              Wellness
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/attendant/login" })}
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/40 hover:bg-white/10"
            >
              Log out
            </button>
          </div>
        </header>

        <div className="flex flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-950/70 px-6 py-4 md:px-8 md:py-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Statistics period</p>
              <p className="text-lg font-semibold text-slate-100">{selectedPeriod.label}</p>
              {selectedPeriodKey !== currentPeriod.key && (
                <p className="text-xs text-amber-300">Showing archived period.</p>
              )}
            </div>
            <PeriodSwitcher
              currentPeriod={currentPeriod}
              selectedPeriod={selectedPeriod}
              onSelectPeriod={setSelectedPeriod}
            />
          </div>
        </div>

        <Card className="border-slate-800 bg-slate-950/70">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Date</p>
              <div className="mt-2 flex items-center gap-2">
                <CalendarIcon size={16} className="text-slate-400" />
                <input
                  type="date"
                  value={date}
                  onChange={(event) => {
                    setDate(event.target.value);
                    const next = new Date(event.target.value);
                    if (!Number.isNaN(next.getTime())) {
                      setDayOfWeek(
                        next.toLocaleDateString("en-KE", { weekday: "long" }),
                      );
                    }
                  }}
                  className={inputClasses}
                />
              </div>
            </div>
            <div className="w-full md:w-auto">
              <p className="text-xs uppercase tracking-wide text-slate-400">Day</p>
              <select
                value={dayOfWeek}
                onChange={(event) => setDayOfWeek(event.target.value)}
                className={inputClasses}
              >
                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(
                  (day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <section className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/70 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    Performance (Support Ops)
                  </p>
                  <h2 className="text-lg font-semibold">Battery metrics</h2>
                </div>
                <div className="rounded-full border border-emerald-500/30 px-3 py-1 text-xs text-emerald-200">
                  70 KES per battery
                </div>
              </div>
              <div className="space-y-4">
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
            </section>

            {error && (
              <div className="rounded-xl border border-rose-700/40 bg-rose-900/20 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-3">
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
          </div>

          <div className="space-y-4 lg:col-span-4">
            <SupportQuickStats
              periodLabel={periodLabel}
              receipts={combined.receipts}
              salesKes={combined.sales}
              items={combined.items}
              commissionKes={commissionDisplay}
              newBatteries={combined.newBatteries}
              changedBatteries={combined.changedBatteries}
              performanceBonus={performanceBonus}
              currentSalesForTier={combined.sales}
              nextTarget={commissionSummary.nextTarget ?? null}
            />

            <SupportEarningsCard summary={earningsSummary} downloadHref={payslipHref} />
          </div>
        </div>
      </form>
    </div>
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
  currentSalesForTier,
  nextTarget,
}: {
  periodLabel: string;
  receipts: number;
  salesKes: number;
  items: number;
  commissionKes: number;
  newBatteries: number;
  changedBatteries: number;
  performanceBonus: number;
  currentSalesForTier: number;
  nextTarget: number | null;
}) {
  const totalBatteries = newBatteries + changedBatteries;
  const remaining =
    typeof nextTarget === "number" && nextTarget > currentSalesForTier
      ? nextTarget - currentSalesForTier
      : 0;
  const reachedTop = !nextTarget || remaining <= 0;
  const progress =
    typeof nextTarget === "number" && nextTarget > 0
      ? Math.min((currentSalesForTier / nextTarget) * 100, 100)
      : 100;

    const { locked, toggle } = useCardLock("support:quickstats");
    const mask = (v: React.ReactNode) => (locked ? "•••" : v);

    const stats = [
    { label: "Receipts", value: safeLocale(receipts) },
    { label: "Sales (KES)", value: safeLocale(salesKes) },
    { label: "Items sold", value: safeLocale(items) },
    // commission shown using SensitiveValue so it can be hidden; unhide requires login
    {
      label: "Commission (KES)",
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
      label: "Total commission",
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
    <Card className="space-y-5 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Quick stats</h2>
          <p className="text-xs text-slate-400">{periodLabel}</p>
        </div>
        <LockButton locked={locked} onToggle={toggle} />
      </div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
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
          Progress to next tier
        </p>
        <p className="text-xs text-slate-200">
          {reachedTop
            ? "Reached highest tier for this period"
            : `KES ${safeLocale(remaining)} more to unlock the next tier`}
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
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
    <Card className="space-y-4 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
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
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-slate-100">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(event) =>
          onChange(event.target.value === "" ? "" : Number(event.target.value))
        }
        className="w-28 rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-right text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
      />
    </div>
  );
}
