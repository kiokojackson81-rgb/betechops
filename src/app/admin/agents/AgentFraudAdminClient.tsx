"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Eye } from "lucide-react";

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

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-sm font-medium text-slate-100">{value}</div>
    </div>
  );
}

export default function AgentFraudAdminClient({ rows }: { rows: FraudRow[] }) {
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  function toggleExpanded(id: string) {
    setExpandedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  if (!rows.length) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-8 text-slate-300">
        <div className="text-lg font-semibold text-white">No fraud or duplicate alerts found.</div>
        <div className="mt-2 text-sm text-slate-400">Try changing your queue or search filters.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.96))] lg:block">
        <div className="sticky top-0 z-10 grid grid-cols-[56px_minmax(250px,1.5fr)_180px_200px_120px_140px_160px] items-center gap-3 border-b border-white/10 bg-slate-950/95 px-4 py-4 text-[11px] uppercase tracking-[0.18em] text-slate-500 backdrop-blur">
          <div />
          <div className="whitespace-nowrap">Alert</div>
          <div className="whitespace-nowrap">Phone</div>
          <div className="whitespace-nowrap">Agents / Customers</div>
          <div className="whitespace-nowrap">Risk</div>
          <div className="whitespace-nowrap">Date</div>
          <div className="whitespace-nowrap">Quick Action</div>
        </div>

        <div className="divide-y divide-white/5">
          {rows.map((row) => {
            const expanded = expandedIds.includes(row.id);
            return (
              <div key={row.id} className="transition hover:bg-white/[0.02]">
                <div className="grid grid-cols-[56px_minmax(250px,1.5fr)_180px_200px_120px_140px_160px] items-center gap-3 px-4 py-4">
                  <div>
                    <button onClick={() => toggleExpanded(row.id)} className="rounded-xl border border-white/10 p-2 text-slate-200 transition hover:border-white/20">
                      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate whitespace-nowrap font-semibold text-white">{row.title}</div>
                    <div className="truncate whitespace-nowrap text-xs text-slate-500">{queueLabel(row.queue)}</div>
                  </div>
                  <div className="truncate whitespace-nowrap text-slate-100">{row.phone || "No phone"}</div>
                  <div className="min-w-0">
                    <div className="truncate whitespace-nowrap text-slate-100">{row.agents.join(", ") || "No agents"}</div>
                    <div className="truncate whitespace-nowrap text-xs text-slate-500">{row.customerNames.join(", ") || "No customers"}</div>
                  </div>
                  <div>
                    <span className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${riskBadge(row.riskLevel)}`}>
                      {row.riskLevel}
                    </span>
                  </div>
                  <div className="whitespace-nowrap text-slate-400">{new Date(row.createdAt).toLocaleDateString()}</div>
                  <div>
                    <button
                      onClick={() => toggleExpanded(row.id)}
                      className="inline-flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:border-rose-300/30"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Investigate
                    </button>
                  </div>
                </div>

                {expanded ? (
                  <div className="border-t border-white/5 bg-slate-950/60 px-4 py-5">
                    <div className="grid gap-4 xl:grid-cols-4">
                      <InfoCard label="Risk score" value={row.riskLevel.toUpperCase()} />
                      <InfoCard label="Queue" value={queueLabel(row.queue)} />
                      <InfoCard label="County" value={row.county || "Not set"} />
                      <InfoCard label="Raised" value={new Date(row.createdAt).toLocaleString()} />
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-2">
                      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                        <div className="text-sm font-semibold text-white">Details</div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <InfoCard label="Phone" value={row.phone || "Not set"} />
                          <InfoCard label="Customers" value={row.customerNames.join(", ") || "Not set"} />
                          <InfoCard label="Agents" value={row.agents.join(", ") || "No agents"} />
                          <InfoCard label="Related orders" value={row.saleIds.join(", ") || "No sales"} />
                        </div>
                      </div>
                      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                        <div className="text-sm font-semibold text-white">Review notes</div>
                        <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-50/85">
                          {row.note}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200">Clear</button>
                      <button className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200">Hold Commission</button>
                      <button className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200">Suspend Agent</button>
                      <button className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200">Merge Customer</button>
                      <button className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200">Escalate</button>
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
                  <div className="truncate text-lg font-semibold text-white">{row.title}</div>
                  <div className="mt-1 truncate text-sm text-slate-400">{queueLabel(row.queue)} · {row.phone || "No phone"}</div>
                </div>
                <button onClick={() => toggleExpanded(row.id)} className="rounded-xl border border-white/10 p-2 text-slate-200">
                  {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
              <div className="mt-4">
                <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${riskBadge(row.riskLevel)}`}>
                  {row.riskLevel}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
