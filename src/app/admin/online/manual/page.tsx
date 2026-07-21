"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ToastContainer from "@/app/_components/ToastContainer";
import { showToast } from "@/lib/ui/toast";
import { canonicalNairobiWeekStartUtc, formatNairobiDate, mondayToSundayNairobiWindow, parseDateOnlyUtc } from "@/lib/weekWindow";
import { getRecentTradingPeriods, getTradingPeriodFor, type TradingPeriod } from "@/lib/tradingPeriod";
import { getOnlineOpsWeeksForTradingPeriod } from "@/lib/onlineOpsWeeks";
import { withImpersonateId } from "@/lib/impersonation";
import MarketplaceWeeklyCsvUpload from "@/app/_components/MarketplaceWeeklyCsvUpload.client";

type Platform = "JUMIA" | "KILIMALL";
type WeeklySaleSource = "MANUAL" | "CSV" | "API" | "SYSTEM";
type WeeklySaleStatus = "PENDING" | "APPROVED" | "REJECTED";

const WEEKLY_SALE_SOURCE = {
  MANUAL: "MANUAL",
} as const;

const WEEKLY_SALE_STATUS = {
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

const PLATFORM_OPTIONS: Platform[] = ["JUMIA", "KILIMALL"];
const WEEKLY_SALE_STATUS_OPTIONS: WeeklySaleStatus[] = ["PENDING", "APPROVED", "REJECTED"];
const WEEKLY_SALE_SOURCE_OPTIONS: WeeklySaleSource[] = ["MANUAL", "CSV", "API", "SYSTEM"];

const currency = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

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
  user?: { id: string; name: string | null; email: string | null } | null;
  shop?: { id: string; name: string | null; platform: Platform } | null;
};

type ShopOption = {
  id: string;
  shopName: string | null;
  displayName: string;
  platform: Platform;
  primaryAttendant: { id: string; name: string | null; email: string | null } | null;
  attendants: Array<{ id: string; name: string | null; email: string | null }>;
  identifiers?: { jumiaShopSid?: string | null; kilimallShopCode?: string | null } | null;
};

type FilterState = {
  shopId: string;
  userId: string;
  platform: string;
  status: string;
  source: string;
};

type WeekOption = {
  startInput: string;
  endInput: string;
  label: string;
};

const initialFilters: FilterState = { shopId: "", userId: "", platform: "", status: "", source: "" };

const MS_PER_DAY = 24 * 3600 * 1000;
const toInputDate = (dateUtc: Date) => dateUtc.toISOString().slice(0, 10);
const formatShort = (dateUtc: Date) => formatNairobiDate(dateUtc).replace(/\s\d{4}$/, "");

function buildWeekWindowFromDateOnly(dateOnly: string) {
  const parsed = parseDateOnlyUtc(dateOnly) ?? new Date(dateOnly);
  const canonicalStart = canonicalNairobiWeekStartUtc(parsed);
  const window = mondayToSundayNairobiWindow(canonicalStart);
  const endInclusive = new Date(window.weekEnd.getTime() - MS_PER_DAY);
  return {
    weekStart: window.weekStart,
    weekEndExclusive: window.weekEnd,
    weekEndInclusive: endInclusive,
    weekStartInput: toInputDate(window.weekStart),
    weekEndInput: toInputDate(endInclusive),
  };
}

function buildLast4WeeksForPeriod(period: TradingPeriod, reference: Date = period.end) {
  const weeks = getOnlineOpsWeeksForTradingPeriod(period, reference, 4);
  return weeks.map((wk) => ({
    start: wk.weekStart,
    endExclusive: wk.weekEndExclusive,
    endInclusive: wk.weekEndInclusive,
    startInput: wk.startInput,
    endInput: toInputDate(wk.weekEndInclusive),
    label: wk.label.replace(/–/g, "-"),
  }));
}

