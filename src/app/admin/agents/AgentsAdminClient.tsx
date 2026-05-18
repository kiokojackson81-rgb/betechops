"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

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
  commissionCount: number;
  payoutCount: number;
  saleCount?: number;
  openSaleCount?: number;
  completedSaleCount?: number;
  potentialCommission?: number;
  successRate: number;
  lastCommissionAt: string | null;
  commissions: Array<{ id: string; sourceType: string; orderNumber: string | null; commissionAmt: number; status: string; createdAt: string }>;
  payouts: Array<{ id: string; amount: number; method: string | null; reference: string | null; status: string; createdAt: string }>;
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

function buildLocation(agent: AgentRow) {
  const parts = [agent.profile.county, agent.profile.city].filter(Boolean);
  return parts.length ? parts.join(" · ") : "No location";
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export default function AgentsAdminClient({ agents }: { agents: AgentRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.profile.id === selectedId) ?? null,
    [agents, selectedId],
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

  function renderActionButtons(agent: AgentRow, compact = false) {
    const base = compact ? "px-3 py-2 text-[11px]" : "px-3 py-2 text-xs";
    const nextSuspendAction = agent.profile.status === "suspended" ? "approved" : "suspended";
    const nextSuspendLabel = agent.profile.status === "suspended" ? "Reactivate" : "Suspend";

    return (
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedId(agent.profile.id)}
          className={`rounded-xl border border-white/10 font-semibold text-slate-100 transition hover:border-white/20 ${base}`}
        >
          View Details
        </button>
        <button
          onClick={() => updateStatus(agent.profile.id, "approved")}
          disabled={busyId !== null}
          className={`rounded-xl bg-emerald-400 font-semibold text-slate-950 disabled:opacity-60 ${base}`}
        >
          {busyId === `${agent.profile.id}:approved` ? "..." : "Approve"}
        </button>
        <button
          onClick={() => updateStatus(agent.profile.id, "rejected")}
          disabled={busyId !== null}
          className={`rounded-xl bg-rose-400 font-semibold text-slate-950 disabled:opacity-60 ${base}`}
        >
          {busyId === `${agent.profile.id}:rejected` ? "..." : "Reject"}
        </button>
        <button
          onClick={() => updateStatus(agent.profile.id, nextSuspendAction)}
          disabled={busyId !== null}
          className={`rounded-xl bg-amber-300 font-semibold text-slate-950 disabled:opacity-60 ${base}`}
        >
          {busyId === `${agent.profile.id}:${nextSuspendAction}` ? "..." : nextSuspendLabel}
        </button>
      </div>
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
    <>
      <div className="hidden overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.96))] shadow-[0_24px_70px_rgba(0,0,0,0.35)] lg:block">
        <div className="max-h-[72vh] overflow-auto">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur">
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                <th className="px-4 py-4">Agent</th>
                <th className="px-4 py-4">Code</th>
                <th className="px-4 py-4">Phone</th>
                <th className="px-4 py-4">Email</th>
                <th className="px-4 py-4">Location</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Sales</th>
                <th className="px-4 py-4">Pending</th>
                <th className="px-4 py-4">Paid</th>
                <th className="px-4 py-4">Joined</th>
                <th className="px-4 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.profile.id} className="border-b border-white/5 align-top transition hover:bg-white/[0.03]">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-xs font-semibold uppercase tracking-[0.18em] text-white">
                        {initials(agent.displayName)}
                      </div>
                      <div>
                        <div className="font-semibold text-white">{agent.displayName}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {agent.completedSaleCount ?? 0} completed · {agent.openSaleCount ?? 0} open
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 font-medium text-cyan-100">{agent.profile.referralCode}</td>
                  <td className="px-4 py-4">{agent.profile.phone || "No phone"}</td>
                  <td className="px-4 py-4">{agent.profile.email || agent.profile.user.email || "No email"}</td>
                  <td className="px-4 py-4">{buildLocation(agent)}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${statusBadge(agent.profile.status)}`}>
                      {agent.profile.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">{money(agent.totalSales)}</td>
                  <td className="px-4 py-4 text-amber-200">{money(agent.pendingCommission)}</td>
                  <td className="px-4 py-4 text-emerald-200">{money(agent.paidCommission)}</td>
                  <td className="px-4 py-4 text-slate-400">{new Date(agent.profile.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-4">{renderActionButtons(agent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4 lg:hidden">
        {agents.map((agent) => (
          <article
            key={agent.profile.id}
            className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.96))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">{agent.displayName}</div>
                <div className="mt-1 text-sm text-slate-400">{agent.profile.phone || "No phone"}</div>
                <div className="mt-1 text-sm text-slate-500">{buildLocation(agent)}</div>
              </div>
              <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${statusBadge(agent.profile.status)}`}>
                {agent.profile.status}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs">
              <div>
                <div className="uppercase tracking-[0.16em] text-slate-500">Sales</div>
                <div className="mt-1 font-semibold text-white">{money(agent.totalSales)}</div>
              </div>
              <div>
                <div className="uppercase tracking-[0.16em] text-slate-500">Pending</div>
                <div className="mt-1 font-semibold text-amber-200">{money(agent.pendingCommission)}</div>
              </div>
              <div>
                <div className="uppercase tracking-[0.16em] text-slate-500">Paid</div>
                <div className="mt-1 font-semibold text-emerald-200">{money(agent.paidCommission)}</div>
              </div>
            </div>

            <div className="mt-4">{renderActionButtons(agent, true)}</div>
          </article>
        ))}
      </div>

      {selectedAgent ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/70 backdrop-blur-sm">
          <button className="absolute inset-0 cursor-default" onClick={() => setSelectedId(null)} aria-label="Close details" />
          <aside className="relative h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.99),rgba(2,6,23,.99))] p-6 shadow-[-24px_0_60px_rgba(0,0,0,0.35)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-cyan-300">Agent Details</div>
                <h2 className="mt-2 text-3xl font-semibold text-white">{selectedAgent.displayName}</h2>
                <div className="mt-2 text-sm text-slate-400">
                  {selectedAgent.profile.email || selectedAgent.profile.user.email || "No email"} · {selectedAgent.profile.phone || "No phone"}
                </div>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:col-span-2">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Total Sales</div>
                <div className="mt-3 text-2xl font-semibold text-white">{money(selectedAgent.totalSales)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Pending</div>
                <div className="mt-3 text-2xl font-semibold text-amber-200">{money(selectedAgent.pendingCommission)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Paid</div>
                <div className="mt-3 text-2xl font-semibold text-emerald-200">{money(selectedAgent.paidCommission)}</div>
              </div>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                <h3 className="text-lg font-semibold text-white">Agent Profile</h3>
                <div className="mt-4 space-y-2 text-sm text-slate-300">
                  <div>Full name: {selectedAgent.displayName}</div>
                  <div>Email: {selectedAgent.profile.email || selectedAgent.profile.user.email || "Not provided"}</div>
                  <div>Phone: {selectedAgent.profile.phone || "Not provided"}</div>
                  <div>Referral code: {selectedAgent.profile.referralCode}</div>
                  <div>Country: {selectedAgent.profile.country || "Not provided"}</div>
                  <div>County: {selectedAgent.profile.county || "Not provided"}</div>
                  <div>Town / City: {selectedAgent.profile.city || "Not provided"}</div>
                  <div>Joined date: {new Date(selectedAgent.profile.createdAt).toLocaleString()}</div>
                  <div>
                    Current status:{" "}
                    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${statusBadge(selectedAgent.profile.status)}`}>
                      {selectedAgent.profile.status}
                    </span>
                  </div>
                </div>
              </section>

              <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                <h3 className="text-lg font-semibold text-white">KYC Info</h3>
                <div className="mt-4 space-y-2 text-sm text-slate-300">
                  <div>National ID: {selectedAgent.profile.nationalId || "Not provided"}</div>
                  <div>KRA PIN: {selectedAgent.profile.kraPin || "Not provided"}</div>
                  <div>Gender: {selectedAgent.profile.gender || "Not provided"}</div>
                  <div>Address: {selectedAgent.profile.address || "Not provided"}</div>
                </div>
              </section>

              <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                <h3 className="text-lg font-semibold text-white">Performance</h3>
                <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                  <div>Total submitted sales: {selectedAgent.saleCount ?? 0}</div>
                  <div>Completed sales: {selectedAgent.completedSaleCount ?? 0}</div>
                  <div>Pending sales: {selectedAgent.openSaleCount ?? 0}</div>
                  <div>Total commission: {money(selectedAgent.totalCommission)}</div>
                  <div>Pending commission: {money(selectedAgent.pendingCommission)}</div>
                  <div>Paid commission: {money(selectedAgent.paidCommission)}</div>
                  <div>Potential commission: {money(selectedAgent.potentialCommission ?? 0)}</div>
                  <div>Success rate: {selectedAgent.successRate}%</div>
                </div>
              </section>

              <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                <h3 className="text-lg font-semibold text-white">Admin Actions</h3>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => updateStatus(selectedAgent.profile.id, "approved")}
                    disabled={busyId !== null}
                    className="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => updateStatus(selectedAgent.profile.id, "rejected")}
                    disabled={busyId !== null}
                    className="rounded-2xl bg-rose-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => updateStatus(selectedAgent.profile.id, "suspended")}
                    disabled={busyId !== null}
                    className="rounded-2xl bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
                  >
                    Suspend
                  </button>
                  <button
                    onClick={() => updateStatus(selectedAgent.profile.id, "approved")}
                    disabled={busyId !== null}
                    className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 disabled:opacity-60"
                  >
                    Reactivate
                  </button>
                  <Link
                    href={`/admin/agents/pending-sales?agentId=${selectedAgent.profile.userId}`}
                    className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100"
                  >
                    View Sales
                  </Link>
                </div>
              </section>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                <h3 className="text-lg font-semibold text-white">Recent Commissions</h3>
                <div className="mt-4 space-y-3">
                  {selectedAgent.commissions.length ? selectedAgent.commissions.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-sm text-slate-300">
                      <div className="flex items-center justify-between gap-3">
                        <span>{item.orderNumber || item.sourceType}</span>
                        <span className="font-semibold text-white">{money(item.commissionAmt)}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{item.status} · {new Date(item.createdAt).toLocaleString()}</div>
                    </div>
                  )) : <div className="text-sm text-slate-500">No commissions yet.</div>}
                </div>
              </section>

              <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                <h3 className="text-lg font-semibold text-white">Recent Payouts</h3>
                <div className="mt-4 space-y-3">
                  {selectedAgent.payouts.length ? selectedAgent.payouts.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-sm text-slate-300">
                      <div className="flex items-center justify-between gap-3">
                        <span>{item.method || "Unspecified"}</span>
                        <span className="font-semibold text-white">{money(item.amount)}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{item.reference || "No reference"} · {item.status}</div>
                    </div>
                  )) : <div className="text-sm text-slate-500">No payouts yet.</div>}
                </div>
              </section>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
