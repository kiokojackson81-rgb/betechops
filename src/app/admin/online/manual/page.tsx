"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ToastContainer from "@/app/_components/ToastContainer";
import { showToast } from "@/lib/ui/toast";
import { Platform, WeeklySaleSource, WeeklySaleStatus } from "@prisma/client";

const currency = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

type WeeklySaleRow = {
  id: string;
  shopId: string | null;
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
  status: string;
  source: string;
};

type FormState = {
  shopId: string;
  weekStart: string;
  weekEnd: string;
  amount: string;
};

type TradingWeek = {
  key: string;
  label: string;
  display: string;
  startInput: string;
  endInput: string;
  start: Date;
  end: Date;
};

const initialFilters: FilterState = { shopId: "", status: "", source: WeeklySaleSource.MANUAL };

const toInputDate = (date: Date) => date.toISOString().slice(0, 10);
const toDateOnly = (value: string) => {
  if (!value) return "";
  if (/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return value;
  const match = value.match(/^(\\d{4}-\\d{2}-\\d{2})/);
  if (match?.[1]) return match[1];
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString().slice(0, 10);
  return "";
};
const formatShort = (date: Date) => date.toLocaleDateString("en-KE", { day: "2-digit", month: "short" });

function buildTradingWeeks(reference = new Date()) {
  const now = new Date(reference);
  now.setHours(0, 0, 0, 0);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const lastDayPrevMonth = new Date(currentYear, currentMonth, 0);
  const prevMonthYear = lastDayPrevMonth.getFullYear();
  const prevMonthIndex = lastDayPrevMonth.getMonth();
  const prevMonthMaxDay = lastDayPrevMonth.getDate();
  const clampPrevMonth = (day: number) => Math.min(day, prevMonthMaxDay);

  const week1Start = new Date(prevMonthYear, prevMonthIndex, 24);
  const week1End = new Date(prevMonthYear, prevMonthIndex, clampPrevMonth(30));
  const week2Start = new Date(currentYear, currentMonth, 1);
  const week2End = new Date(currentYear, currentMonth, 7);
  const week3Start = new Date(currentYear, currentMonth, 8);
  const week3End = new Date(currentYear, currentMonth, 14);
  const week4Start = new Date(currentYear, currentMonth, 15);
  const week4End = new Date(currentYear, currentMonth, 21);

  const weeks: TradingWeek[] = [
    {
      key: `week1-${toInputDate(week1Start)}`,
      label: "Week 1",
      display: `${formatShort(week1Start)} - ${formatShort(week1End)}`,
      startInput: toInputDate(week1Start),
      endInput: toInputDate(week1End),
      start: week1Start,
      end: week1End,
    },
    {
      key: `week2-${toInputDate(week2Start)}`,
      label: "Week 2",
      display: `${formatShort(week2Start)} - ${formatShort(week2End)}`,
      startInput: toInputDate(week2Start),
      endInput: toInputDate(week2End),
      start: week2Start,
      end: week2End,
    },
    {
      key: `week3-${toInputDate(week3Start)}`,
      label: "Week 3",
      display: `${formatShort(week3Start)} - ${formatShort(week3End)}`,
      startInput: toInputDate(week3Start),
      endInput: toInputDate(week3End),
      start: week3Start,
      end: week3End,
    },
    {
      key: `week4-${toInputDate(week4Start)}`,
      label: "Week 4",
      display: `${formatShort(week4Start)} - ${formatShort(week4End)}`,
      startInput: toInputDate(week4Start),
      endInput: toInputDate(week4End),
      start: week4Start,
      end: week4End,
    },
  ];

  let defaultWeek = weeks[0];
  for (const wk of weeks) {
    if (wk.end.getTime() < now.getTime()) {
      defaultWeek = wk;
    }
  }

  return { weeks, defaultWeek: defaultWeek ?? weeks[0] };
}

const buildInitialForm = (week?: TradingWeek): FormState => ({
  shopId: "",
  weekStart: week?.startInput ?? "",
  weekEnd: week?.endInput ?? "",
  amount: "",
});

export default function ManualWeeklySalesPage() {
  const tradingWeeks = useMemo(() => buildTradingWeeks(), []);
  const initialWeek = tradingWeeks.defaultWeek ?? tradingWeeks.weeks[0];

  const [sales, setSales] = useState<WeeklySaleRow[]>([]);
  const [shops, setShops] = useState<ShopOption[]>([]);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [selectedWeekKey, setSelectedWeekKey] = useState(initialWeek?.key ?? "");
  const [form, setForm] = useState<FormState>(() => buildInitialForm(initialWeek));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  const onFormChange = (key: keyof FormState, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const selectedShop = useMemo(() => shops.find((shop) => shop.id === form.shopId) || null, [shops, form.shopId]);
  const selectedAssignee = selectedShop?.primaryAttendant ?? null;
  const selectedWeek = useMemo(
    () =>
      tradingWeeks.weeks.find((wk) => wk.key === selectedWeekKey) ??
      tradingWeeks.defaultWeek ??
      tradingWeeks.weeks[0],
    [tradingWeeks, selectedWeekKey],
  );

  const takenShopIdsForWeek = useMemo(() => {
    if (!form.weekStart || !form.weekEnd) return [] as string[];
    const activeWeekStart = toDateOnly(form.weekStart);
    const activeWeekEnd = toDateOnly(form.weekEnd);
    const manualSet = new Set<string>();
    sales.forEach((sale) => {
      if (!sale.shopId) return;
      const saleWeekStart = toDateOnly(sale.weekStart);
      const saleWeekEnd = toDateOnly(sale.weekEnd);
      if (
        saleWeekStart === activeWeekStart &&
        saleWeekEnd === activeWeekEnd &&
        sale.source === WeeklySaleSource.MANUAL &&
        sale.status !== WeeklySaleStatus.REJECTED
      ) {
        manualSet.add(sale.shopId);
      }
    });
    return Array.from(manualSet);
  }, [sales, form.weekStart, form.weekEnd]);
  const takenShopSet = useMemo(() => new Set(takenShopIdsForWeek), [takenShopIdsForWeek]);

  const autoShopIdsForWeek = useMemo(() => {
    if (!form.weekStart || !form.weekEnd) return [] as string[];
    const activeWeekStart = toDateOnly(form.weekStart);
    const activeWeekEnd = toDateOnly(form.weekEnd);
    const autoSet = new Set<string>();
    sales.forEach((sale) => {
      if (!sale.shopId) return;
      const saleWeekStart = toDateOnly(sale.weekStart);
      const saleWeekEnd = toDateOnly(sale.weekEnd);
      if (
        saleWeekStart === activeWeekStart &&
        saleWeekEnd === activeWeekEnd &&
        sale.source === WeeklySaleSource.AUTOMATIC
      ) {
        autoSet.add(sale.shopId);
      }
    });
    return Array.from(autoSet);
  }, [sales, form.weekStart, form.weekEnd]);
  const autoShopSet = useMemo(() => new Set(autoShopIdsForWeek), [autoShopIdsForWeek]);
  const availableShops = useMemo(
    () => shops.filter((shop) => !takenShopSet.has(shop.id)),
    [shops, takenShopSet],
  );

  const visibleSales = useMemo(() => {
    return sales.filter((sale) => {
      if (filters.shopId && sale.shopId !== filters.shopId) return false;
      if (filters.status && sale.status !== (filters.status as WeeklySaleStatus)) return false;
      if (filters.source && sale.source !== (filters.source as WeeklySaleSource)) return false;
      return true;
    });
  }, [sales, filters.shopId, filters.source, filters.status]);

  useEffect(() => {
    if (form.shopId && takenShopSet.has(form.shopId)) {
      setForm((prev) => ({ ...prev, shopId: "" }));
    }
  }, [form.shopId, takenShopSet]);

  const handleWeekSelect = (key: string) => {
    const week = tradingWeeks.weeks.find((wk) => wk.key === key);
    if (!week) return;
    setSelectedWeekKey(key);
    setForm((prev) => ({ ...prev, shopId: "", weekStart: week.startInput, weekEnd: week.endInput }));
  };

  const createEntry = async () => {
    if (!form.shopId || !form.weekStart || !form.weekEnd || !form.amount) {
      showToast("Please provide shop, week range and amount", "error");
      return;
    }
    const assignedUserId = selectedAssignee?.id ?? null;
    setSaving(true);
    try {
      const payload = {
        shopId: form.shopId,
        weekStart: form.weekStart,
        weekEnd: form.weekEnd,
        amount: Number(form.amount),
        userId: assignedUserId,
      };
      const res = await fetch("/api/admin/weekly-sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to create entry");
      }
      showToast("Manual weekly sale saved", "success");
      const resetWeek = tradingWeeks.weeks.find((wk) => wk.key === selectedWeekKey) ?? initialWeek;
      setForm(buildInitialForm(resetWeek));
      await loadSales();
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Failed to create entry", "error");
    } finally {
      setSaving(false);
    }
  };

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

      <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold text-white">Add manual entry</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <label className="text-sm text-slate-300">
            Shop
            <select
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm"
              value={form.shopId}
              onChange={(e) => onFormChange("shopId", e.target.value)}
              disabled={availableShops.length === 0}
            >
              <option value="">
                {availableShops.length === 0 ? "All shops captured for this week" : "Select shop"}
              </option>
              {availableShops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.displayName} ({shop.platform})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              {shops.length === 0
                ? "Loading shop assignments…"
                : `${availableShops.length} of ${shops.length} shops still open for ${selectedWeek?.display ?? "this week"}.`}
            </p>
            {autoShopSet.size > 0 && (
              <p className="mt-1 text-xs text-amber-300">
                {autoShopSet.size === 1
                  ? "1 shop already has an automatic entry this week; saving will overwrite it."
                  : `${autoShopSet.size} shops already have automatic entries this week; saving will overwrite them.`}
              </p>
            )}
            {selectedShop && autoShopSet.has(selectedShop.id) && (
              <p className="mt-1 text-xs text-amber-300">
                Manual entry will overwrite the automatic record for this shop.
              </p>
            )}
          </label>
          <label className="text-sm text-slate-300">
            Trading week
            <select
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm"
              value={selectedWeekKey}
              onChange={(e) => handleWeekSelect(e.target.value)}
            >
              {tradingWeeks.weeks.map((week) => (
                <option key={week.key} value={week.key}>
                  {week.label} ({week.display})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-300">
            Week start
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm"
              value={form.weekStart}
              onChange={(e) => onFormChange("weekStart", e.target.value)}
            />
          </label>
          <label className="text-sm text-slate-300">
            Week end
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm"
              value={form.weekEnd}
              onChange={(e) => onFormChange("weekEnd", e.target.value)}
            />
          </label>
          <label className="text-sm text-slate-300">
            Amount (KES)
            <input
              type="number"
              min="0"
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm"
              value={form.amount}
              onChange={(e) => onFormChange("amount", e.target.value)}
            />
          </label>
        </div>
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
          {selectedShop ? (
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Attendant on file</p>
                <p className="mt-1 font-semibold text-white">
                  {selectedAssignee?.name || selectedAssignee?.email || "Unassigned"}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Shop platform</p>
                <p className="mt-1 font-semibold text-white">{selectedShop.platform}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Marketplace codes</p>
                <p className="mt-1 text-xs text-slate-400">
                  {selectedShop.identifiers?.jumiaShopSid
                    ? `SID: ${selectedShop.identifiers.jumiaShopSid}`
                    : selectedShop.identifiers?.kilimallShopCode
                      ? `Code: ${selectedShop.identifiers.kilimallShopCode}`
                      : "—"}
                </p>
              </div>
            </div>
          ) : (
            <p>Select a shop to view the assigned attendant and identifiers for this trading period.</p>
          )}
        </div>
        <div className="mt-4 rounded-2xl border border-white/5 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Trading weeks</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {tradingWeeks.weeks.map((week) => (
              <div key={week.key} className="rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2 text-sm text-slate-200">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">{week.label}</p>
                <p className="text-base text-white">{week.display}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={createEntry}
            disabled={saving}
            className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:opacity-60"
          >
            {saving ? "Saving." : "Save manual entry"}
          </button>
          <Link href="/attendant/daily-report" className="text-sm text-emerald-400 hover:text-emerald-200">
            Need to record receipts? Open the daily report tool →
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Weekly sales history</h2>
            <p className="text-sm text-slate-400">Filter entries before approving so auto-sync and manual overrides never collide.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <select
              className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm"
              value={filters.status}
              onChange={(e) => onFilterChange("status", e.target.value)}
            >
              <option value="">All statuses</option>
              {Object.values(WeeklySaleStatus).map((status) => (
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
              {Object.values(WeeklySaleSource).map((source) => (
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
                    {new Date(sale.weekStart).toLocaleDateString()} - {new Date(sale.weekEnd).toLocaleDateString()}
                  </td>
                  <td className="py-3 font-semibold text-emerald-300">{currency.format(Number(sale.amount ?? 0))}</td>
                  <td className="py-3 text-xs text-slate-400">{sale.source}</td>
                  <td className="py-3 text-xs font-semibold">
                    <span className={statusBadgeClass(sale.status)}>{sale.status}</span>
                  </td>
                  <td className="py-3 text-sm text-slate-300">{sale.user?.name || sale.user?.email || "-"}</td>
                  <td className="py-3 text-right text-xs">
                    {sale.status === "PENDING" && (
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-full bg-emerald-500/90 px-3 py-1 font-semibold text-black hover:brightness-95"
                          onClick={() => updateStatus(sale.id, WeeklySaleStatus.APPROVED)}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-white/20 px-3 py-1 font-semibold text-slate-200 hover:bg-white/10"
                          onClick={() => updateStatus(sale.id, WeeklySaleStatus.REJECTED)}
                        >
                          Reject
                        </button>
                        {sale.source === "MANUAL" && (
                          <button
                            type="button"
                            className="rounded-full border border-red-400/50 px-3 py-1 font-semibold text-red-200 hover:bg-red-500/10"
                            onClick={() => deleteEntry(sale.id)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    )}
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
