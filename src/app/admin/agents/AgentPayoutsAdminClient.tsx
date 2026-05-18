"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type PayoutRow = {
  id: string;
  queue: string;
  agentId: string;
  agentName: string;
  referralCode: string;
  phone: string;
  county: string;
  riskLevel: "low" | "medium" | "high";
  amount: number;
  method: string;
  reference: string;
  status: string;
  eligibleCommission: number;
  availableBalance: number;
  createdAt: string;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(value || 0);

function statusBadge(status: string) {
  if (status === "paid") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  if (status === "approved") return "border-cyan-400/20 bg-cyan-400/10 text-cyan-200";
  if (status === "held") return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  if (status === "rejected") return "border-rose-400/20 bg-rose-400/10 text-rose-200";
  return "border-white/10 bg-white/[0.04] text-slate-200";
}

function riskBadge(level: PayoutRow["riskLevel"]) {
  if (level === "high") return "border-rose-400/20 bg-rose-400/10 text-rose-200";
  if (level === "medium") return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
}

export default function AgentPayoutsAdminClient({ rows }: { rows: PayoutRow[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const selected = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId]);

  async function updateStatus(id: string, status: string) {
    setBusy(`${id}:${status}`);
    const res = await fetch(`/api/admin/agents/payouts/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(null);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({ error: "Unable to update payout." }));
      window.alert(payload.error || "Unable to update payout.");
      return;
    }
    startTransition(() => router.refresh());
  }

  function renderActions(row: PayoutRow, compact = false) {
    const base = compact ? "px-3 py-2 text-[11px]" : "px-3 py-2 text-xs";
    return (
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setSelectedId(row.id)} className={`rounded-xl border border-white/10 font-semibold text-slate-100 ${base}`}>
          View Details
        </button>
        <button
          onClick={() => updateStatus(row.id, "approved")}
          disabled={busy !== null}
          className={`rounded-xl bg-cyan-300 font-semibold text-slate-950 disabled:opacity-60 ${base}`}
        >
          {busy === `${row.id}:approved` ? "..." : "Approve"}
        </button>
        <button
          onClick={() => updateStatus(row.id, "held")}
          disabled={busy !== null}
          className={`rounded-xl bg-amber-300 font-semibold text-slate-950 disabled:opacity-60 ${base}`}
        >
          {busy === `${row.id}:held` ? "..." : "Hold"}
        </button>
        <button
          onClick={() => updateStatus(row.id, "paid")}
          disabled={busy !== null}
          className={`rounded-xl bg-emerald-400 font-semibold text-slate-950 disabled:opacity-60 ${base}`}
        >
          {busy === `${row.id}:paid` ? "..." : "Mark Paid"}
        </button>
        <button
          onClick={() => updateStatus(row.id, "rejected")}
          disabled={busy !== null}
          className={`rounded-xl bg-rose-400 font-semibold text-slate-950 disabled:opacity-60 ${base}`}
        >
          {busy === `${row.id}:rejected` ? "..." : "Reject"}
        </button>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-8 text-slate-300">
        <div className="text-lg font-semibold text-white">No payout requests found.</div>
        <div className="mt-2 text-sm text-slate-400">Try changing your queue or search filters.</div>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.96))] shadow-[0_24px_70px_rgba(0,0,0,0.35)] lg:block">
        <div className="max-h-[72vh] overflow-auto">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur">
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                <th className="px-4 py-4">Agent</th>
                <th className="px-4 py-4">Phone</th>
                <th className="px-4 py-4">Amount</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Eligible Comm.</th>
                <th className="px-4 py-4">Available Balance</th>
                <th className="px-4 py-4">Risk</th>
                <th className="px-4 py-4">Requested</th>
                <th className="px-4 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-white/5 align-top hover:bg-white/[0.03]">
                  <td className="px-4 py-4">
                    <div className="font-semibold text-white">{row.agentName}</div>
                    <div className="mt-1 text-xs text-slate-500">{row.referralCode}</div>
                    <div className="mt-1 text-xs text-slate-500">{row.county || "No county"}</div>
                  </td>
                  <td className="px-4 py-4 text-slate-100">{row.phone || "No phone"}</td>
                  <td className="px-4 py-4 text-white">{money(row.amount)}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${statusBadge(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-100">{money(row.eligibleCommission)}</td>
                  <td className="px-4 py-4 text-amber-200">{money(row.availableBalance)}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${riskBadge(row.riskLevel)}`}>
                      {row.riskLevel}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-400">{new Date(row.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-4">{renderActions(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:hidden">
        {rows.map((row) => (
          <article key={row.id} className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.94),rgba(2,6,23,.98))] p-5 text-slate-200 shadow-[0_18px_45px_rgba(0,0,0,0.28)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">{row.agentName}</div>
                <div className="mt-1 text-sm text-slate-400">{row.phone || "No phone"} · {row.county || "No county"}</div>
              </div>
              <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${statusBadge(row.status)}`}>
                {row.status}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-slate-500">Requested</div><div className="mt-1 font-semibold text-white">{money(row.amount)}</div></div>
              <div><div className="text-slate-500">Available</div><div className="mt-1 font-semibold text-amber-200">{money(row.availableBalance)}</div></div>
            </div>
            <div className="mt-4">{renderActions(row, true)}</div>
          </article>
        ))}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/72 backdrop-blur-sm">
          <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.98),rgba(2,6,23,.99))] p-6 shadow-[-20px_0_60px_rgba(0,0,0,0.35)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">Payout request</div>
                <h2 className="mt-2 text-3xl font-semibold text-white">{selected.agentName}</h2>
                <p className="mt-2 text-sm text-slate-400">Withdrawal review for {money(selected.amount)}</p>
              </div>
              <button onClick={() => setSelectedId(null)} className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-100">
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Agent</div>
                <div className="mt-3 space-y-2">
                  <div>Name: {selected.agentName}</div>
                  <div>Referral code: {selected.referralCode}</div>
                  <div>Phone / M-Pesa: {selected.phone || "Not set"}</div>
                  <div>County: {selected.county || "Not set"}</div>
                </div>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Payout values</div>
                <div className="mt-3 space-y-2">
                  <div>Requested: {money(selected.amount)}</div>
                  <div>Eligible commissions: {money(selected.eligibleCommission)}</div>
                  <div>Available balance: {money(selected.availableBalance)}</div>
                  <div>Method: {selected.method}</div>
                  <div>Reference: {selected.reference || "Not set"}</div>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Admin actions</div>
              <div className="mt-4 flex flex-wrap gap-3">
                {renderActions(selected)}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
