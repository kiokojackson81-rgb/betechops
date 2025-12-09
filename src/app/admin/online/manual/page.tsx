"use client";

import { useEffect, useMemo, useState } from "react";
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

type ShopOption = { id: string; name: string; platform: Platform };

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
  userId: string;
};

const initialFilters: FilterState = { shopId: "", status: "", source: "" };
const initialForm: FormState = { shopId: "", weekStart: "", weekEnd: "", amount: "", userId: "" };

export default function ManualWeeklySalesPage() {
  const [sales, setSales] = useState<WeeklySaleRow[]>([]);
  const [shops, setShops] = useState<ShopOption[]>([]);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadShops();
    loadSales();
  }, []);

  const loadShops = async () => {
    try {
      const res = await fetch("/api/shops", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load shops");
      const data = (await res.json()) as ShopOption[];
      setShops(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      showToast("Unable to load shops", "error");
    }
  };

  const loadSales = async (nextFilters?: FilterState) => {
    const active = nextFilters ?? filters;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(active).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const query = params.size ? `?${params.toString()}` : "";
      const res = await fetch(`/api/admin/weekly-sale${query}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load weekly sales");
      const data = (await res.json()) as WeeklySaleRow[];
      setSales(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      showToast("Unable to fetch weekly sales", "error");
    } finally {
      setLoading(false);
    }
  };

  const onFilterChange = (key: keyof FilterState, value: string) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    loadSales(next);
  };

  const onFormChange = (key: keyof FormState, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const selectedShop = useMemo(() => shops.find((shop) => shop.id === form.shopId) || null, [shops, form.shopId]);

  const createEntry = async () => {
    if (!form.shopId || !form.weekStart || !form.weekEnd || !form.amount) {
      showToast("Please provide shop, week range and amount", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        shopId: form.shopId,
        weekStart: form.weekStart,
        weekEnd: form.weekEnd,
        amount: Number(form.amount),
        userId: form.userId || null,
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
      setForm(initialForm);
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
            >
              <option value="">Select shop</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name} ({shop.platform})
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
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm text-slate-300">
            Assign to attendant (optional)
            <input
              type="text"
              placeholder="Attendant user ID"
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm"
              value={form.userId}
              onChange={(e) => onFormChange("userId", e.target.value)}
            />
          </label>
          <div className="text-sm text-slate-500">
            <p>Shop platform</p>
            <p className="mt-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-slate-200">
              {selectedShop ? selectedShop.platform : "Select a shop"}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={createEntry}
            disabled={saving}
            className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save manual entry"}
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
                  {shop.name}
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
              {sales.map((sale) => (
                <tr key={sale.id} className="border-t border-white/5 text-slate-100">
                  <td className="py-3">
                    <div className="font-semibold">{sale.shop?.name ?? "Unassigned"}</div>
                    <div className="text-xs text-slate-400">{sale.platform}</div>
                  </td>
                  <td className="py-3 text-sm text-slate-200">
                    {new Date(sale.weekStart).toLocaleDateString()} – {new Date(sale.weekEnd).toLocaleDateString()}
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
              {!loading && sales.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-sm text-slate-500">
                    No weekly sales found for the selected filters.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-sm text-slate-500">
                    Loading weekly sales…
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
