"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { CalendarIcon } from "lucide-react";
import ReceiptsEditor from "@/app/_components/ReceiptsEditor";
import StatsCard from "@/components/StatsCard";
import EarningsCard from "@/app/_components/EarningsCard";
import { getCommissionSummaryForSales } from "@/lib/marketingCommission";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import getLandingPage from "@/lib/getLandingPage";
import type { EarningsSummary } from "@/lib/earningsSummary";

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

type SupportSummary = {
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

const inputClasses =
  "w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";

const createItem = (): ReceiptItem => ({
  id: crypto.randomUUID(),
  productName: "",
  buyingPrice: "",
});

const createReceipt = (): ReceiptRow => ({
  id: crypto.randomUUID(),
  receiptNumber: "",
  sellingTotal: "",
  paymentMethod: "",
  items: [createItem()],
});

export default function SupportOpsPage() {
  const router = useRouter();
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [dayOfWeek, setDayOfWeek] = useState(() =>
    new Date().toLocaleDateString("en-KE", { weekday: "long" })
  );
  const [receipts, setReceipts] = useState<ReceiptRow[]>([createReceipt()]);
  const [newBatteries, setNewBatteries] = useState<number | "">("");
  const [changedBatteries, setChangedBatteries] = useState<number | "">("");
  const [periodSummary, setPeriodSummary] = useState<SupportSummary | null>(null);
  const [earningsSummary, setEarningsSummary] = useState<EarningsSummary | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const tradingPeriodLabel = useMemo(() => getTradingPeriodFor(new Date()).label, []);

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
        const data = await res.json();
        if (cancelled) return;
        const user = data?.user;
        if (!user) {
          router.replace("/attendant/login");
          return;
        }
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

  const refreshSummaries = useCallback(async () => {
    try {
      const [summaryRes, earningsRes] = await Promise.all([
        fetch("/api/support/report/summary", { credentials: "same-origin" }),
        fetch("/api/support/earnings/summary", { credentials: "same-origin" }),
      ]);

      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setPeriodSummary(data);
      }
      if (earningsRes.ok) {
        const data = await earningsRes.json();
        setEarningsSummary(data);
      }
    } catch {
      // ignore network failures; UI already shows optimistic numbers
    }
  }, []);

  useEffect(() => {
    if (initialized) {
      refreshSummaries();
    }
  }, [initialized, refreshSummaries]);

  const totals = useMemo(() => {
    return receipts.reduce(
      (acc, receipt) => {
        const sale = Number(receipt.sellingTotal || 0);
        acc.totalSales += sale;
        acc.totalItems += receipt.items.length;
        const buying = receipt.items.reduce(
          (sum, item) => sum + Number(item.buyingPrice || 0),
          0
        );
        acc.totalProfit += sale - buying;
        return acc;
      },
      { totalSales: 0, totalProfit: 0, totalItems: 0 }
    );
  }, [receipts]);

  const localNew = Number(newBatteries || 0);
  const localChanged = Number(changedBatteries || 0);

  const combinedSales = (periodSummary?.aggregates.totalSales ?? 0) + totals.totalSales;
  const combinedReceipts =
    (periodSummary?.aggregates.totalReceipts ?? 0) + receipts.length;
  const combinedItems = (periodSummary?.aggregates.totalItems ?? 0) + totals.totalItems;
  const combinedNew = (periodSummary?.aggregates.newBatteries ?? 0) + localNew;
  const combinedChanged =
    (periodSummary?.aggregates.changedBatteries ?? 0) + localChanged;
  const combinedBatteryEarnings = (combinedNew + combinedChanged) * 70;

  const commissionSummary = getCommissionSummaryForSales(combinedSales);

  const handleReset = () => {
    setReceipts([createReceipt()]);
    setNewBatteries("");
    setChangedBatteries("");
    setError(null);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const payload = {
        date,
        dayOfWeek,
        newBatteries: localNew,
        changedBatteries: localChanged,
        receipts: receipts.map((receipt) => ({
          receiptNumber: receipt.receiptNumber,
          sellingTotal: receipt.sellingTotal === "" ? 0 : Number(receipt.sellingTotal),
          paymentMethod: receipt.paymentMethod || "MPESA",
          items: receipt.items.map((item) => ({
            productName: item.productName,
            buyingPrice: item.buyingPrice === "" ? 0 : Number(item.buyingPrice),
          })),
        })),
      };

      const res = await fetch("/api/support/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Failed to submit support report.");
        return;
      }

      await refreshSummaries();
      handleReset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit support report.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        <p>Loading support dashboard…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <form className="mx-auto max-w-6xl space-y-6 p-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Support Operations</h1>
            <p className="text-sm text-slate-300">
              Daily tracker for sales, battery performance, and earnings.
            </p>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/attendant/login" })}
            className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 hover:border-white/40 hover:bg-white/10"
          >
            Log out
          </button>
        </header>

        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 px-6 py-4 md:px-8 md:py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-8">
            <div className="flex-1">
              <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
                Date
              </label>
            </div>
            <div className="md:flex md:items-center md:justify-end md:gap-3">
              <div className="md:w-[150px]">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={16} className="text-slate-400" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      const next = new Date(e.target.value);
                      if (!Number.isNaN(next.getTime())) {
                        setDayOfWeek(
                          next.toLocaleDateString("en-KE", { weekday: "long" })
                        );
                      }
                    }}
                    className={inputClasses}
                  />
                </div>
              </div>
              <div className="mt-3 md:mt-0 md:w-[150px]">
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(e.target.value)}
                  className={inputClasses}
                >
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(
                    (d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <ReceiptsEditor receipts={receipts} setReceipts={setReceipts} totals={totals} />

            <section className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/70 p-6">
              <h2 className="text-lg font-semibold">Battery performance</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs uppercase tracking-wide text-slate-400">
                    New batteries written
                  </label>
                  <input
                    type="number"
                    min={0}
                    className={inputClasses}
                    value={newBatteries}
                    onChange={(e) =>
                      setNewBatteries(e.target.value === "" ? "" : Number(e.target.value))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide text-slate-400">
                    Batteries changed
                  </label>
                  <input
                    type="number"
                    min={0}
                    className={inputClasses}
                    value={changedBatteries}
                    onChange={(e) =>
                      setChangedBatteries(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                  />
                </div>
              </div>
            </section>

            {error && (
              <div className="rounded-xl border border-rose-700/40 bg-rose-900/20 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="rounded-xl bg-emerald-500 px-6 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:opacity-60"
              >
                {isSubmitting ? "Submitting…" : "Submit report"}
              </button>
            </div>
          </div>

          <div className="space-y-4 lg:col-span-4">
            <StatsCard
              periodLabel={periodSummary?.period.label ?? tradingPeriodLabel}
              receipts={combinedReceipts}
              salesKes={combinedSales}
              items={combinedItems}
              commissionKes={commissionSummary.commission}
              currentSalesForTier={combinedSales}
              nextTarget={commissionSummary.nextTarget}
            />

            <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
              <h2 className="text-lg font-semibold">Battery stats</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <BatteryTile label="New batteries" value={combinedNew} />
                <BatteryTile label="Changed batteries" value={combinedChanged} />
              </div>
              <div className="mt-4 text-sm text-slate-400">Battery earnings</div>
              <div className="text-2xl font-semibold text-emerald-400">
                KES {combinedBatteryEarnings.toLocaleString()}
              </div>
            </section>

            <EarningsCard summary={earningsSummary} />
          </div>
        </div>
      </form>
    </div>
  );
}

function BatteryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-900/70 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-xl font-semibold text-emerald-400">{value}</p>
    </div>
  );
}
