"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Eye } from "lucide-react";

type AgentRow = {
  profile: {
    id: string;
    userId: string;
    referralCode: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    nationalId: string | null;
    kraPin: string | null;
    gender: string | null;
    country: string | null;
    county: string | null;
    city: string | null;
    address: string | null;
    idFrontUrl: string | null;
    idBackUrl: string | null;
    profilePhotoUrl: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
    user: { id: string; name: string | null; email: string | null; createdAt: string };
  };
  displayName: string;
  totalSales: number;
  totalCommission: number;
  paidCommission: number;
  pendingCommission: number;
  totalPayouts: number;
  referralCount?: number;
  commissionCount: number;
  payoutCount: number;
  saleCount?: number;
  openSaleCount?: number;
  completedSaleCount?: number;
  potentialCommission?: number;
  successRate: number;
  lastCommissionAt: string | null;
  lastActiveAt: string;
  duplicateLeadCount: number;
  cancellationRate: number;
  riskLevel: "low" | "medium" | "high";
  performanceLabel: string;
  commissions: Array<{ id: string; sourceType: string; orderNumber: string | null; commissionAmt: number; status: string; createdAt: string }>;
  payouts: Array<{ id: string; amount: number; method: string | null; reference: string | null; status: string; createdAt: string }>;
  activities: Array<{ id: string; action: string; description: string | null; createdAt: string }>;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(value || 0);

function statusBadge(status: string) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  if (normalized === "pending") return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  if (normalized === "rejected") return "border-rose-400/20 bg-rose-400/10 text-rose-200";
  if (normalized === "suspended") return "border-slate-400/20 bg-slate-400/10 text-slate-300";
  return "border-white/10 bg-white/[0.04] text-slate-200";
}

function riskBadge(level: AgentRow["riskLevel"]) {
  if (level === "high") return "border-rose-400/20 bg-rose-400/10 text-rose-200";
  if (level === "medium") return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-sm font-medium text-slate-100">{value}</div>
    </div>
  );
}

