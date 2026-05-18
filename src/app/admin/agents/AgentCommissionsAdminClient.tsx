"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type CommissionRow = {
  id: string;
  queue: string;
  kind: "locked" | "earned";
  agentId: string;
  agentName: string;
  referralCode: string;
  phone: string;
  county: string;
  riskLevel: "low" | "medium" | "high";
  customerName: string;
  customerPhone: string;
  productName: string;
  saleId: string | null;
  receiptNumber: string | null;
  saleAmount: number;
  commissionAmount: number;
  status: string;
  createdAt: string;
  note: string;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(value || 0);

function queueBadge(queue: string) {
  if (queue === "paid") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  if (queue === "available") return "border-cyan-400/20 bg-cyan-400/10 text-cyan-200";
  if (queue === "pending") return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  if (queue === "locked") return "border-rose-400/20 bg-rose-400/10 text-rose-200";
  return "border-white/10 bg-white/[0.04] text-slate-200";
}

function riskBadge(level: CommissionRow["riskLevel"]) {
  if (level === "high") return "border-rose-400/20 bg-rose-400/10 text-rose-200";
  if (level === "medium") return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
}

export default function AgentCommissionsAdminClient({ rows }: { rows: CommissionRow[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId]);

  if (!rows.length) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-8 text-slate-300">
        <div className="text-lg font-semibold text-white">No commissions found.</div>
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
                <th className="px-4 py-4">Customer</th>
                <th className="px-4 py-4">Product</th>
                <th className="px-4 py-4">Sale Value</th>
                <th className="px-4 py-4">Commission</th>
                <th className="px-4 py-4">Queue</th>
                <th className="px-4 py-4">Risk</th>
                <th className="px-4 py-4">Created</th>
                <th className="px-4 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-white/5 align-top hover:bg-white/[0.03]">
                  <td className="px-4 py-4">
                    <div className="font-semibold text-white">{row.agentName}</div>
                    <div className="mt-1 text-xs text-slate-500">{row.referralCode}</div>
                    <div className="mt-1 text-xs text-slate-500">{row.phone || "No phone"}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-slate-100">{row.customerName}</div>
                    <div className="mt-1 text-xs text-slate-500">{row.customerPhone || "No phone"}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-slate-100">{row.productName}</div>
                    <div className="mt-1 text-xs text-slate-500">{row.receiptNumber || "No receipt"}</div>
                  </td>
                  <td className="px-4 py-4 text-slate-100">{money(row.saleAmount)}</td>
                  <td className="px-4 py-4 text-amber-200">{money(row.commissionAmount)}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${queueBadge(row.queue)}`}>
                      {row.queue.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${riskBadge(row.riskLevel)}`}>
                      {row.riskLevel}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-400">{new Date(row.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedId(row.id)}
                        className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-white/20"
                      >
                        View Details
                      </button>
                      {row.saleId ? (
                        <Link
                          href={`/admin/agents/sales/${row.saleId}`}
                          className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:border-cyan-300/30"
                        >
                          Open Sale
                        </Link>
                      ) : null}
                    </div>
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
                <div className="text-lg font-semibold text-white">{row.agentName}</div>
                <div className="mt-1 text-sm text-slate-400">{row.customerName} · {row.productName}</div>
              </div>
              <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${queueBadge(row.queue)}`}>
                {row.queue.replace(/_/g, " ")}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-slate-500">Sale value</div>
                <div className="mt-1 font-semibold text-white">{money(row.saleAmount)}</div>
              </div>
              <div>
                <div className="text-slate-500">Commission</div>
                <div className="mt-1 font-semibold text-amber-200">{money(row.commissionAmount)}</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedId(row.id)}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-100"
              >
                View Details
              </button>
              {row.saleId ? (
                <Link href={`/admin/agents/sales/${row.saleId}`} className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100">
                  Open Sale
                </Link>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/72 backdrop-blur-sm">
          <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.98),rgba(2,6,23,.99))] p-6 shadow-[-20px_0_60px_rgba(0,0,0,0.35)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Commission detail</div>
                <h2 className="mt-2 text-3xl font-semibold text-white">{selected.agentName}</h2>
                <p className="mt-2 text-sm text-slate-400">{selected.customerName} · {selected.productName}</p>
              </div>
              <button onClick={() => setSelectedId(null)} className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-100">
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Commission queue</div>
                <div className="mt-3 text-2xl font-semibold text-white">{selected.queue.replace(/_/g, " ")}</div>
                <div className="mt-2 text-sm text-slate-400">{selected.note}</div>
              </div>
              <div className="rounded-[24px] border border-amber-400/20 bg-amber-400/10 p-5">
                <div className="text-xs uppercase tracking-[0.2em] text-amber-100">Commission amount</div>
                <div className="mt-3 text-3xl font-semibold text-white">{money(selected.commissionAmount)}</div>
                <div className="mt-2 text-sm text-amber-50/80">Against sale value {money(selected.saleAmount)}</div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Agent info</div>
                <div className="mt-3 space-y-2">
                  <div>Name: {selected.agentName}</div>
                  <div>Referral code: {selected.referralCode}</div>
                  <div>Phone: {selected.phone || "Not set"}</div>
                  <div>County: {selected.county || "Not set"}</div>
                </div>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Customer and sale</div>
                <div className="mt-3 space-y-2">
                  <div>Customer: {selected.customerName}</div>
                  <div>Phone: {selected.customerPhone || "Not set"}</div>
                  <div>Product: {selected.productName}</div>
                  <div>Receipt / Order: {selected.receiptNumber || "Not linked"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
