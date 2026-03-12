"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { showToast } from "@/lib/ui/toast";
import { withImpersonateId } from "@/lib/impersonation";

const currency = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type DividedAccountRow = {
  key: string;
  label: string;
  accountId: string | null;
  shopId: string | null;
  salesNetPayout: number;
  profit: number;
  buyingTotal: number;
  pricedNetPayout: number;
  returns: number;
  duplicateCount: number;
  grossProfit: number;
};

type DividedPayload = {
  week: { weekStart: string; weekEnd: string; weekStartInput: string };
  draftTableAvailable: boolean;
  accounts: DividedAccountRow[];
  totals: { sales: number; profit: number; returns: number; grossProfit: number; duplicates: number };
};

function numberOr(value: unknown, fallback: number) {
  const n = typeof value === "number" ? value : Number(value ?? NaN);
  return Number.isFinite(n) ? n : fallback;
}

function clamp0(n: number) {
  return n < 0 ? 0 : n;
}

export default function DividedViewClient(props: {
  weekStart: string;
  periodKey: string;
  impersonateId?: string | null;
}) {
  const storageKey = `betechops:divided:v1:${props.weekStart}`;

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DividedPayload | null>(null);

  const [expenses, setExpenses] = useState<number>(25000);
  const [lowSellerScore, setLowSellerScore] = useState<number>(10000);
  const [dividendRatePct, setDividendRatePct] = useState<number>(7);
  const [coopLoan, setCoopLoan] = useState<number>(0);
  const [otherDeduction, setOtherDeduction] = useState<number>(0);
  const [mpesaTo0722, setMpesaTo0722] = useState<number>(35000);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as any;
      setExpenses(numberOr(parsed?.expenses, 25000));
      setLowSellerScore(numberOr(parsed?.lowSellerScore, 10000));
      setDividendRatePct(numberOr(parsed?.dividendRatePct, 7));
      setCoopLoan(numberOr(parsed?.coopLoan, 0));
      setOtherDeduction(numberOr(parsed?.otherDeduction, 0));
      setMpesaTo0722(numberOr(parsed?.mpesaTo0722, 35000));
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ expenses, lowSellerScore, dividendRatePct, coopLoan, otherDeduction, mpesaTo0722 }),
      );
    } catch {
      // ignore
    }
  }, [storageKey, expenses, lowSellerScore, dividendRatePct, coopLoan, otherDeduction, mpesaTo0722]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        weekStart: props.weekStart,
        periodKey: props.periodKey,
        _: String(Date.now()),
      });
      const res = await fetch(
        withImpersonateId(
          `/api/admin/online/summary/divided?${qs.toString()}`,
          props.impersonateId ?? null,
        ),
        {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, max-age=0, must-revalidate",
            Pragma: "no-cache",
          },
        },
      );
      const body = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(String(body?.error ?? "Failed to load divided summary"));
      setData(body as DividedPayload);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load divided summary", "error");
    } finally {
      setLoading(false);
    }
  }, [props.weekStart, props.periodKey, props.impersonateId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    const onFocus = () => {
      void fetchData();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchData();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchData]);

  const derived = useMemo(() => {
    const totals = data?.totals ?? { sales: 0, profit: 0, returns: 0, grossProfit: 0 };
    const baseProfit = totals.profit - expenses - lowSellerScore;
    const dividend = clamp0((baseProfit * dividendRatePct) / 100);
    const afterDividend = baseProfit - dividend;
    const afterDeductions = afterDividend - coopLoan - otherDeduction;

    const hitech = (data?.accounts ?? []).find((a) => a.key === "hitech-power") ?? null;
    const hitechPayout = hitech?.salesNetPayout ?? 0;
    const equityBalance = hitechPayout - dividend - mpesaTo0722 - coopLoan - otherDeduction;

    return {
      baseProfit,
      dividend,
      afterDividend,
      afterDeductions,
      hitechPayout,
      equityBalance,
    };
  }, [data, expenses, lowSellerScore, dividendRatePct, coopLoan, otherDeduction, mpesaTo0722]);

  const downloadPdf = () => {
    const deductionsJson = encodeURIComponent(
      JSON.stringify({
        expenses,
        lowSellerScore,
        dividendRatePct,
        coopLoan,
        otherDeduction,
        mpesaTo0722,
        weekStart: props.weekStart,
      }),
    );
    const url = withImpersonateId(
      `/api/admin/online/summary/divided/pdf?weekStart=${encodeURIComponent(props.weekStart)}&d=${deductionsJson}`,
      props.impersonateId ?? null,
    );
    window.open(url, "_blank");
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Divided (Jumia â€” 4 accounts)</h2>
          <p className="text-sm text-slate-400">
            Week: <span className="text-slate-200">{props.weekStart}</span> â€” updates as buying prices are submitted.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void fetchData()}
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button
            type="button"
            onClick={downloadPdf}
            className="rounded-full border border-emerald-500/50 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-50"
            disabled={loading || !data}
            title="Download investor summary as PDF"
          >
            Download PDF
          </button>
        </div>
      </div>

      {!data ? (
        <div className="mt-4 text-sm text-slate-400">{loading ? "Loading..." : "No data yet."}</div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 lg:col-span-2">
            <div className="text-xs uppercase tracking-wide text-slate-400">Accounts breakdown</div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4">Account</th>
                    <th className="py-2 pr-4 text-right">Sales</th>
                    <th className="py-2 pr-4 text-right">Duplicates</th>
                    <th className="py-2 pr-4 text-right">Returns</th>
                    <th className="py-2 pr-4 text-right">Gross profit</th>
                    <th className="py-2 pr-4 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {data.accounts.map((a) => (
                    <tr key={a.key} className="border-t border-white/5">
                      <td className="py-3 pr-4 font-medium text-white">{a.label}</td>
                      <td className="py-3 pr-4 text-right font-semibold text-emerald-300">{currency.format(a.salesNetPayout)}</td>
                      <td className={`py-3 pr-4 text-right font-semibold ${a.duplicateCount > 0 ? "text-rose-300" : "text-slate-300"}`}>
                        {a.duplicateCount}
                      </td>
                      <td className="py-3 pr-4 text-right text-slate-200">{currency.format(a.returns)}</td>
                      <td className="py-3 pr-4 text-right text-slate-200">{currency.format(a.grossProfit)}</td>
                      <td className="py-3 pr-4 text-right font-semibold text-slate-100">{currency.format(a.profit)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/10">
                    <td className="py-3 pr-4 font-semibold text-white">Totals</td>
                    <td className="py-3 pr-4 text-right font-semibold text-emerald-300">{currency.format(data.totals.sales)}</td>
                    <td className={`py-3 pr-4 text-right font-semibold ${data.totals.duplicates > 0 ? "text-rose-300" : "text-slate-300"}`}>
                      {data.totals.duplicates}
                    </td>
                    <td className="py-3 pr-4 text-right text-slate-200">{currency.format(data.totals.returns)}</td>
                    <td className="py-3 pr-4 text-right text-slate-200">{currency.format(data.totals.grossProfit)}</td>
                    <td className="py-3 pr-4 text-right font-semibold text-slate-100">{currency.format(data.totals.profit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {!data.draftTableAvailable ? (
              <div className="mt-3 text-xs text-amber-200/90">
                Returns may show as 0 because draft storage isnâ€™t available in the DB yet.
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">Deductions</div>
            <div className="mt-3 space-y-3">
              <label className="block">
                <div className="mb-1 text-xs text-slate-400">Expenses</div>
                <input
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  inputMode="numeric"
                  value={expenses}
                  onChange={(e) => setExpenses(numberOr(e.target.value, 0))}
                />
              </label>
              <label className="block">
                <div className="mb-1 text-xs text-slate-400">Low seller score</div>
                <input
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  inputMode="numeric"
                  value={lowSellerScore}
                  onChange={(e) => setLowSellerScore(numberOr(e.target.value, 0))}
                />
              </label>
              <label className="block">
                <div className="mb-1 text-xs text-slate-400">Dividend rate (%)</div>
                <input
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  inputMode="decimal"
                  value={dividendRatePct}
                  onChange={(e) => setDividendRatePct(numberOr(e.target.value, 7))}
                />
              </label>
              <label className="block">
                <div className="mb-1 text-xs text-slate-400">Coop loan</div>
                <input
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  inputMode="numeric"
                  value={coopLoan}
                  onChange={(e) => setCoopLoan(numberOr(e.target.value, 0))}
                />
              </label>
              <label className="block">
                <div className="mb-1 text-xs text-slate-400">Other deduction</div>
                <input
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  inputMode="numeric"
                  value={otherDeduction}
                  onChange={(e) => setOtherDeduction(numberOr(e.target.value, 0))}
                />
              </label>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">Divided result</div>
              <div className="mt-2 space-y-1 text-sm text-slate-200">
                <div className="flex justify-between">
                  <span>Base profit</span>
                  <span className="font-semibold text-white">{currency.format(derived.baseProfit)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Divided ({dividendRatePct}%)</span>
                  <span className="font-semibold text-emerald-300">{currency.format(derived.dividend)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Balance</span>
                  <span className="font-semibold text-white">{currency.format(derived.afterDeductions)}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">Hitech payout instruction</div>
              <label className="mt-2 block">
                <div className="mb-1 text-xs text-slate-400">Send to 0722151083</div>
                <input
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  inputMode="numeric"
                  value={mpesaTo0722}
                  onChange={(e) => setMpesaTo0722(numberOr(e.target.value, 0))}
                />
              </label>
              <div className="mt-3 space-y-1 text-sm text-slate-200">
                <div className="flex justify-between">
                  <span>Hitech payout (sales)</span>
                  <span className="font-semibold text-white">{currency.format(derived.hitechPayout)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Less divided</span>
                  <span className="font-semibold text-rose-300">- {currency.format(derived.dividend)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Less MPESA 0722151083</span>
                  <span className="font-semibold text-rose-300">- {currency.format(mpesaTo0722)}</span>
                </div>
                {(coopLoan + otherDeduction) > 0 ? (
                  <div className="flex justify-between">
                    <span>Less other deductions</span>
                    <span className="font-semibold text-rose-300">- {currency.format(coopLoan + otherDeduction)}</span>
                  </div>
                ) : null}
                <div className="mt-2 flex justify-between border-t border-white/10 pt-2">
                  <span className="font-semibold text-white">Send to Equity</span>
                  <span className="font-semibold text-emerald-300">{currency.format(derived.equityBalance)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
