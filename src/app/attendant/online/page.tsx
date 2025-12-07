"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { showToast } from "@/lib/ui/toast";

type WeeklySaleRow = {
  id?: string;
  shopId?: string | null;
  userId: string;
  weekStart: string;
  weekEnd: string;
  amount: number;
  status: "PENDING" | "PAID";
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-slate-950/60 p-4 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

const initialForm = {
  weekStart: "",
  weekEnd: "",
  amount: "",
  status: "PENDING" as "PENDING" | "PAID",
};

export default function AttendantOnlineOpsPage() {
  const [weeklySales, setWeeklySales] = useState<WeeklySaleRow[]>([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/online/summary?userId=me", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load weekly sales");
      const data = await res.json();
      setWeeklySales(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Unable to fetch weekly sales", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, []);

  const totals = useMemo(() => {
    const amount = weeklySales.reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
    const receipts = weeklySales.length;
    return { amount, receipts };
  }, [weeklySales]);

  const onInputChange = (key: "weekStart" | "weekEnd" | "amount" | "status", value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addSale = async () => {
    if (!form.weekStart || !form.weekEnd || !form.amount) {
      showToast("Please provide week start, end, and total sales.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        userId: "me",
        weekStart: form.weekStart,
        weekEnd: form.weekEnd,
        amount: Number(form.amount),
        status: form.status,
      };
      const res = await fetch("/api/online/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await res.json().catch(() => null);
        const errorMessage = msg?.error ?? "Failed to save weekly sale";
        throw new Error(errorMessage);
      }
      const saved = await res.json();
      setWeeklySales((prev) => [...prev, saved]);
      setForm(initialForm);
      showToast("Weekly sale saved", "success");
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Failed to save weekly sale", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf())) return "Invalid week";
    return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400">Jumia / Kilimall Ops</p>
          <h1 className="text-2xl font-semibold text-betech-orange">Online Sales Dashboard</h1>
        </div>
        <div className="flex gap-3">
          <Link
            href="/attendant/support"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase hover:bg-white/15"
          >
            Support Dashboard
          </Link>
          <Link
            href="/admin/online/summary"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase hover:bg-white/15"
          >
            Admin Summary
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs uppercase text-slate-400">Total receipts</p>
          <p className="mt-2 text-2xl font-semibold">{loading ? "…" : totals.receipts}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-400">Total sales (KES)</p>
          <p className="mt-2 text-2xl font-semibold">{loading ? "…" : totals.amount.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-400">Manual entries</p>
          <p className="mt-2 text-2xl font-semibold">{loading ? "…" : weeklySales.length}</p>
        </Card>
      </div>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold">Add weekly sales</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs uppercase text-slate-400">Week start (Mon)</label>
            <input
              type="date"
              value={form.weekStart}
              onChange={(e) => onInputChange("weekStart", e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase text-slate-400">Week end (Sat)</label>
            <input
              type="date"
              value={form.weekEnd}
              onChange={(e) => onInputChange("weekEnd", e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase text-slate-400">Total sales (KES)</label>
            <input
              type="number"
              min="0"
              value={form.amount}
              onChange={(e) => onInputChange("amount", e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase text-slate-400">Status</label>
            <select
              value={form.status}
              onChange={(e) => onInputChange("status", e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
            >
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
            </select>
          </div>
        </div>
        <button
          type="button"
          onClick={addSale}
          disabled={submitting}
          className="inline-flex items-center justify-center rounded-full bg-betech-orange px-4 py-2 text-sm font-semibold text-black hover:brightness-105 disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Save week"}
        </button>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Weekly sales</h2>
          <button
            type="button"
            onClick={fetchSales}
            className="text-xs uppercase tracking-wide text-slate-400 hover:text-slate-200"
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <div className="mt-3 divide-y divide-slate-900">
          {weeklySales.map((sale, idx) => (
            <div key={sale.id || idx} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p className="font-medium">{formatDateRange(sale.weekStart, sale.weekEnd)}</p>
                <p className="text-xs text-slate-400">Week {idx + 1} • {sale.status}</p>
              </div>
              <div className="text-right font-semibold">{Number(sale.amount ?? 0).toLocaleString()} KES</div>
            </div>
          ))}
          {!loading && weeklySales.length === 0 && (
            <p className="py-4 text-sm text-slate-500">No sales recorded yet.</p>
          )}
          {loading && <p className="py-4 text-sm text-slate-500">Loading weekly sales…</p>}
        </div>
      </Card>
    </div>
  );
}


