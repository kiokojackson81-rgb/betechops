"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Eye } from "lucide-react";
import { buildAdminCustomerProfileHref } from "@/lib/adminCustomerProfileLinks";

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

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-sm font-medium text-slate-100">{value}</div>
    </div>
  );
}

export default function AgentCommissionsAdminClient({ rows }: { rows: CommissionRow[] }) {
  const router = useRouter();
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const allSelected = rows.length > 0 && selectedIds.length === rows.length;
  const selectedRows = useMemo(() => rows.filter((row) => selectedIds.includes(row.id)), [rows, selectedIds]);

  function toggleExpanded(id: string) {
    setExpandedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? [] : rows.map((row) => row.id));
  }

  async function deleteRow(row: CommissionRow) {
    const target = row.kind === "locked" && row.saleId ? `/api/admin/agents/sales/${row.saleId}` : `/api/admin/agents/commissions/${row.id.replace(/^commission:/, "")}`;
    const confirmed = window.confirm(
      row.kind === "locked"
        ? `Delete the locked commission row for ${row.customerName}? This removes the underlying sale and any linked commission records.`
        : `Delete the commission row for ${row.customerName}?`,
    );
    if (!confirmed) return;

    setBusyId(`${row.id}:delete`);
    const res = await fetch(target, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({ error: "Unable to delete commission row." }));
      window.alert(payload.error || "Unable to delete commission row.");
      return;
    }
    setSelectedIds((current) => current.filter((id) => id !== row.id));
    setExpandedIds((current) => current.filter((id) => id !== row.id));
    startTransition(() => router.refresh());
  }

  if (!rows.length) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-8 text-slate-300">
        <div className="text-lg font-semibold text-white">No commissions found.</div>
        <div className="mt-2 text-sm text-slate-400">Try changing your queue or search filters.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {selectedIds.length ? (
        <div className="sticky top-4 z-20 flex items-center justify-between gap-3 rounded-[24px] border border-cyan-400/20 bg-slate-950/95 px-5 py-4 backdrop-blur">
          <div className="text-sm text-slate-200">
            {selectedRows.length} commission row{selectedRows.length === 1 ? "" : "s"} selected
          </div>
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Bulk actions ready for next phase</div>
        </div>
      ) : null}

      <div className="hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.96))] lg:block">
        <div className="sticky top-0 z-10 grid grid-cols-[56px_56px_minmax(230px,1.4fr)_170px_170px_150px_150px_120px_160px] items-center gap-3 border-b border-white/10 bg-slate-950/95 px-4 py-4 text-[11px] uppercase tracking-[0.18em] text-slate-500 backdrop-blur">
          <div className="flex justify-center">
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
          </div>
          <div />
          <div className="whitespace-nowrap">Commission</div>
          <div className="whitespace-nowrap">Agent</div>
          <div className="whitespace-nowrap">Customer</div>
          <div className="whitespace-nowrap">Sale Value</div>
          <div className="whitespace-nowrap">Commission</div>
          <div className="whitespace-nowrap">Risk</div>
          <div className="whitespace-nowrap">Quick Action</div>
        </div>

        <div className="divide-y divide-white/5">
          {rows.map((row) => {
            const expanded = expandedIds.includes(row.id);
            const customerHref = buildAdminCustomerProfileHref({
              phone: row.customerPhone,
              displayName: row.customerName,
            });
            return (
              <div key={row.id} className="transition hover:bg-white/[0.02]">
                <div className="grid grid-cols-[56px_56px_minmax(230px,1.4fr)_170px_170px_150px_150px_120px_160px] items-center gap-3 px-4 py-4">
                  <div className="flex justify-center">
                    <input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleSelected(row.id)} />
                  </div>
                  <div>
                    <button onClick={() => toggleExpanded(row.id)} className="rounded-xl border border-white/10 p-2 text-slate-200 transition hover:border-white/20">
                      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${queueBadge(row.queue)}`}>
                        {row.queue.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="mt-2 truncate whitespace-nowrap font-semibold text-white">{row.productName}</div>
                    <div className="truncate whitespace-nowrap text-xs text-slate-500">{row.receiptNumber || "No receipt linked"}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate whitespace-nowrap font-semibold text-white">{row.agentName}</div>
                    <div className="truncate whitespace-nowrap text-xs text-slate-500">{row.referralCode}</div>
                  </div>
                  <div className="min-w-0">
                    <Link href={customerHref} className="truncate whitespace-nowrap font-medium text-slate-100 transition hover:text-cyan-200">
                      {row.customerName}
                    </Link>
                    <div className="truncate whitespace-nowrap text-xs text-slate-500">{row.customerPhone || "No phone"}</div>
                  </div>
                  <div className="whitespace-nowrap text-slate-100">{money(row.saleAmount)}</div>
                  <div className="whitespace-nowrap text-amber-200">{money(row.commissionAmount)}</div>
                  <div>
                    <span className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${riskBadge(row.riskLevel)}`}>
                      {row.riskLevel}
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
                      <InfoCard label="Queue status" value={row.queue.replace(/_/g, " ")} />
                      <InfoCard label="Created" value={new Date(row.createdAt).toLocaleString()} />
                      <InfoCard label="Sale value" value={money(row.saleAmount)} />
                      <InfoCard label="Commission" value={money(row.commissionAmount)} />
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-2">
                      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                        <div className="text-sm font-semibold text-white">Details</div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <InfoCard label="Agent" value={row.agentName} />
                          <InfoCard label="Phone" value={row.phone || "Not set"} />
                          <InfoCard label="County" value={row.county || "Not set"} />
                          <InfoCard label="Customer" value={row.customerName} />
                          <InfoCard label="Customer phone" value={row.customerPhone || "Not set"} />
                          <InfoCard label="Product" value={row.productName} />
                        </div>
                      </div>
                      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                        <div className="text-sm font-semibold text-white">Commission handling</div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <InfoCard label="Receipt / order" value={row.receiptNumber || "Not linked"} />
                          <InfoCard label="Risk level" value={row.riskLevel} />
                          <InfoCard label="Lock / queue note" value={row.note} />
                          <InfoCard label="Withdrawal eligibility" value={row.queue === "available" ? "Available" : "Not yet available"} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link href={customerHref} className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100">
                        Open customer
                      </Link>
                      {row.saleId ? (
                        <Link href={`/admin/agents/sales/${row.saleId}`} className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100">
                          Open Sale
                        </Link>
                      ) : null}
                      <button className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200">Approve Commission</button>
                      <button className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200">Hold</button>
                      <button className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200">Flag</button>
                      <button
                        onClick={() => deleteRow(row)}
                        disabled={busyId !== null}
                        className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-100 disabled:opacity-60"
                      >
                        {busyId === `${row.id}:delete` ? "Deleting..." : row.kind === "locked" ? "Delete Sale" : "Delete Commission"}
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
          const customerHref = buildAdminCustomerProfileHref({
            phone: row.customerPhone,
            displayName: row.customerName,
          });
          return (
            <article key={row.id} className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.94),rgba(2,6,23,.98))] p-5 text-slate-200 shadow-[0_18px_45px_rgba(0,0,0,0.28)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-lg font-semibold text-white">{row.productName}</div>
                  <div className="mt-1 truncate text-sm text-slate-400">{row.agentName} · </div>
                  <Link href={customerHref} className="truncate text-sm text-cyan-200 transition hover:text-cyan-100">
                    {row.customerName}
                  </Link>
                </div>
                <button onClick={() => toggleExpanded(row.id)} className="rounded-xl border border-white/10 p-2 text-slate-200">
                  {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <InfoCard label="Queue" value={row.queue.replace(/_/g, " ")} />
                <InfoCard label="Commission" value={money(row.commissionAmount)} />
              </div>
              {expanded ? (
                <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                  <InfoCard label="Sale value" value={money(row.saleAmount)} />
                  <InfoCard label="Note" value={row.note} />
                  <Link href={customerHref} className="inline-flex rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100">
                    Open customer
                  </Link>
                  <button
                    onClick={() => deleteRow(row)}
                    disabled={busyId !== null}
                    className="inline-flex rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-100 disabled:opacity-60"
                  >
                    {busyId === `${row.id}:delete` ? "Deleting..." : row.kind === "locked" ? "Delete Sale" : "Delete Commission"}
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
