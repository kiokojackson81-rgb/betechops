"use client";

import { useEffect, useState } from "react";
import Card from "@/app/_components/Card";
import { showToast } from "@/lib/ui/toast";

type WeekEntry = {
  id: string;
  statementNumber: string;
  weekStart: string;
  weekEnd: string;
  grossSales: number;
  payoutAmount: number;
  currency: string;
  isPaid: boolean;
};

type AccountWeeks = {
  accountId: string;
  accountName: string;
  platform: string;
  total4Weeks: number;
  weeks: WeekEntry[];
};

export default function JumiaWeeksBlock() {
  const [accounts, setAccounts] = useState<AccountWeeks[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWeeks = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/online/jumia-weeks", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load payout statements");
      const data = await res.json().catch(() => null);
      setAccounts(data?.accounts ?? []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load payout statements", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeeks();
    window.addEventListener("onlineOps:refresh", fetchWeeks);
    return () => window.removeEventListener("onlineOps:refresh", fetchWeeks);
  }, []);

  if (!accounts.length && !loading) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Jumia & Kilimall weeks</h3>
          <p className="text-sm text-slate-400">Track the last four paid statements per shop.</p>
        </div>
        <button
          type="button"
          className="rounded-xl border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/5"
          onClick={fetchWeeks}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {accounts.map((account) => (
          <Card key={account.accountId} className="space-y-3 border-slate-800 bg-slate-900/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">{account.platform}</p>
                <p className="text-lg font-semibold">{account.accountName}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Total (4 weeks)</p>
                <p className="text-xl font-semibold text-emerald-400">KES {account.total4Weeks.toLocaleString()}</p>
              </div>
            </div>
            <div className="space-y-2">
              {account.weeks.map((week) => (
                <div
                  key={week.id}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-950/40 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-100">
                      {new Date(week.weekStart).toLocaleDateString("en-KE", { month: "short", day: "numeric" })} -{" "}
                      {new Date(week.weekEnd).toLocaleDateString("en-KE", { month: "short", day: "numeric" })}
                    </p>
                    <p className="text-xs text-slate-400">Stmt #{week.statementNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-emerald-400">KES {week.grossSales.toLocaleString()}</p>
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">
                      {week.isPaid ? "Paid" : "Pending"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
        {loading && !accounts.length ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6 text-sm text-slate-400">Loading payout statements…</div>
        ) : null}
      </div>
    </section>
  );
}
