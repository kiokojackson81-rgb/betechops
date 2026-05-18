"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Eye } from "lucide-react";

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

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-sm font-medium text-slate-100">{value}</div>
    </div>
  );
}

export default function AgentPayoutsAdminClient({ rows }: { rows: PayoutRow[] }) {
  const router = useRouter();
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const allSelected = rows.length > 0 && selectedIds.length === rows.length;
  const selectedRows = useMemo(() => rows.filter((row) => selectedIds.includes(row.id)), [rows, selectedIds]);

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

  async function bulkUpdateStatus(status: string) {
    if (!selectedIds.length) return;
    setBusy(`bulk:${status}`);
    for (const id of selectedIds) {
      const res = await fetch(`/api/admin/agents/payouts/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        setBusy(null);
        const payload = await res.json().catch(() => ({ error: "Unable to update selected payouts." }));
        window.alert(payload.error || "Unable to update selected payouts.");
        return;
      }
    }
    setBusy(null);
    setSelectedIds([]);
    startTransition(() => router.refresh());
  }

  function toggleExpanded(id: string) {
    setExpandedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? [] : rows.map((row) => row.id));
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
    <div className="space-y-4">
      {selectedIds.length ? (
        <div className="sticky top-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-cyan-400/20 bg-slate-950/95 px-5 py-4 backdrop-blur">
          <div className="text-sm text-slate-200">
            {selectedRows.length} payout{selectedRows.length === 1 ? "" : "s"} selected
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => bulkUpdateStatus("approved")} disabled={busy !== null} className="rounded-xl bg-cyan-300 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-60">
              {busy === "bulk:approved" ? "..." : "Bulk Approve"}
            </button>
            <button onClick={() => bulkUpdateStatus("held")} disabled={busy !== null} className="rounded-xl bg-amber-300 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-60">
              {busy === "bulk:held" ? "..." : "Bulk Hold"}
            </button>
            <button onClick={() => bulkUpdateStatus("paid")} disabled={busy !== null} className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-60">
              {busy === "bulk:paid" ? "..." : "Bulk Mark Paid"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.96))] lg:block">
        <div className="sticky top-0 z-10 grid grid-cols-[56px_56px_minmax(220px,1.4fr)_160px_150px_160px_130px_160px] items-center gap-3 border-b border-white/10 bg-slate-950/95 px-4 py-4 text-[11px] uppercase tracking-[0.18em] text-slate-500 backdrop-blur">
          <div className="flex justify-center">
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
          </div>
          <div />
          <div className="whitespace-nowrap">Payout</div>
          <div className="whitespace-nowrap">Agent</div>
          <div className="whitespace-nowrap">Request date</div>
          <div className="whitespace-nowrap">Amount</div>
          <div className="whitespace-nowrap">Status</div>
          <div className="whitespace-nowrap">Quick Action</div>
        </div>

        <div className="divide-y divide-white/5">
          {rows.map((row) => {
            const expanded = expandedIds.includes(row.id);
            return (
              <div key={row.id} className="transition hover:bg-white/[0.02]">
                <div className="grid grid-cols-[56px_56px_minmax(220px,1.4fr)_160px_150px_160px_130px_160px] items-center gap-3 px-4 py-4">
                  <div className="flex justify-center">
                    <input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleSelected(row.id)} />
                  </div>
                  <div>
                    <button onClick={() => toggleExpanded(row.id)} className="rounded-xl border border-white/10 p-2 text-slate-200 transition hover:border-white/20">
                      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate whitespace-nowrap font-semibold text-white">{row.agentName}</div>
                    <div className="truncate whitespace-nowrap text-xs text-slate-500">{row.phone || "No M-Pesa number"} · {row.referralCode}</div>
                  </div>
                  <div className="truncate whitespace-nowrap text-slate-300">{row.method}</div>
                  <div className="whitespace-nowrap text-slate-400">{new Date(row.createdAt).toLocaleDateString()}</div>
                  <div className="whitespace-nowrap text-white">{money(row.amount)}</div>
                  <div>
                    <span className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${statusBadge(row.status)}`}>
                      {row.status}
                    </span>
                  </div>
                  <div>
                    <button
                      onClick={() => toggleExpanded(row.id)}
                      className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:border-cyan-300/30"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Review
                    </button>
                  </div>
                </div>

                {expanded ? (
                  <div className="border-t border-white/5 bg-slate-950/55 px-4 py-5">
                    <div className="grid gap-4 xl:grid-cols-4">
                      <InfoCard label="Requested" value={money(row.amount)} />
                      <InfoCard label="Available balance" value={money(row.availableBalance)} />
                      <InfoCard label="Eligible commissions" value={money(row.eligibleCommission)} />
                      <InfoCard label="Risk" value={row.riskLevel} />
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-2">
                      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                        <div className="text-sm font-semibold text-white">Payout details</div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <InfoCard label="Agent" value={row.agentName} />
                          <InfoCard label="Phone / M-Pesa" value={row.phone || "Not set"} />
                          <InfoCard label="County" value={row.county || "Not set"} />
                          <InfoCard label="Status" value={row.status} />
                          <InfoCard label="Method" value={row.method} />
                          <InfoCard label="Reference" value={row.reference || "Not set"} />
                        </div>
                      </div>
                      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                        <div className="text-sm font-semibold text-white">Related records</div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <InfoCard label="Referral code" value={row.referralCode} />
                          <InfoCard label="Queue" value={row.queue.replace(/_/g, " ")} />
                          <InfoCard label="Request date" value={new Date(row.createdAt).toLocaleString()} />
                          <InfoCard label="Fraud checks" value={row.riskLevel === "high" ? "Needs payout review" : "No active hold"} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button onClick={() => updateStatus(row.id, "approved")} disabled={busy !== null} className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">
                        {busy === `${row.id}:approved` ? "..." : "Approve"}
                      </button>
                      <button onClick={() => updateStatus(row.id, "held")} disabled={busy !== null} className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">
                        {busy === `${row.id}:held` ? "..." : "Hold"}
                      </button>
                      <button onClick={() => updateStatus(row.id, "paid")} disabled={busy !== null} className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">
                        {busy === `${row.id}:paid` ? "..." : "Mark Paid"}
                      </button>
                      <button onClick={() => updateStatus(row.id, "rejected")} disabled={busy !== null} className="rounded-xl bg-rose-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">
                        {busy === `${row.id}:rejected` ? "..." : "Reject"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 lg:hidden">
        {rows.map((row) => {
          const expanded = expandedIds.includes(row.id);
          return (
            <article key={row.id} className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.94),rgba(2,6,23,.98))] p-5 text-slate-200 shadow-[0_18px_45px_rgba(0,0,0,0.28)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-lg font-semibold text-white">{row.agentName}</div>
                  <div className="mt-1 truncate text-sm text-slate-400">{row.phone || "No phone"} · {money(row.amount)}</div>
                </div>
                <button onClick={() => toggleExpanded(row.id)} className="rounded-xl border border-white/10 p-2 text-slate-200">
                  {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <InfoCard label="Status" value={row.status} />
                <InfoCard label="Available" value={money(row.availableBalance)} />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
