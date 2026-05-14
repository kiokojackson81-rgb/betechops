"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
  successRate: number;
  lastCommissionAt: string | null;
  commissions: Array<{ id: string; sourceType: string; orderNumber: string | null; commissionAmt: number; status: string; createdAt: string }>;
  payouts: Array<{ id: string; amount: number; method: string | null; reference: string | null; status: string; createdAt: string }>;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(value || 0);

export default function AgentsAdminClient({ agents }: { agents: AgentRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

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

  if (!agents.length) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-8 text-slate-300">
        No agents matched the current filters.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {agents.map((agent) => (
        <section
          key={agent.profile.id}
          className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.96))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.35)]"
        >
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-semibold text-white">{agent.displayName}</h2>
                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                  {agent.profile.status}
                </span>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                  {agent.profile.referralCode}
                </span>
              </div>
              <div className="grid gap-2 text-sm text-slate-400 md:grid-cols-2">
                <div>{agent.profile.email || agent.profile.user.email || "No email"}</div>
                <div>{agent.profile.phone || "No phone"}</div>
                <div>{agent.profile.country || "No country"} / {agent.profile.county || "No county"}</div>
                <div>Joined {new Date(agent.profile.createdAt).toLocaleDateString()}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => updateStatus(agent.profile.id, "approved")}
                disabled={busyId !== null}
                className="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {busyId === `${agent.profile.id}:approved` ? "Saving..." : "Approve"}
              </button>
              <button
                onClick={() => updateStatus(agent.profile.id, "rejected")}
                disabled={busyId !== null}
                className="rounded-2xl bg-rose-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {busyId === `${agent.profile.id}:rejected` ? "Saving..." : "Reject"}
              </button>
              <button
                onClick={() => updateStatus(agent.profile.id, "suspended")}
                disabled={busyId !== null}
                className="rounded-2xl bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {busyId === `${agent.profile.id}:suspended` ? "Saving..." : "Suspend"}
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Sales</div>
              <div className="mt-2 text-xl font-semibold text-white">{money(agent.totalSales)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Commission</div>
              <div className="mt-2 text-xl font-semibold text-white">{money(agent.totalCommission)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Pending</div>
              <div className="mt-2 text-xl font-semibold text-amber-200">{money(agent.pendingCommission)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Paid</div>
              <div className="mt-2 text-xl font-semibold text-emerald-200">{money(agent.paidCommission)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Payouts</div>
              <div className="mt-2 text-xl font-semibold text-white">{money(agent.totalPayouts)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Success rate</div>
              <div className="mt-2 text-xl font-semibold text-white">{agent.successRate}%</div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">KYC info</h3>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <div>National ID: {agent.profile.nationalId || "Not provided"}</div>
                <div>KRA PIN: {agent.profile.kraPin || "Not provided"}</div>
                <div>Gender: {agent.profile.gender || "Not provided"}</div>
                <div>Address: {agent.profile.address || "Not provided"}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Recent commissions</h3>
              <div className="mt-3 space-y-3">
                {agent.commissions.length ? agent.commissions.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
                    <div className="flex items-center justify-between gap-3">
                      <span>{item.sourceType}</span>
                      <span className="font-semibold text-white">{money(item.commissionAmt)}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{item.orderNumber || "No order"} · {item.status}</div>
                  </div>
                )) : <div className="text-sm text-slate-500">No commission history yet.</div>}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Recent payouts</h3>
              <div className="mt-3 space-y-3">
                {agent.payouts.length ? agent.payouts.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
                    <div className="flex items-center justify-between gap-3">
                      <span>{item.method || "Unspecified"}</span>
                      <span className="font-semibold text-white">{money(item.amount)}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{item.reference || "No reference"} · {item.status}</div>
                  </div>
                )) : <div className="text-sm text-slate-500">No payout requests yet.</div>}
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
