"use client";

import { useEffect, useState } from "react";
import Card from "@/app/_components/Card";
import { showToast } from "@/lib/ui/toast";

type ReturnEntry = {
  id: string;
  accountName: string;
  platform: string;
  orderItemId: string;
  expectedAmount: number;
  status: string;
  createdAt: string;
  dueAt: string;
  daysRemaining: number;
};

export default function ReturnsCard() {
  const [returns, setReturns] = useState<ReturnEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/online/returns", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load returns");
      const data = await res.json().catch(() => null);
      setReturns(data?.returns ?? []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load returns", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
    window.addEventListener("onlineOps:refresh", fetchReturns);
    return () => window.removeEventListener("onlineOps:refresh", fetchReturns);
  }, []);

  const confirmPickup = async (entry: ReturnEntry) => {
    const attachmentUrl = window.prompt("Proof attachment URL (optional)") || undefined;
    try {
      const res = await fetch("/api/online/returns/confirm-pickup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnId: entry.id, attachmentUrl }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => null);
        throw new Error(error?.error || "Failed to confirm pickup");
      }
      showToast("Return marked as picked", "success");
      fetchReturns();
      window.dispatchEvent(new CustomEvent("onlineOps:refresh"));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to confirm pickup", "error");
    }
  };

  return (
    <Card className="space-y-4 border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Returns SLA</h3>
          <p className="text-sm text-slate-400">Pick returns within 7 days to avoid deductions.</p>
        </div>
        <button
          type="button"
          className="rounded-xl border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/5"
          onClick={fetchReturns}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {loading && !returns.length ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-6 text-sm text-slate-400">
          Loading return queue…
        </div>
      ) : null}

      {!loading && returns.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-6 text-sm text-slate-400">
          No open returns for your accounts.
        </div>
      ) : null}

      <div className="space-y-3">
        {returns.map((entry) => (
          <div key={entry.id} className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="font-semibold text-slate-100">{entry.accountName}</p>
                <p className="text-xs text-slate-400">
                  {entry.platform} • Item {entry.orderItemId}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Expected</p>
                <p className="text-lg font-semibold text-rose-300">KES {entry.expectedAmount.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-slate-400">
              <span>Created: {new Date(entry.createdAt).toLocaleDateString()}</span>
              <span>Due: {new Date(entry.dueAt).toLocaleDateString()}</span>
              <span>Days remaining: {entry.daysRemaining}</span>
              <span>Status: {entry.status.replace(/_/g, " ")}</span>
            </div>
            {entry.status === "WAITING_AT_HUB" ? (
              <button
                type="button"
                className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-black hover:brightness-95"
                onClick={() => confirmPickup(entry)}
              >
                Confirm picked
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
