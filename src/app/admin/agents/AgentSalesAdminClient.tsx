"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Download, Eye, ShieldAlert } from "lucide-react";
import { buildAdminCustomerProfileHref } from "@/lib/adminCustomerProfileLinks";

type AdminSaleRow = {
  id: string;
  agentId: string;
  agentName: string;
  assignedProcessorId?: string | null;
  assignedProcessorName?: string | null;
  assignedProcessorEmail?: string | null;
  assignedAt?: string | null;
  customerName: string;
  customerPhone: string;
  customerLocation: string;
  customerCounty?: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  paymentType: string;
  mpesaReference: string | null;
  deliveryMethod: string | null;
  status: string;
  statusMeta: { label: string; note: string };
  commissionAmount: number;
  commissionBadge: string;
  receiptId: string | null;
  receiptNumber: string | null;
  duplicateRisk: "low" | "medium" | "high";
  duplicateCount: number;
  needsReview: boolean;
  ownershipOwnerAgentName: string | null;
  ownershipWindowEndsAt: string | null;
  duplicateNote: string;
  createdAt: string;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(value || 0);

function stageBadge(status: string) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "completed") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  if (normalized === "cancelled" || normalized === "rejected") return "border-rose-400/20 bg-rose-400/10 text-rose-200";
  if (normalized === "delivered_pending_balance") return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  if (normalized === "processing" || normalized === "dispatched") return "border-teal-400/20 bg-teal-400/10 text-teal-200";
  return "border-sky-400/20 bg-sky-400/10 text-sky-200";
}

function duplicateBadge(level: AdminSaleRow["duplicateRisk"]) {
  if (level === "high") return "border-rose-400/20 bg-rose-400/10 text-rose-200";
  if (level === "medium") return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
}

function paymentLabel(paymentType: string) {
  return paymentType.replace(/_/g, " ");
}

function timelineState(status: string, step: string) {
  const order = [
    "pending_review",
    "processing",
    "dispatched",
    "delivered_pending_balance",
    "completed",
  ];
  const currentIndex = order.indexOf(status);
  const stepIndex = order.indexOf(step);
  return currentIndex >= stepIndex;
}

const timelineSteps = [
  { key: "pending_review", label: "Submitted" },
  { key: "processing", label: "Processing" },
  { key: "dispatched", label: "Dispatched" },
  { key: "delivered_pending_balance", label: "Delivered" },
  { key: "completed", label: "Completed" },
] as const;

function isTerminalStatus(status: string) {
  const normalized = String(status || "").toLowerCase();
  return normalized === "completed" || normalized === "cancelled" || normalized === "rejected";
}

function canMoveTo(status: string, nextStatus: string) {
  const current = String(status || "").toLowerCase();
  const next = String(nextStatus || "").toLowerCase();
  if (current === next || isTerminalStatus(current)) return false;
  if (current === "pending_review" || current === "awaiting_payment" || current === "payment_confirmed") {
    return ["processing", "rejected", "cancelled"].includes(next);
  }
  if (current === "processing") {
    return ["dispatched", "rejected", "cancelled"].includes(next);
  }
  if (current === "dispatched") {
    return ["delivered_pending_balance", "rejected", "cancelled"].includes(next);
  }
  if (current === "delivered_pending_balance") {
    return ["rejected", "cancelled"].includes(next);
  }
  return false;
}

