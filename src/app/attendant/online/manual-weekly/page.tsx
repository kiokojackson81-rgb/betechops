"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ToastContainer from "@/app/_components/ToastContainer";
import MarketplaceWeeklyCsvUpload from "@/app/_components/MarketplaceWeeklyCsvUpload.client";
import { showToast } from "@/lib/ui/toast";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { ATTENDANT_ONLINE_OPS_WEEK_COUNT, getOnlineOpsWeeksForTradingPeriod } from "@/lib/onlineOpsWeeks";

type Platform = "JUMIA" | "KILIMALL";
type WeeklySaleSource = "MANUAL" | "CSV" | "API" | "SYSTEM";
type WeeklySaleStatus = "PENDING" | "APPROVED" | "REJECTED";

const WEEKLY_SALE_SOURCE = {
  MANUAL: "MANUAL",
} as const;

const WEEKLY_SALE_STATUS = {
  PENDING: "PENDING",
} as const;

type ShopPayload = {
  id: string;
  shopName: string | null;
  displayName: string | null;
  platform: Platform;
  attendants: Array<{ id: string; name: string | null; email: string | null }>;
  primaryAttendant: { id: string; name: string | null; email: string | null } | null;
};

type WeeklySaleRow = {
  id: string;
  shopId: string | null;
  userId: string | null;
  platform: Platform;
  weekStart: string;
  weekEnd: string;
  amount: string | number;
  status: WeeklySaleStatus;
  source: WeeklySaleSource;
  createdBy?: string | null;
  shop?: { id: string; name: string | null; platform: Platform } | null;
  user?: { id: string; name: string | null; email: string | null } | null;
};

const currency = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

