"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type AdminQuote = {
  id: string;
  quoteRef: string;
  customerName: string;
  customerPhone: string;
  source: string;
  status: string;
  quoteTitle: string | null;
  templateName: string | null;
  requiresApproval: boolean;
  assignedAttendant: { name: string | null; email: string | null } | null;
  quotationData: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

const STATUS_OPTIONS = [
  "ALL",
  "DRAFT",
  "NEW",
  "PENDING_APPROVAL",
  "APPROVED",
  "SENT",
  "VIEWED",
  "FOLLOW_UP",
  "ACCEPTED",
  "REJECTED",
  "CONVERTED",
  "CLOSED",
  "EXPIRED",
] as const;

const SOURCE_OPTIONS = [
  "ALL",
  "WEBSITE_REQUEST",
  "MANUAL",
  "RECEIPTS",
  "ADMIN",
  "WHATSAPP",
  "PHONE",
  "TEMPLATE",
] as const;

function formatCurrency(value: number) {
  return `KES ${Number(value || 0).toLocaleString("en-KE")}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-KE");
}

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default function AdminQuotationCenterPage() {
  const [requests, setRequests] = useState<AdminQuote[]>([]);
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("ALL");
  const [source, setSource] = useState<(typeof SOURCE_OPTIONS)[number]>("ALL");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("status", status);
      params.set("source", source);
      if (query.trim()) params.set("q", query.trim());
      const response = await fetch(`/api/admin/quotation-center?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to load quotation center.");
      }
      setRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load quotation center.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, source]);

  const summary = useMemo(() => {
    const totalValue = requests.reduce((sum, request) => {
      const total = Number(request.quotationData?.total || 0);
      return sum + (Number.isFinite(total) ? total : 0);
    }, 0);
    return {
      total: requests.length,
      pendingApproval: requests.filter((request) => request.status === "PENDING_APPROVAL").length,
      sent: requests.filter((request) => request.status === "SENT").length,
      converted: requests.filter((request) => request.status === "CONVERTED").length,
      totalValue,
    };
  }, [requests]);

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-slate-100 lg:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.95),rgba(2,6,23,.95))] p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Admin Quotation Center
              </div>
              <h1 className="mt-2 text-3xl font-semibold text-white">Company-wide quotations monitor</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                View all quotation drafts, approvals, sent quotations, accepted deals, template-driven quotations, and follow-up pressure from one admin desk.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/marketing/receipts?tab=quotations" className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-100 transition hover:border-cyan-400">
                Staff quotations desk
              </Link>
              <Link href="/admin/receipts" className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/20">
                Receipts
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Total quotations" value={String(summary.total)} />
          <StatCard label="Pending approval" value={String(summary.pendingApproval)} />
          <StatCard label="Sent" value={String(summary.sent)} />
          <StatCard label="Converted" value={String(summary.converted)} />
          <StatCard label="Total value" value={formatCurrency(summary.totalValue)} />
        </section>

        <section className="rounded-[24px] border border-white/10 bg-slate-900/80 p-4">
          <div className="grid gap-3 lg:grid-cols-[220px_220px_minmax(0,1fr)_auto]">
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as (typeof STATUS_OPTIONS)[number])}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 outline-none"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {statusLabel(option)}
                </option>
              ))}
            </select>
            <select
              value={source}
              onChange={(event) => setSource(event.target.value as (typeof SOURCE_OPTIONS)[number])}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 outline-none"
            >
              {SOURCE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {statusLabel(option)}
                </option>
              ))}
            </select>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search customer, quote ref, title, template..."
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 outline-none"
            />
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-400"
            >
              Refresh
            </button>
          </div>
          {error ? (
            <div className="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
        </section>

        <section className="rounded-[24px] border border-white/10 bg-slate-900/80 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-sm text-slate-300">All quotations</div>
            {loading ? <div className="text-xs text-slate-500">Loading...</div> : null}
          </div>
          <div className="space-y-3">
            {requests.length ? (
              requests.map((request) => {
                const total = Number(request.quotationData?.total || 0);
                return (
                  <div key={request.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-lg font-semibold text-white">{request.customerName}</div>
                          <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                            {statusLabel(request.source)}
                          </span>
                          {request.requiresApproval ? (
                            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100">
                              Approval required
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-sm text-slate-400">
                          {request.quoteRef} · {request.customerPhone} · {request.assignedAttendant?.name || "Unassigned"}
                        </div>
                        <div className="mt-2 text-sm text-slate-200">
                          {request.quoteTitle || request.templateName || "Untitled quotation"}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Updated {formatDateTime(request.updatedAt)}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                          {statusLabel(request.status)}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-200">
                          {formatCurrency(total)}
                        </span>
                        <Link
                          href={`/marketing/receipts?tab=quotations&quoteId=${encodeURIComponent(request.id)}`}
                          className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/20"
                        >
                          Open
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-sm text-slate-500">
                No quotations found for the current filters.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-slate-900/80 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}