export default function AgentSalesAdminClient({ sales }: { sales: AdminSaleRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [, startTransition] = useTransition();

  const allSelected = sales.length > 0 && selectedIds.length === sales.length;

  const selectedCountLabel = `${selectedIds.length} sale${selectedIds.length === 1 ? "" : "s"} selected`;

  async function patchStatus(
    saleId: string,
    status: string,
    extras?: { amountPaid?: number; mpesaReference?: string },
    busyKey?: string,
  ) {
    const nextBusyKey = busyKey || `${saleId}:${status}`;
    setBusy(nextBusyKey);
    const res = await fetch(`/api/admin/agents/sales/${saleId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...extras }),
    });
    setBusy(null);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({ error: "Unable to update sale status." }));
      window.alert(payload.error || "Unable to update sale status.");
      return;
    }
    startTransition(() => router.refresh());
  }

  async function confirmPayment(sale: AdminSaleRow) {
    const paidInput = window.prompt("Enter total amount paid by the customer", String(sale.totalAmount || sale.amountPaid || 0));
    if (paidInput === null) return;
    const amountPaid = Number(paidInput);
    if (!Number.isFinite(amountPaid) || amountPaid < 0) {
      window.alert("Enter a valid paid amount.");
      return;
    }
    const mpesaReference = window.prompt("Enter M-Pesa reference if available", sale.mpesaReference || "") ?? "";
    await patchStatus(sale.id, sale.status, { amountPaid, mpesaReference }, `${sale.id}:payment`);
  }

  async function completeSale(saleId: string) {
    setBusy(`${saleId}:complete`);
    const res = await fetch(`/api/admin/agents/sales/${saleId}/complete`, { method: "POST" });
    setBusy(null);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({ error: "Unable to complete sale." }));
      window.alert(payload.error || "Unable to complete sale.");
      return;
    }
    startTransition(() => router.refresh());
  }

  async function bulkStage(status: "processing" | "dispatched" | "delivered_pending_balance") {
    if (!selectedIds.length) return;
    const eligibleSales = selectedSales.filter((sale) => canMoveTo(sale.status, status));
    if (!eligibleSales.length) {
      window.alert("None of the selected sales can move to that stage.");
      return;
    }
    setBusy(`bulk:${status}`);
    for (const saleId of eligibleSales.map((sale) => sale.id)) {
      const res = await fetch(`/api/admin/agents/sales/${saleId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        setBusy(null);
        const payload = await res.json().catch(() => ({ error: "Unable to update selected sales." }));
        window.alert(payload.error || "Unable to update selected sales.");
        return;
      }
    }
    setBusy(null);
    setSelectedIds((current) => current.filter((id) => !eligibleSales.some((sale) => sale.id === id)));
    startTransition(() => router.refresh());
  }

  function toggleSelected(saleId: string) {
    setSelectedIds((current) =>
      current.includes(saleId) ? current.filter((id) => id !== saleId) : [...current, saleId],
    );
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(sales.map((sale) => sale.id));
  }

  function toggleExpanded(saleId: string) {
    setExpandedIds((current) =>
      current.includes(saleId) ? current.filter((id) => id !== saleId) : [...current, saleId],
    );
  }

  function downloadCsv() {
    const rows = [
      [
        "Customer",
        "Phone",
        "Product",
        "Agent",
        "County",
        "Payment Option",
        "Amount Paid",
        "Balance",
        "Order Value",
        "Commission",
        "Stage",
        "Submitted",
      ],
      ...sales.map((sale) => [
        sale.customerName,
        sale.customerPhone,
        sale.productName,
        sale.agentName,
        sale.customerCounty || sale.customerLocation,
        paymentLabel(sale.paymentType),
        String(sale.amountPaid),
        String(sale.balance),
        String(sale.totalAmount),
        String(sale.commissionAmount),
        sale.statusMeta.label,
        sale.createdAt,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `agent-sales-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function quickAction(sale: AdminSaleRow) {
    if (isTerminalStatus(sale.status)) {
      return {
        label: "View Details",
        onClick: () => toggleExpanded(sale.id),
        className: "border-white/10 text-slate-200 hover:border-white/20",
      };
    }
    if (sale.status === "pending_review" || sale.status === "awaiting_payment" || sale.status === "payment_confirmed") {
      return {
        label: busy === `${sale.id}:processing` ? "Saving..." : "Mark Processing",
        onClick: () => patchStatus(sale.id, "processing"),
        className: "border-white/10 text-slate-200 hover:border-white/20",
      };
    }
    if (sale.status === "processing") {
      return {
        label: busy === `${sale.id}:dispatched` ? "Saving..." : "Mark Dispatched",
        onClick: () => patchStatus(sale.id, "dispatched"),
        className: "border-cyan-400/20 bg-cyan-400/10 text-cyan-100",
      };
    }
    if (sale.status === "dispatched") {
      return {
        label: busy === `${sale.id}:delivered_pending_balance` ? "Saving..." : "Mark Delivered",
        onClick: () => patchStatus(sale.id, "delivered_pending_balance"),
        className: "border-amber-400/20 bg-amber-400/10 text-amber-100",
      };
    }
    if (sale.status === "delivered_pending_balance" && sale.balance <= 0) {
      return {
        label: busy === `${sale.id}:complete` ? "Saving..." : "Complete Sale",
        onClick: () => completeSale(sale.id),
        className: "bg-emerald-400 text-slate-950",
      };
    }
    return {
      label: sale.balance > 0 ? "Verify Payment" : "Complete Sale",
      onClick: () => (sale.balance > 0 ? confirmPayment(sale) : completeSale(sale.id)),
      className: sale.balance > 0 ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-100" : "bg-emerald-400 text-slate-950",
    };
  }

  const selectedSales = useMemo(
    () => sales.filter((sale) => selectedIds.includes(sale.id)),
    [sales, selectedIds],
  );

  if (!sales.length) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-8 text-slate-300">
        <div className="text-lg font-semibold text-white">No sales found.</div>
        <div className="mt-2 text-sm text-slate-400">Try changing your search or filters.</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.92),rgba(2,6,23,.94))] px-5 py-4 shadow-[0_20px_55px_rgba(0,0,0,0.28)]">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-medium">
            {sales.length} visible orders
          </div>
          {selectedIds.length ? (
            <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-emerald-100">
              {selectedCountLabel}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedIds.length ? (
            <>
              <button
                onClick={() => bulkStage("processing")}
                disabled={busy !== null}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-100 disabled:opacity-60"
              >
                {busy === "bulk:processing" ? "Saving..." : "Bulk Process"}
              </button>
              <button
                onClick={() => bulkStage("dispatched")}
                disabled={busy !== null}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-100 disabled:opacity-60"
              >
                {busy === "bulk:dispatched" ? "Saving..." : "Bulk Dispatch"}
              </button>
              <button
                onClick={() => bulkStage("delivered_pending_balance")}
                disabled={busy !== null}
                className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-xs font-semibold text-amber-100 disabled:opacity-60"
              >
                {busy === "bulk:delivered_pending_balance" ? "Saving..." : "Bulk Delivered"}
              </button>
            </>
          ) : null}
          <button
            onClick={downloadCsv}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-100"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.98))] shadow-[0_24px_70px_rgba(0,0,0,0.35)] lg:block">
        <div className="overflow-hidden">
          <table className="w-full table-fixed text-left text-sm text-slate-300">
            <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur">
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                <th className="w-10 px-3 py-4">
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                </th>
                <th className="w-12 px-2 py-4">Open</th>
                <th className="min-w-[220px] px-3 py-4 whitespace-nowrap">Customer Name</th>
                <th className="min-w-[220px] px-3 py-4 whitespace-nowrap">Product</th>
                <th className="min-w-[180px] px-3 py-4 whitespace-nowrap">Agent</th>
                <th className="w-[150px] px-3 py-4 whitespace-nowrap">Order Value</th>
                <th className="w-[150px] px-3 py-4 whitespace-nowrap">Stage</th>
                <th className="w-[150px] px-3 py-4 whitespace-nowrap">Commission</th>
                <th className="w-[150px] px-3 py-4 whitespace-nowrap">Date</th>
                <th className="w-[160px] px-3 py-4 whitespace-nowrap">Quick Action</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => {
                const expanded = expandedIds.includes(sale.id);
                const action = quickAction(sale);
                const customerHref = buildAdminCustomerProfileHref({
                  phone: sale.customerPhone,
                  displayName: sale.customerName,
                });
                return (
                  <Fragment key={sale.id}>
                    <tr className="border-b border-white/5 align-middle transition hover:bg-white/[0.025]">
                      <td className="px-3 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(sale.id)}
                          onChange={() => toggleSelected(sale.id)}
                        />
                      </td>
                      <td className="px-2 py-4">
                        <button
                          onClick={() => toggleExpanded(sale.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-200 transition hover:border-white/20"
                          aria-label={expanded ? "Collapse row" : "Expand row"}
                        >
                          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="px-3 py-4">
                        <div className="max-w-[220px]">
                          <Link href={customerHref} className="truncate font-semibold text-white transition hover:text-cyan-200">
                            {sale.customerName}
                          </Link>
                          <div className="mt-1 truncate text-xs text-slate-500">{sale.customerPhone}</div>
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <div className="max-w-[220px]">
                          <div className="truncate font-medium text-slate-100">{sale.productName}</div>
                          <div className="mt-1 truncate text-xs text-slate-500">{sale.quantity} item{sale.quantity === 1 ? "" : "s"}</div>
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <div className="max-w-[180px]">
                          <div className="truncate">{sale.agentName}</div>
                          <div className="mt-1 truncate text-xs text-slate-500">
                            {sale.assignedProcessorName || sale.assignedProcessorEmail || "Unassigned"}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4 font-semibold text-white whitespace-nowrap">{money(sale.totalAmount)}</td>
                      <td className="px-3 py-4">
                        <span className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${stageBadge(sale.status)}`}>
                          {sale.statusMeta.label}
                        </span>
                      </td>
                      <td className="px-3 py-4 font-semibold text-amber-200 whitespace-nowrap">{money(sale.commissionAmount)}</td>
                      <td className="px-3 py-4 text-slate-400 whitespace-nowrap">{new Date(sale.createdAt).toLocaleDateString()}</td>
                      <td className="px-3 py-4">
                        <button
                          onClick={action.onClick}
                          disabled={busy !== null}
                          className={`w-full rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:opacity-60 ${action.className}`}
                        >
                          {action.label}
                        </button>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="border-b border-white/5 bg-slate-950/60">
                        <td colSpan={10} className="px-5 py-5">
                          <div className="space-y-5">
                            <div className="grid gap-4 xl:grid-cols-4">
                              <section className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Customer Information</div>
                                <div className="mt-3">
                                  <Link href={customerHref} className="inline-flex rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-100">
                                    Open customer
                                  </Link>
                                </div>
                                <div className="mt-3 space-y-2 text-sm text-slate-300">
                                  <div><span className="text-slate-500">Full Name:</span> {sale.customerName}</div>
                                  <div><span className="text-slate-500">Phone:</span> {sale.customerPhone}</div>
                                  <div><span className="text-slate-500">County:</span> {sale.customerCounty || "Not set"}</div>
                                  <div><span className="text-slate-500">Town:</span> {sale.customerLocation}</div>
                                </div>
                              </section>

                              <section className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Product Information</div>
                                <div className="mt-3 space-y-2 text-sm text-slate-300">
                                  <div><span className="text-slate-500">Product:</span> {sale.productName}</div>
                                  <div><span className="text-slate-500">Quantity:</span> {sale.quantity}</div>
                                  <div><span className="text-slate-500">Unit Price:</span> {money(sale.unitPrice)}</div>
                                  <div><span className="text-slate-500">Total Amount:</span> {money(sale.totalAmount)}</div>
                                </div>
                              </section>

                              <section className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Payment Information</div>
                                <div className="mt-3 space-y-2 text-sm text-slate-300">
                                  <div><span className="text-slate-500">Payment Option:</span> {paymentLabel(sale.paymentType)}</div>
                                  <div><span className="text-slate-500">Amount Paid:</span> {money(sale.amountPaid)}</div>
                                  <div><span className="text-slate-500">Balance:</span> {money(sale.balance)}</div>
                                  <div><span className="text-slate-500">M-Pesa Reference:</span> {sale.mpesaReference || "Not captured"}</div>
                                </div>
                              </section>

                              <section className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Agent Information</div>
                                <div className="mt-3 space-y-2 text-sm text-slate-300">
                                  <div><span className="text-slate-500">Agent Name:</span> {sale.agentName}</div>
                                  <div>
                                    <span className="text-slate-500">Assigned Processor:</span>{" "}
                                    {sale.assignedProcessorName || sale.assignedProcessorEmail || "Unassigned"}
                                  </div>
                                  <div>
                                    <span className="text-slate-500">Assigned At:</span>{" "}
                                    {sale.assignedAt ? new Date(sale.assignedAt).toLocaleString("en-KE") : "Not assigned"}
                                  </div>
                                  <div><span className="text-slate-500">Commission:</span> {money(sale.commissionAmount)}</div>
                                  <div><span className="text-slate-500">Risk Status:</span> <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${duplicateBadge(sale.duplicateRisk)}`}>{sale.duplicateRisk}</span></div>
                                  <div><span className="text-slate-500">Receipt:</span> {sale.receiptNumber || "Not linked"}</div>
                                </div>
                              </section>
                            </div>

                            <section className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Timeline</div>
                                {sale.needsReview ? (
                                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100">
                                    <ShieldAlert className="h-3.5 w-3.5" />
                                    Needs review
                                  </div>
                                ) : null}
                              </div>
                              <div className="mt-4 grid gap-3 md:grid-cols-5">
                                {timelineSteps.map((step) => {
                                  const active = timelineState(sale.status, step.key);
                                  return (
                                    <div
                                      key={step.key}
                                      className={`rounded-2xl border p-3 text-sm ${
                                        active
                                          ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-100"
                                          : "border-white/10 bg-slate-950/60 text-slate-500"
                                      }`}
                                    >
                                      <div className="font-semibold">{step.label}</div>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="mt-4 text-sm text-slate-400">{sale.statusMeta.note}</div>
                              {sale.duplicateNote ? <div className="mt-2 text-sm text-slate-400">{sale.duplicateNote}</div> : null}
                              {sale.ownershipOwnerAgentName ? (
                                <div className="mt-2 text-sm text-slate-400">
                                  Lead owner: {sale.ownershipOwnerAgentName}
                                  {sale.ownershipWindowEndsAt ? ` · Window ends ${new Date(sale.ownershipWindowEndsAt).toLocaleString("en-KE")}` : ""}
                                </div>
                              ) : null}
                            </section>

                            <section className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Actions</div>
                              <div className="mt-4 flex flex-wrap gap-3">
                                <Link
                                  href={`/admin/agents/sales/${sale.id}`}
                                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-white/20"
                                >
                                  <Eye className="h-4 w-4" />
                                  View Details
                                </Link>
                                {!isTerminalStatus(sale.status) ? (
                                  <button
                                    onClick={() => confirmPayment(sale)}
                                    disabled={busy !== null}
                                    className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/20 disabled:opacity-60"
                                  >
                                    {busy === `${sale.id}:payment` ? "Saving..." : "Verify Payment"}
                                  </button>
                                ) : null}
                                {canMoveTo(sale.status, "processing") ? (
                                  <button
                                    onClick={() => patchStatus(sale.id, "processing")}
                                    disabled={busy !== null}
                                    className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/20 disabled:opacity-60"
                                  >
                                    {busy === `${sale.id}:processing` ? "Saving..." : "Mark Processing"}
                                  </button>
                                ) : null}
                                {canMoveTo(sale.status, "dispatched") ? (
                                  <button
                                    onClick={() => patchStatus(sale.id, "dispatched")}
                                    disabled={busy !== null}
                                    className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/20 disabled:opacity-60"
                                  >
                                    {busy === `${sale.id}:dispatched` ? "Saving..." : "Mark Dispatched"}
                                  </button>
                                ) : null}
                                {canMoveTo(sale.status, "delivered_pending_balance") ? (
                                  <button
                                    onClick={() => patchStatus(sale.id, "delivered_pending_balance")}
                                    disabled={busy !== null}
                                    className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-60"
                                  >
                                    {busy === `${sale.id}:delivered_pending_balance` ? "Saving..." : "Mark Delivered"}
                                  </button>
                                ) : null}
                                {sale.status === "delivered_pending_balance" && sale.balance <= 0 ? (
                                  <button
                                    onClick={() => completeSale(sale.id)}
                                    disabled={busy !== null}
                                    className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
                                  >
                                    {busy === `${sale.id}:complete` ? "Completing..." : "Complete Sale"}
                                  </button>
                                ) : null}
                                {canMoveTo(sale.status, "rejected") ? (
                                  <button
                                    onClick={() => patchStatus(sale.id, "rejected")}
                                    disabled={busy !== null}
                                    className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-100 disabled:opacity-60"
                                  >
                                    {busy === `${sale.id}:rejected` ? "Saving..." : "Reject Sale"}
                                  </button>
                                ) : null}
                              </div>
                            </section>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4 lg:hidden">
        {sales.map((sale) => {
          const expanded = expandedIds.includes(sale.id);
          const action = quickAction(sale);
          const customerHref = buildAdminCustomerProfileHref({
            phone: sale.customerPhone,
            displayName: sale.customerName,
          });
          return (
            <article
              key={sale.id}
              className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.98))] shadow-[0_18px_60px_rgba(0,0,0,0.28)]"
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selectedIds.includes(sale.id)}
                    onChange={() => toggleSelected(sale.id)}
                  />
                  <button
                    onClick={() => toggleExpanded(sale.id)}
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-200"
                  >
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={customerHref} className="truncate text-lg font-semibold text-white transition hover:text-cyan-200">
                          {sale.customerName}
                        </Link>
                        <div className="mt-1 truncate text-sm text-slate-400">{sale.productName}</div>
                      </div>
                      <span className={`inline-flex shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${stageBadge(sale.status)}`}>
                        {sale.statusMeta.label}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Agent</div>
                        <div className="mt-1 truncate text-slate-200">{sale.agentName}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Assigned Desk</div>
                        <div className="mt-1 truncate text-slate-200">
                          {sale.assignedProcessorName || sale.assignedProcessorEmail || "Unassigned"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Order Value</div>
                        <div className="mt-1 font-semibold text-white">{money(sale.totalAmount)}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Commission</div>
                        <div className="mt-1 font-semibold text-amber-200">{money(sale.commissionAmount)}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Date</div>
                        <div className="mt-1 text-slate-300">{new Date(sale.createdAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${duplicateBadge(sale.duplicateRisk)}`}>
                        {sale.duplicateRisk} risk
                      </span>
                      <button
                        onClick={action.onClick}
                        disabled={busy !== null}
                        className={`rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:opacity-60 ${action.className}`}
                      >
                        {action.label}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {expanded ? (
                <div className="border-t border-white/10 bg-slate-950/55 p-4">
                  <div className="space-y-4">
                    <div className="grid gap-4">
                      <section className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Customer Information</div>
                        <div className="mt-3">
                          <Link href={customerHref} className="inline-flex rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-100">
                            Open customer
                          </Link>
                        </div>
                        <div className="mt-3 space-y-2 text-sm text-slate-300">
                          <div>Full Name: {sale.customerName}</div>
                          <div>Phone: {sale.customerPhone}</div>
                          <div>County: {sale.customerCounty || "Not set"}</div>
                          <div>Town: {sale.customerLocation}</div>
                        </div>
                      </section>
                      <section className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Product Information</div>
                        <div className="mt-3 space-y-2 text-sm text-slate-300">
                          <div>Product: {sale.productName}</div>
                          <div>Quantity: {sale.quantity}</div>
                          <div>Unit Price: {money(sale.unitPrice)}</div>
                          <div>Total Amount: {money(sale.totalAmount)}</div>
                        </div>
                      </section>
                      <section className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Payment Information</div>
                        <div className="mt-3 space-y-2 text-sm text-slate-300">
                          <div>Payment Option: {paymentLabel(sale.paymentType)}</div>
                          <div>Amount Paid: {money(sale.amountPaid)}</div>
                          <div>Balance: {money(sale.balance)}</div>
                          <div>M-Pesa Reference: {sale.mpesaReference || "Not captured"}</div>
                        </div>
                      </section>
                      <section className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Agent Information</div>
                        <div className="mt-3 space-y-2 text-sm text-slate-300">
                          <div>Agent Name: {sale.agentName}</div>
                          <div>Assigned Processor: {sale.assignedProcessorName || sale.assignedProcessorEmail || "Unassigned"}</div>
                          <div>Assigned At: {sale.assignedAt ? new Date(sale.assignedAt).toLocaleString("en-KE") : "Not assigned"}</div>
                          <div>Commission: {money(sale.commissionAmount)}</div>
                          <div>Risk Status: {sale.duplicateRisk}</div>
                          <div>Receipt: {sale.receiptNumber || "Not linked"}</div>
                        </div>
                      </section>
                    </div>

                    <section className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Timeline</div>
                      <div className="mt-3 grid gap-2">
                        {timelineSteps.map((step) => {
                          const active = timelineState(sale.status, step.key);
                          return (
                            <div
                              key={step.key}
                              className={`rounded-2xl border px-3 py-2 text-sm ${
                                active
                                  ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-100"
                                  : "border-white/10 bg-slate-950/60 text-slate-500"
                              }`}
                            >
                              {step.label}
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    <section className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Actions</div>
                      <div className="mt-3 flex flex-col gap-2">
                        <Link
                          href={`/admin/agents/sales/${sale.id}`}
                          className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/20"
                        >
                          View Details
                        </Link>
                        {!isTerminalStatus(sale.status) ? (
                          <button
                            onClick={() => confirmPayment(sale)}
                            disabled={busy !== null}
                            className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/20 disabled:opacity-60"
                          >
                            {busy === `${sale.id}:payment` ? "Saving..." : "Verify Payment"}
                          </button>
                        ) : null}
                        {canMoveTo(sale.status, "processing") ? (
                          <button
                            onClick={() => patchStatus(sale.id, "processing")}
                            disabled={busy !== null}
                            className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/20 disabled:opacity-60"
                          >
                            {busy === `${sale.id}:processing` ? "Saving..." : "Mark Processing"}
                          </button>
                        ) : null}
                        {canMoveTo(sale.status, "dispatched") ? (
                          <button
                            onClick={() => patchStatus(sale.id, "dispatched")}
                            disabled={busy !== null}
                            className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/20 disabled:opacity-60"
                          >
                            {busy === `${sale.id}:dispatched` ? "Saving..." : "Mark Dispatched"}
                          </button>
                        ) : null}
                        {canMoveTo(sale.status, "delivered_pending_balance") ? (
                          <button
                            onClick={() => patchStatus(sale.id, "delivered_pending_balance")}
                            disabled={busy !== null}
                            className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100 disabled:opacity-60"
                          >
                            {busy === `${sale.id}:delivered_pending_balance` ? "Saving..." : "Mark Delivered"}
                          </button>
                        ) : null}
                        {sale.status === "delivered_pending_balance" && sale.balance <= 0 ? (
                          <button
                            onClick={() => completeSale(sale.id)}
                            disabled={busy !== null}
                            className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
                          >
                            {busy === `${sale.id}:complete` ? "Completing..." : "Complete Sale"}
                          </button>
                        ) : null}
                        {canMoveTo(sale.status, "rejected") ? (
                          <button
                            onClick={() => patchStatus(sale.id, "rejected")}
                            disabled={busy !== null}
                            className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-100 disabled:opacity-60"
                          >
                            {busy === `${sale.id}:rejected` ? "Saving..." : "Reject Sale"}
                          </button>
                        ) : null}
                      </div>
                    </section>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {selectedSales.length ? (
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-400">
          Bulk actions currently apply to the {selectedSales.length} selected sales shown in this queue.
        </div>
      ) : null}
    </div>
  );
}