export default function AgentsAdminClient({ agents }: { agents: AgentRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [, startTransition] = useTransition();

  const allSelected = agents.length > 0 && selectedIds.length === agents.length;
  const selectedAgents = useMemo(
    () => agents.filter((agent) => selectedIds.includes(agent.profile.id)),
    [agents, selectedIds],
  );

  async function updateStatus(userId: string, status: string) {
    setBusyId(`${userId}:${status}`);
    const res = await fetch(`/api/admin/agents/${userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusyId(null);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({ error: "Unable to update status" }));
      window.alert(payload.error || "Unable to update status");
      return;
    }
    startTransition(() => router.refresh());
  }

  async function bulkUpdateStatus(status: string) {
    if (!selectedIds.length) return;
    setBusyId(`bulk:${status}`);
    for (const userId of selectedIds) {
      const res = await fetch(`/api/admin/agents/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        setBusyId(null);
        const payload = await res.json().catch(() => ({ error: "Unable to update selected agents" }));
        window.alert(payload.error || "Unable to update selected agents");
        return;
      }
    }
    setBusyId(null);
    setSelectedIds([]);
    startTransition(() => router.refresh());
  }

  async function deleteAgent(profileId: string, displayName: string) {
    const confirmed = window.confirm(
      `Delete ${displayName}? This removes the agent profile, sales, commissions, payouts, and related records.`,
    );
    if (!confirmed) return;

    setBusyId(`${profileId}:delete`);
    const res = await fetch(`/api/admin/agents/${profileId}`, {
      method: "DELETE",
    });
    setBusyId(null);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({ error: "Unable to delete agent." }));
      window.alert(payload.error || "Unable to delete agent.");
      return;
    }
    setSelectedIds((current) => current.filter((id) => id !== profileId));
    setExpandedIds((current) => current.filter((id) => id !== profileId));
    startTransition(() => router.refresh());
  }

  function toggleSelected(userId: string) {
    setSelectedIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? [] : agents.map((agent) => agent.profile.id));
  }

  function toggleExpanded(agentId: string) {
    setExpandedIds((current) =>
      current.includes(agentId) ? current.filter((id) => id !== agentId) : [...current, agentId],
    );
  }

  if (!agents.length) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-8 text-slate-300">
        <div className="text-lg font-semibold text-white">No agents found.</div>
        <div className="mt-2 text-sm text-slate-400">Try changing your search or filters.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {selectedIds.length ? (
        <div className="sticky top-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-cyan-400/20 bg-slate-950/95 px-5 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.25)] backdrop-blur">
          <div className="text-sm text-slate-200">
            {selectedAgents.length} agent{selectedAgents.length === 1 ? "" : "s"} selected
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => bulkUpdateStatus("approved")}
              disabled={busyId !== null}
              className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-60"
            >
              {busyId === "bulk:approved" ? "..." : "Bulk Approve"}
            </button>
            <button
              onClick={() => bulkUpdateStatus("suspended")}
              disabled={busyId !== null}
              className="rounded-xl bg-amber-300 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-60"
            >
              {busyId === "bulk:suspended" ? "..." : "Bulk Suspend"}
            </button>
            <button
              onClick={() => bulkUpdateStatus("rejected")}
              disabled={busyId !== null}
              className="rounded-xl bg-rose-400 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-60"
            >
              {busyId === "bulk:rejected" ? "..." : "Bulk Reject"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.96))] lg:block">
        <div className="sticky top-0 z-10 grid grid-cols-[56px_56px_minmax(220px,1.45fr)_120px_120px_150px_90px_90px_130px_130px_140px_150px] items-center gap-3 border-b border-white/10 bg-slate-950/95 px-4 py-4 text-[11px] uppercase tracking-[0.18em] text-slate-500 backdrop-blur">
          <div className="flex justify-center">
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
          </div>
          <div />
          <div className="whitespace-nowrap">Agent</div>
          <div className="whitespace-nowrap">Status</div>
          <div className="whitespace-nowrap">County</div>
          <div className="whitespace-nowrap">Phone</div>
          <div className="whitespace-nowrap">Referrals</div>
          <div className="whitespace-nowrap">Orders</div>
          <div className="whitespace-nowrap">Sales</div>
          <div className="whitespace-nowrap">Pending</div>
          <div className="whitespace-nowrap">Paid</div>
          <div className="whitespace-nowrap">Fraud / Risk</div>
          <div className="whitespace-nowrap">Quick Action</div>
        </div>

        <div className="divide-y divide-white/5">
          {agents.map((agent) => {
            const expanded = expandedIds.includes(agent.profile.id);
            const nextSuspendAction = agent.profile.status === "suspended" ? "approved" : "suspended";
            const nextSuspendLabel = agent.profile.status === "suspended" ? "Reactivate" : "Suspend";
            return (
              <div key={agent.profile.id} className="transition hover:bg-white/[0.02]">
                <div className="grid grid-cols-[56px_56px_minmax(220px,1.45fr)_120px_120px_150px_90px_90px_130px_130px_140px_150px] items-center gap-3 px-4 py-4">
                  <div className="flex justify-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(agent.profile.id)}
                      onChange={() => toggleSelected(agent.profile.id)}
                    />
                  </div>
                  <div>
                    <button
                      onClick={() => toggleExpanded(agent.profile.id)}
                      className="rounded-xl border border-white/10 p-2 text-slate-200 transition hover:border-white/20"
                    >
                      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-xs font-semibold uppercase tracking-[0.18em] text-white">
                        {initials(agent.displayName)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate whitespace-nowrap font-semibold text-white">{agent.displayName}</div>
                        <div className="truncate whitespace-nowrap text-xs text-slate-500">
                          Code {agent.profile.referralCode} · {agent.performanceLabel}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <span className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${statusBadge(agent.profile.status)}`}>
                      {agent.profile.status}
                    </span>
                  </div>
                  <div className="truncate whitespace-nowrap text-slate-300">{agent.profile.county || "No county"}</div>
                  <div className="truncate whitespace-nowrap text-slate-300">{agent.profile.phone || "No phone"}</div>
                  <div className="whitespace-nowrap text-cyan-200">{agent.referralCount ?? 0}</div>
                  <div className="whitespace-nowrap text-sky-200">{agent.saleCount ?? 0}</div>
                  <div className="whitespace-nowrap text-slate-100">{money(agent.totalSales)}</div>
                  <div className="whitespace-nowrap text-amber-200">{money(agent.pendingCommission)}</div>
                  <div className="whitespace-nowrap text-emerald-200">{money(agent.paidCommission)}</div>
                  <div>
                    <span className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${riskBadge(agent.riskLevel)}`}>
                      {agent.riskLevel} {agent.duplicateLeadCount > 0 ? `· ${agent.duplicateLeadCount} dupes` : ""}
                    </span>
                  </div>
                  <div>
                    <button
                      onClick={() => toggleExpanded(agent.profile.id)}
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
                      <InfoCard label="Referral code" value={agent.profile.referralCode} />
                      <InfoCard label="Total referrals" value={String(agent.referralCount ?? 0)} />
                      <InfoCard label="Total orders" value={String(agent.saleCount ?? 0)} />
                      <InfoCard label="Success rate" value={`${agent.successRate}%`} />
                      <InfoCard label="Pending sales" value={String(agent.openSaleCount ?? 0)} />
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-2">
                      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                        <div className="text-sm font-semibold text-white">Details</div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <InfoCard label="Email" value={agent.profile.email || agent.profile.user.email || "Not provided"} />
                          <InfoCard label="Phone" value={agent.profile.phone || "Not provided"} />
                          <InfoCard label="Country" value={agent.profile.country || "Not provided"} />
                          <InfoCard label="Town / City" value={agent.profile.city || "Not provided"} />
                          <InfoCard label="Address" value={agent.profile.address || "Not provided"} />
                          <InfoCard label="Last active" value={new Date(agent.lastActiveAt).toLocaleString()} />
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                        <div className="text-sm font-semibold text-white">KYC and risk</div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <InfoCard label="National ID" value={agent.profile.nationalId || "Not provided"} />
                          <InfoCard label="KRA PIN" value={agent.profile.kraPin || "Not provided"} />
                          <InfoCard label="Gender" value={agent.profile.gender || "Not provided"} />
                          <InfoCard label="Duplicate leads" value={String(agent.duplicateLeadCount)} />
                          <InfoCard label="Cancellation rate" value={`${agent.cancellationRate}%`} />
                          <InfoCard label="Potential commission" value={money(agent.potentialCommission ?? 0)} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-3">
                      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                        <div className="text-sm font-semibold text-white">Recent commissions</div>
                        <div className="mt-4 space-y-3">
                          {agent.commissions.length ? agent.commissions.slice(0, 4).map((item) => (
                            <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-sm text-slate-300">
                              <div className="flex items-center justify-between gap-3">
                                <span className="truncate">{item.orderNumber || item.sourceType}</span>
                                <span className="whitespace-nowrap font-semibold text-white">{money(item.commissionAmt)}</span>
                              </div>
                              <div className="mt-1 text-xs text-slate-500">{item.status} · {new Date(item.createdAt).toLocaleString()}</div>
                            </div>
                          )) : <div className="text-sm text-slate-500">No commissions yet.</div>}
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                        <div className="text-sm font-semibold text-white">Recent payouts</div>
                        <div className="mt-4 space-y-3">
                          {agent.payouts.length ? agent.payouts.slice(0, 4).map((item) => (
                            <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-sm text-slate-300">
                              <div className="flex items-center justify-between gap-3">
                                <span className="truncate">{item.method || "Unspecified"}</span>
                                <span className="whitespace-nowrap font-semibold text-white">{money(item.amount)}</span>
                              </div>
                              <div className="mt-1 text-xs text-slate-500">{item.reference || "No reference"} · {item.status}</div>
                            </div>
                          )) : <div className="text-sm text-slate-500">No payouts yet.</div>}
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                        <div className="text-sm font-semibold text-white">Activity</div>
                        <div className="mt-4 space-y-3">
                          {agent.activities.length ? agent.activities.slice(0, 4).map((item) => (
                            <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-sm text-slate-300">
                              <div className="font-semibold text-white">{item.action.replace(/_/g, " ")}</div>
                              <div className="mt-1 text-slate-400">{item.description || "No description"}</div>
                              <div className="mt-2 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</div>
                            </div>
                          )) : <div className="text-sm text-slate-500">No recent activity.</div>}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        onClick={() => updateStatus(agent.profile.id, "approved")}
                        disabled={busyId !== null}
                        className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
                      >
                        {busyId === `${agent.profile.id}:approved` ? "..." : "Approve"}
                      </button>
                      <button
                        onClick={() => updateStatus(agent.profile.id, nextSuspendAction)}
                        disabled={busyId !== null}
                        className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
                      >
                        {busyId === `${agent.profile.id}:${nextSuspendAction}` ? "..." : nextSuspendLabel}
                      </button>
                      <button
                        onClick={() => updateStatus(agent.profile.id, "rejected")}
                        disabled={busyId !== null}
                        className="rounded-xl bg-rose-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
                      >
                        {busyId === `${agent.profile.id}:rejected` ? "..." : "Reject"}
                      </button>
                      <Link
                        href={`/admin/agents/pending-sales?agentId=${agent.profile.userId}`}
                        className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100"
                      >
                        Open Sales Queue
                      </Link>
                      <button
                        onClick={() => deleteAgent(agent.profile.id, agent.displayName)}
                        disabled={busyId !== null}
                        className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-100 disabled:opacity-60"
                      >
                        {busyId === `${agent.profile.id}:delete` ? "Deleting..." : "Delete Agent"}
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
        {agents.map((agent) => {
          const expanded = expandedIds.includes(agent.profile.id);
          return (
            <article
              key={agent.profile.id}
              className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.96))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-white">{agent.displayName}</div>
                  <div className="mt-1 truncate text-sm text-slate-400">{agent.profile.phone || "No phone"} · {agent.profile.county || "No county"}</div>
                </div>
                <button
                  onClick={() => toggleExpanded(agent.profile.id)}
                  className="rounded-xl border border-white/10 p-2 text-slate-200"
                >
                  {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <InfoCard label="Status" value={agent.profile.status} />
                <InfoCard label="Risk" value={agent.riskLevel} />
                <InfoCard label="Referrals" value={String(agent.referralCount ?? 0)} />
                <InfoCard label="Orders" value={String(agent.saleCount ?? 0)} />
                <InfoCard label="Pending" value={money(agent.pendingCommission)} />
                <InfoCard label="Paid" value={money(agent.paidCommission)} />
              </div>

              {expanded ? (
                <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
                  <div className="grid gap-3">
                    <InfoCard label="Referral code" value={agent.profile.referralCode} />
                    <InfoCard label="Email" value={agent.profile.email || agent.profile.user.email || "Not provided"} />
                    <InfoCard label="Success rate" value={`${agent.successRate}%`} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => updateStatus(agent.profile.id, "approved")} className="rounded-xl bg-emerald-400 px-3 py-2 text-xs font-semibold text-slate-950">Approve</button>
                    <button onClick={() => updateStatus(agent.profile.id, "suspended")} className="rounded-xl bg-amber-300 px-3 py-2 text-xs font-semibold text-slate-950">Suspend</button>
                    <button onClick={() => updateStatus(agent.profile.id, "rejected")} className="rounded-xl bg-rose-400 px-3 py-2 text-xs font-semibold text-slate-950">Reject</button>
                    <button
                      onClick={() => deleteAgent(agent.profile.id, agent.displayName)}
                      disabled={busyId !== null}
                      className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-100 disabled:opacity-60"
                    >
                      {busyId === `${agent.profile.id}:delete` ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