export default function ManualWeeklySalesPage() {
  const searchParams = useSearchParams();
  const impersonateId = searchParams.get("impersonateId");

  const tradingPeriods = useMemo(() => getRecentTradingPeriods(8), []);
  const defaultPeriod = useMemo(() => getTradingPeriodFor(new Date()), []);
  const initialLast4 = useMemo(() => buildLast4WeeksForPeriod(defaultPeriod), [defaultPeriod]);
  const initialWeek = (initialLast4.at(-1) ?? initialLast4[0] ?? null) as WeekOption | null;

  const [sales, setSales] = useState<WeeklySaleRow[]>([]);
  const [shops, setShops] = useState<ShopOption[]>([]);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [timeScope, setTimeScope] = useState<"ALL" | "SELECTED_WEEK" | "PERIOD_LAST4">("PERIOD_LAST4");
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>(defaultPeriod.key);
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(initialWeek?.startInput ?? "");
  const [loading, setLoading] = useState(true);

  const loadShops = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/online/manual/shops", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load shops");
      const data = (await res.json()) as ShopOption[];
      setShops(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      showToast("Unable to load shops", "error");
    }
  }, []);

  const loadSales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/weekly-sale", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load weekly sales");
      const data = (await res.json()) as WeeklySaleRow[];
      setSales(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      showToast("Unable to fetch weekly sales", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShops();
    loadSales();
  }, [loadShops, loadSales]);

  const onFilterChange = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const selectedPeriod = useMemo(() => {
    return tradingPeriods.find((p) => p.key === selectedPeriodKey) ?? defaultPeriod;
  }, [defaultPeriod, selectedPeriodKey, tradingPeriods]);

  const last4 = useMemo(() => buildLast4WeeksForPeriod(selectedPeriod), [selectedPeriod]);
  const weekOptions = useMemo<WeekOption[]>(
    () => last4.map((w) => ({ startInput: w.startInput, endInput: w.endInput, label: w.label })),
    [last4],
  );
  const selectedWeek = useMemo(
    () => weekOptions.find((w) => w.startInput === selectedWeekStart) ?? weekOptions.at(-1) ?? weekOptions[0] ?? null,
    [selectedWeekStart, weekOptions],
  );
  const selectedWeekLabel = selectedWeek?.label ?? "this week";
  const last4WeekStartSet = useMemo(() => new Set(last4.map((w) => w.startInput)), [last4]);

  const selectWeek = useCallback((week: WeekOption | null) => {
    if (!week) return;
    setSelectedWeekStart(week.startInput);
  }, []);

  const attendantOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    shops.forEach((shop) => {
      const all = [shop.primaryAttendant, ...(shop.attendants ?? [])].filter(Boolean) as Array<{
        id: string;
        name: string | null;
        email: string | null;
      }>;
      all.forEach((u) => {
        const label = u.name || u.email || u.id;
        if (!map.has(u.id)) map.set(u.id, { id: u.id, name: label });
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [shops]);

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

  const visibleSales = useMemo(() => {
    return sales.filter((sale) => {
      if (filters.shopId && sale.shopId !== filters.shopId) return false;
      if (filters.userId && sale.userId !== filters.userId) return false;
      if (filters.platform && sale.platform !== (filters.platform as Platform)) return false;
      if (filters.status && sale.status !== (filters.status as WeeklySaleStatus)) return false;
      if (filters.source && sale.source !== (filters.source as WeeklySaleSource)) return false;

      if (timeScope === "SELECTED_WEEK") {
        const window = mondayToSundayNairobiWindow(new Date(sale.weekStart));
        return window.weekStart.toISOString().slice(0, 10) === selectedWeekStart;
      }
      if (timeScope === "PERIOD_LAST4") {
        const window = mondayToSundayNairobiWindow(new Date(sale.weekStart));
        const weekStartInput = window.weekStart.toISOString().slice(0, 10);
        return last4WeekStartSet.has(weekStartInput);
      }
      return true;
    });
  }, [
    sales,
    filters.platform,
    filters.shopId,
    filters.source,
    filters.status,
    filters.userId,
    last4WeekStartSet,
    selectedWeekStart,
    timeScope,
  ]);

  const updateStatus = async (id: string, status: WeeklySaleStatus) => {
    try {
      const res = await fetch(`/api/admin/weekly-sale/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      showToast(`Entry ${status.toLowerCase()}`, "success");
      await loadSales();
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Failed to update entry", "error");
    }
  };

  const voidEntry = async (sale: WeeklySaleRow) => {
    if (sale.source !== WEEKLY_SALE_SOURCE.MANUAL) {
      showToast("Only manual entries can be voided", "error");
      return;
    }
    if (sale.status === WEEKLY_SALE_STATUS.REJECTED) return;
    if (!confirm("Void this entry (mark as REJECTED) so it can be captured again?")) return;
    await updateStatus(sale.id, WEEKLY_SALE_STATUS.REJECTED);
  };

  const editEntry = async (sale: WeeklySaleRow) => {
    if (sale.source !== WEEKLY_SALE_SOURCE.MANUAL) {
      showToast("Only manual entries can be edited", "error");
      return;
    }

    const current = Number(sale.amount ?? 0);
    const input = prompt("Enter new amount (KES)", String(current));
    if (input == null) return;

    const nextAmount = Number(input);
    if (!Number.isFinite(nextAmount) || nextAmount < 0) {
      showToast("Invalid amount", "error");
      return;
    }

    try {
      const res = await fetch(`/api/admin/weekly-sale/${sale.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: nextAmount }),
      });
      if (!res.ok) throw new Error("Failed to update amount");
      showToast("Entry updated", "success");
      await loadSales();
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Failed to update entry", "error");
    }
  };

  const deleteEntry = async (id: string) => {
    if (!confirm("Delete this manual entry?")) return;
    try {
      const res = await fetch(`/api/admin/weekly-sale/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete entry");
      showToast("Entry deleted", "success");
      await loadSales();
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Failed to delete entry", "error");
    }
  };

  return (
    <div className="space-y-6">
      <ToastContainer />
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Online ops</p>
        <h1 className="text-2xl font-semibold text-white">Manual weekly sales desk</h1>
        <p className="text-sm text-slate-400">
          Capture overrides when Jumia/Kilimall statements fail to sync, approve pending entries, and keep commissions aligned with the source of truth.
        </p>
      </header>

      <MarketplaceWeeklyCsvUpload
        title="CSV weekly upload (recommended)"
        shops={csvShops}
        weeks={weekOptions}
        defaultWeekStart={selectedWeek?.startInput ?? selectedWeekStart}
        assignees={attendantOptions}
        impersonateId={impersonateId}
        onImported={() => void loadSales()}
      />

      <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Trading period dashboard</h2>
            <p className="text-sm text-slate-400">
              Trading period runs {defaultPeriod.start.toLocaleDateString()} – {defaultPeriod.end.toLocaleDateString()} (25th → 24th).
              Last 4 full weeks end on the most recent Sunday within the selected period.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm text-slate-300">
              Period
              <select
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm"
                value={selectedPeriodKey}
                onChange={(e) => setSelectedPeriodKey(e.target.value)}
              >
                {tradingPeriods.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-300">
              History scope
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setTimeScope("PERIOD_LAST4")}
                  className={`flex-1 rounded-full border px-3 py-2 text-xs font-semibold ${timeScope === "PERIOD_LAST4" ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200" : "border-white/10 text-slate-200 hover:bg-white/5"}`}
                >
                  Period (4 wks)
                </button>
                <button
                  type="button"
                  onClick={() => setTimeScope("SELECTED_WEEK")}
                  className={`flex-1 rounded-full border px-3 py-2 text-xs font-semibold ${timeScope === "SELECTED_WEEK" ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200" : "border-white/10 text-slate-200 hover:bg-white/5"}`}
                >
                  Selected week
                </button>
                <button
                  type="button"
                  onClick={() => setTimeScope("ALL")}
                  className={`flex-1 rounded-full border px-3 py-2 text-xs font-semibold ${timeScope === "ALL" ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200" : "border-white/10 text-slate-200 hover:bg-white/5"}`}
                >
                  All
                </button>
              </div>
            </label>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Last 4 full weeks</p>
            <div className="mt-3 space-y-2 text-sm text-slate-200">
            {last4.map((wk) => (
              <button
                key={wk.startInput}
                type="button"
                onClick={() => {
                    selectWeek({ startInput: wk.startInput, endInput: wk.endInput, label: wk.label });
                }}
                className="w-full rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2 text-left hover:bg-white/5"
              >
                <div className="font-semibold text-white">{wk.label}</div>
                <div className="text-xs text-slate-400">Week start: {wk.startInput}</div>
                </button>
              ))}
             </div>
           </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Filters</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="text-sm text-slate-300">
                Platform
                <select
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm"
                  value={filters.platform}
                  onChange={(e) => onFilterChange("platform", e.target.value)}
                >
                  <option value="">All platforms</option>
                  {PLATFORM_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-300">
                Attendant
                <select
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm"
                  value={filters.userId}
                  onChange={(e) => onFilterChange("userId", e.target.value)}
                >
                  <option value="">All attendants</option>
                  {attendantOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Weekly sales history</h2>
            <p className="text-sm text-slate-400">Filter entries before approving so auto-sync and manual overrides never collide.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-5">
            <select
              className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm"
              value={filters.platform}
              onChange={(e) => onFilterChange("platform", e.target.value)}
            >
              <option value="">All platforms</option>
              {PLATFORM_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm"
              value={filters.userId}
              onChange={(e) => onFilterChange("userId", e.target.value)}
            >
              <option value="">All attendants</option>
              {attendantOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm"
              value={filters.status}
              onChange={(e) => onFilterChange("status", e.target.value)}
            >
              <option value="">All statuses</option>
              {WEEKLY_SALE_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select
              className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm"
              value={filters.source}
              onChange={(e) => onFilterChange("source", e.target.value)}
            >
              <option value="">All sources</option>
              {WEEKLY_SALE_SOURCE_OPTIONS.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
            <select
              className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm"
              value={filters.shopId}
              onChange={(e) => onFilterChange("shopId", e.target.value)}
            >
              <option value="">All shops</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2">Shop</th>
                <th className="py-2">Week</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Source</th>
                <th className="py-2">Status</th>
                <th className="py-2">Assignee</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleSales.map((sale) => (
                <tr key={sale.id} className="border-t border-white/5 text-slate-100">
                  <td className="py-3">
                    <div className="font-semibold">{sale.shop?.name ?? "Unassigned"}</div>
                    <div className="text-xs text-slate-400">{sale.platform}</div>
                  </td>
                  <td className="py-3 text-sm text-slate-200">
                    {(() => {
                      const start = canonicalNairobiWeekStartUtc(new Date(sale.weekStart));
                      const window = mondayToSundayNairobiWindow(start);
                      const endInclusive = new Date(window.weekEnd.getTime() - MS_PER_DAY);
                      return `${formatShort(window.weekStart)} - ${formatShort(endInclusive)}`;
                    })()}
                  </td>
                  <td className="py-3 font-semibold text-emerald-300">{currency.format(Number(sale.amount ?? 0))}</td>
                  <td className="py-3 text-xs text-slate-400">{sale.source}</td>
                  <td className="py-3 text-xs font-semibold">
                    <span className={statusBadgeClass(sale.status)}>{sale.status}</span>
                  </td>
                  <td className="py-3 text-sm text-slate-300">{sale.user?.name || sale.user?.email || "-"}</td>
                  <td className="py-3 text-right text-xs">
                    <div className="flex flex-wrap justify-end gap-2">
                      {sale.status === "PENDING" && (
                        <>
                          <button
                            type="button"
                            className="rounded-full bg-emerald-500/90 px-3 py-1 font-semibold text-black hover:brightness-95"
                            onClick={() => updateStatus(sale.id, WEEKLY_SALE_STATUS.APPROVED)}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="rounded-full border border-white/20 px-3 py-1 font-semibold text-slate-200 hover:bg-white/10"
                            onClick={() => updateStatus(sale.id, WEEKLY_SALE_STATUS.REJECTED)}
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {sale.source === "MANUAL" && (
                        <>
                          <button
                            type="button"
                            className="rounded-full border border-white/20 px-3 py-1 font-semibold text-slate-200 hover:bg-white/10"
                            onClick={() => editEntry(sale)}
                          >
                            Edit
                          </button>
                          {sale.status !== "REJECTED" && (
                            <button
                              type="button"
                              className="rounded-full border border-amber-400/40 px-3 py-1 font-semibold text-amber-200 hover:bg-amber-500/10"
                              onClick={() => voidEntry(sale)}
                            >
                              Void
                            </button>
                          )}
                          {sale.status === "PENDING" && (
                            <button
                              type="button"
                              className="rounded-full border border-red-400/50 px-3 py-1 font-semibold text-red-200 hover:bg-red-500/10"
                              onClick={() => deleteEntry(sale.id)}
                            >
                              Delete
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && visibleSales.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-sm text-slate-500">
                    No weekly sales found for the selected filters.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-sm text-slate-500">
                    Loading weekly sales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function statusBadgeClass(status: WeeklySaleStatus) {
  switch (status) {
    case "APPROVED":
      return "rounded-full bg-emerald-500/20 px-3 py-1 text-emerald-300";
    case "REJECTED":
      return "rounded-full bg-red-500/10 px-3 py-1 text-red-300";
    default:
      return "rounded-full bg-amber-500/10 px-3 py-1 text-amber-200";
  }
}