export default function AttendantManualWeeklyPage() {
  const [meId, setMeId] = useState<string>("");
  const [isBenjamin, setIsBenjamin] = useState(false);
  const [shops, setShops] = useState<ShopPayload[]>([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [sales, setSales] = useState<WeeklySaleRow[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [weekStart, setWeekStart] = useState("");

  const period = useMemo(() => getTradingPeriodFor(new Date()), []);
  const weeks = useMemo(
    () => getOnlineOpsWeeksForTradingPeriod(period, new Date(), ATTENDANT_ONLINE_OPS_WEEK_COUNT),
    [period],
  );

  useEffect(() => {
    const last = weeks.at(-1);
    if (!last) return;
    setWeekStart(last.startInput);
  }, [weeks]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/attendants/me", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as any;
      const email = String(data?.user?.email ?? data?.data?.user?.email ?? "").toLowerCase();
      const id = String(data?.user?.id ?? data?.data?.user?.id ?? "");
      setMeId(id);
      setIsBenjamin(email === "benjamin@betech.co.ke");
    })().catch(() => {});
  }, []);

  const loadShops = async () => {
    setShopsLoading(true);
    try {
      const res = await fetch("/api/admin/online/manual/shops", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(data?.error || "Failed to load shops");
      setShops(Array.isArray(data) ? (data as ShopPayload[]) : []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load shops", "error");
    } finally {
      setShopsLoading(false);
    }
  };

  const loadSales = async () => {
    setSalesLoading(true);
    try {
      const res = await fetch("/api/admin/weekly-sale?source=MANUAL", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(data?.error || "Failed to load weekly sales");
      setSales(Array.isArray(data) ? (data as WeeklySaleRow[]) : []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load weekly sales", "error");
    } finally {
      setSalesLoading(false);
    }
  };

  useEffect(() => {
    if (!isBenjamin) return;
    void loadShops();
    void loadSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBenjamin]);

  const weekOptions = useMemo(() => {
    return weeks.map((w) => ({
      key: w.key,
      startInput: w.startInput,
      endInput: w.weekEndInclusive.toISOString().slice(0, 10),
      label: w.label,
    }));
  }, [weeks]);

  const csvWeeks = useMemo(
    () => weekOptions.map((w) => ({ startInput: w.startInput, endInput: w.endInput, label: w.label.replace(/–/g, "-") })),
    [weekOptions],
  );

  const csvShops = useMemo(
    () =>
      shops.map((s) => ({
        id: s.id,
        displayName: s.displayName,
        shopName: s.shopName,
        platform: s.platform,
        primaryAttendantId: s.primaryAttendant?.id ?? null,
      })),
    [shops],
  );

  const mySales = useMemo(() => {
    return sales
      .filter((s) => String(s.source) === String(WEEKLY_SALE_SOURCE.MANUAL))
      .filter((s) => (meId ? String(s.createdBy ?? "") === meId : true))
      .slice(0, 50);
  }, [sales, meId]);

  if (!isBenjamin) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <main className="mx-auto max-w-6xl space-y-6 p-6">
          <h1 className="text-2xl font-semibold text-white">Manual weekly</h1>
          <p className="text-sm text-slate-400">Not authorized.</p>
        </main>
      </div>
    );
  }

  const editAmount = async (row: WeeklySaleRow) => {
    const raw = window.prompt("New amount (KES)", String(row.amount ?? 0));
    if (raw === null) return;
    const next = Number(raw);
    if (!Number.isFinite(next) || next < 0) return showToast("Enter a valid amount", "error");
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/weekly-sale/${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: next }),
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(data?.error || "Update failed");
      showToast("Updated", "success");
      await loadSales();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Update failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const deleteRow = async (row: WeeklySaleRow) => {
    const ok = window.confirm("Delete this manual weekly entry? This cannot be undone.");
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/weekly-sale/${encodeURIComponent(row.id)}`, { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      showToast("Deleted", "success");
      await loadSales();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete failed", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <ToastContainer />
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-slate-400">Online ops</p>
          <h1 className="text-3xl font-semibold text-white">Manual weekly</h1>
          <p className="text-sm text-slate-300">Enter manual weekly totals (admin can approve/analyze later).</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href="/attendant/online"
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5"
            >
              Back to dashboard
            </Link>
          </div>
        </header>

        <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold text-white">CSV weekly upload</h2>
          <p className="text-sm text-slate-400">
            Trading period: {period.label}. Manual amount entry is disabled for speed—use CSV upload.
          </p>

          <div className="mt-4">
            <MarketplaceWeeklyCsvUpload
              title="CSV weekly upload"
              shops={csvShops}
              weeks={csvWeeks}
              defaultWeekStart={weekStart}
              disableAssigneeSelect
              defaultAssigneeId={meId}
              hideSummaryTotals
              onImported={() => void loadSales()}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
            type="button"
            onClick={() => {
              void loadShops();
              void loadSales();
            }}
            disabled={saving || shopsLoading || salesLoading}
            className="rounded-full border border-white/15 bg-white/5 px-6 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-60"
          >
              Refresh
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">My recent entries</h2>
            <span className="text-sm text-slate-400">{salesLoading ? "Loading..." : `${mySales.length} shown`}</span>
          </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4">Week</th>
                <th className="py-2 pr-4">Shop</th>
                <th className="py-2 pr-4">Platform</th>
                <th className="py-2 pr-4 text-right">Amount</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mySales.map((row) => (
                <tr key={row.id} className="border-t border-white/5">
                  <td className="py-3 pr-4 text-slate-200">{String(row.weekStart).slice(0, 10)}</td>
                  <td className="py-3 pr-4 text-slate-200">{row.shop?.name || row.shopId || "-"}</td>
                  <td className="py-3 pr-4 text-slate-200">{row.platform}</td>
                  <td className="py-3 pr-4 text-right font-semibold text-emerald-200">{currency.format(Number(row.amount ?? 0))}</td>
                  <td className="py-3 pr-4 text-slate-300">{row.status}</td>
                  <td className="py-3 pr-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => editAmount(row)}
                        disabled={saving || row.status !== WEEKLY_SALE_STATUS.PENDING}
                        className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRow(row)}
                        disabled={saving || row.status !== WEEKLY_SALE_STATUS.PENDING}
                        className="rounded-full border border-red-400/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-500/15 disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!mySales.length && !salesLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No entries yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        </section>
      </main>
    </div>
  );
}
