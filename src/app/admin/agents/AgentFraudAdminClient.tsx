"use client";

import { useMemo, useState } from "react";

type FraudRow = {
  id: string;
  queue: "duplicate_customers" | "phone_reuse" | "suspicious_agents" | "disputes";
  title: string;
  riskLevel: "low" | "medium" | "high";
  phone: string;
  agents: string[];
  saleIds: string[];
  customerNames: string[];
  county: string;
  createdAt: string;
  note: string;
};

function riskBadge(level: FraudRow["riskLevel"]) {
  if (level === "high") return "border-rose-400/20 bg-rose-400/10 text-rose-200";
  if (level === "medium") return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
}

function queueLabel(queue: FraudRow["queue"]) {
  if (queue === "duplicate_customers") return "Duplicate customer";
  if (queue === "phone_reuse") return "Phone reuse";
  if (queue === "suspicious_agents") return "Suspicious agent";
  return "Dispute";
}

export default function AgentFraudAdminClient({ rows }: { rows: FraudRow[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId]);

  if (!rows.length) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-8 text-slate-300">
        <div className="text-lg font-semibold text-white">No fraud or duplicate alerts found.</div>
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
                <th className="px-4 py-4">Alert</th>
                <th className="px-4 py-4">Phone</th>
                <th className="px-4 py-4">Agents</th>
                <th className="px-4 py-4">County</th>
                <th className="px-4 py-4">Risk</th>
                <th className="px-4 py-4">Created</th>
                <th className="px-4 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-white/5 align-top hover:bg-white/[0.03]">
                  <td className="px-4 py-4">
                    <div className="font-semibold text-white">{row.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{queueLabel(row.queue)}</div>
                  </td>
                  <td className="px-4 py-4 text-slate-100">{row.phone || "No phone"}</td>
                  <td className="px-4 py-4 text-slate-100">{row.agents.join(", ") || "No agents"}</td>
                  <td className="px-4 py-4 text-slate-400">{row.county || "Not set"}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${riskBadge(row.riskLevel)}`}>
                      {row.riskLevel}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-400">{new Date(row.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-4">
                    <button onClick={() => setSelectedId(row.id)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-100">
                      View Details
                    </button>
                  </td>
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
                <div className="text-lg font-semibold text-white">{row.title}</div>
                <div className="mt-1 text-sm text-slate-400">{queueLabel(row.queue)} · {row.phone || "No phone"}</div>
              </div>
              <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${riskBadge(row.riskLevel)}`}>
                {row.riskLevel}
              </span>
            </div>
            <div className="mt-4 text-sm text-slate-400">{row.note}</div>
            <div className="mt-4">
              <button onClick={() => setSelectedId(row.id)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-100">
                View Details
              </button>
            </div>
          </article>
        ))}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/72 backdrop-blur-sm">
          <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.98),rgba(2,6,23,.99))] p-6 shadow-[-20px_0_60px_rgba(0,0,0,0.35)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-300">Fraud / duplicate review</div>
                <h2 className="mt-2 text-3xl font-semibold text-white">{selected.title}</h2>
                <p className="mt-2 text-sm text-slate-400">{queueLabel(selected.queue)}</p>
              </div>
              <button onClick={() => setSelectedId(null)} className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-100">
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Customer / phone</div>
                <div className="mt-3 space-y-2">
                  <div>Phone: {selected.phone || "Not set"}</div>
                  <div>Customers: {selected.customerNames.join(", ") || "Not set"}</div>
                  <div>County: {selected.county || "Not set"}</div>
                </div>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Competing agents</div>
                <div className="mt-3 space-y-2">
                  <div>Agents: {selected.agents.join(", ") || "No agents"}</div>
                  <div>Sale references: {selected.saleIds.join(", ") || "No sales"}</div>
                  <div>Raised: {new Date(selected.createdAt).toLocaleString()}</div>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-[24px] border border-rose-400/20 bg-rose-400/10 p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-rose-100">Admin review note</div>
              <p className="mt-3 text-sm text-rose-50/85">{selected.note}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-rose-100/80">
                <span className="rounded-full border border-rose-300/20 px-3 py-1">Keep first submission</span>
                <span className="rounded-full border border-rose-300/20 px-3 py-1">Merge duplicates</span>
                <span className="rounded-full border border-rose-300/20 px-3 py-1">Reassign ownership</span>
                <span className="rounded-full border border-rose-300/20 px-3 py-1">Reject fake duplicate</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
