"use client";

import { useEffect, useState } from "react";
import { showToast } from "@/lib/ui/toast";

type AdminWeeklySale = {
  id: string;
  userId: string;
  userName: string;
  shopId: string | null;
  shopName: string | null;
  weekStart: string;
  weekEnd: string;
  amount: number;
  status: string;
};

export default function WeeklySalesTable() {
  const [sales, setSales] = useState<AdminWeeklySale[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/online/summary/all", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load weekly sales");
      const data = await res.json();
      setSales(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Unable to load weekly sales", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, []);

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Weekly sales submissions</h3>
          <p className="text-sm text-slate-400">Manual Jumia / Kilimall totals recorded by attendants.</p>
        </div>
        <button
          type="button"
          className="text-xs uppercase tracking-wide text-slate-300 hover:text-white disabled:opacity-60"
          onClick={fetchSales}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="py-2">User</th>
              <th className="py-2">Shop</th>
              <th className="py-2">Week</th>
              <th className="py-2 text-right">Amount (KES)</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id} className="border-t border-white/5">
                <td className="py-2">{sale.userName}</td>
                <td className="py-2">{sale.shopName ?? "—"}</td>
                <td className="py-2">
                  {new Date(sale.weekStart).toLocaleDateString()} – {new Date(sale.weekEnd).toLocaleDateString()}
                </td>
                <td className="py-2 text-right font-semibold text-emerald-300">
                  {Number(sale.amount ?? 0).toLocaleString()}
                </td>
                <td className="py-2">{sale.status}</td>
              </tr>
            ))}
            {!sales.length && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-slate-500">
                  {loading ? "Loading weekly sales…" : "No manual sales found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
