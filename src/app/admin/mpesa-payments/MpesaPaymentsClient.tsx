"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED" | "UNMATCHED";
type Payment = {
  id: string;
  channel: "STK" | "C2B";
  status: PaymentStatus;
  accountReference: string | null;
  requestedAmount: number | null;
  amount: number | null;
  phoneNumber: string | null;
  receiptNumber: string | null;
  transactionId: string | null;
  resultDescription: string | null;
  transactionAt: string | null;
  createdAt: string;
  order: { kind: "ORDER" | "WEBSITE_ORDER"; id: string; reference: string; total: number; paid: number; paymentStatus: string } | null;
};
type Candidate = { kind: "ORDER" | "WEBSITE_ORDER"; id: string; reference: string; customerName: string; customerPhone: string | null; total: number; paid: number };
type Summary = { totalReceived: number; successfulCount: number; unmatchedAmount: number; unmatchedCount: number };

const money = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short" });

function formatDate(value: string | null) {
  return value ? dateTime.format(new Date(value)) : "—";
}

function statusClass(status: PaymentStatus) {
  if (status === "SUCCESS") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (status === "UNMATCHED") return "border-amber-400/30 bg-amber-400/10 text-amber-100";
  if (status === "PENDING") return "border-sky-400/30 bg-sky-400/10 text-sky-100";
  return "border-rose-400/30 bg-rose-400/10 text-rose-100";
}

export default function MpesaPaymentsClient() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filters, setFilters] = useState({ q: "", accountReference: "", phoneNumber: "", status: "ALL", channel: "ALL", from: "", to: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [candidateQuery, setCandidateQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  const loadPayments = useCallback(async (nextFilters = filters) => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    Object.entries(nextFilters).forEach(([key, value]) => { if (value && value !== "ALL") params.set(key, value); });
    try {
      const response = await fetch(`/api/admin/mpesa-payments?${params.toString()}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error || "Unable to load M-Pesa payments");
      setPayments(body.payments);
      setSummary(body.summary);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load M-Pesa payments");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { void loadPayments(); }, [loadPayments]);

  const loadCandidates = useCallback(async (payment: Payment, query = candidateQuery) => {
    setError("");
    setSelectedCandidate(null);
    setConfirmed(false);
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    try {
      const response = await fetch(`/api/admin/mpesa-payments/${payment.id}/candidates?${params.toString()}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error || "Unable to search orders");
      setCandidates(body.candidates);
    } catch (candidateError) {
      setCandidates([]);
      setError(candidateError instanceof Error ? candidateError.message : "Unable to search orders");
    }
  }, [candidateQuery]);

  const selectForReconciliation = (payment: Payment) => {
    setSelectedPayment(payment);
    const initialQuery = payment.accountReference || "";
    setCandidateQuery(initialQuery);
    setCandidates([]);
    void loadCandidates(payment, initialQuery);
  };

  const selectedPreview = useMemo(() => {
    if (!selectedPayment || !selectedCandidate) return null;
    const amount = selectedPayment.amount ?? selectedPayment.requestedAmount ?? 0;
    const resultingPaid = Math.min(selectedCandidate.total, selectedCandidate.paid + amount);
    return { amount, resultingPaid, balance: Math.max(0, selectedCandidate.total - resultingPaid) };
  }, [selectedCandidate, selectedPayment]);

  async function reconcile() {
    if (!selectedPayment || !selectedCandidate || !confirmed) return;
    setReconciling(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/mpesa-payments/${selectedPayment.id}/reconcile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetKind: selectedCandidate.kind, targetId: selectedCandidate.id, confirm: true }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error || "Unable to reconcile payment");
      setSelectedPayment(null);
      setCandidates([]);
      setSelectedCandidate(null);
      setConfirmed(false);
      await loadPayments();
    } catch (reconcileError) {
      setError(reconcileError instanceof Error ? reconcileError.message : "Unable to reconcile payment");
    } finally {
      setReconciling(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Finance operations</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">M-Pesa Payments</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">Review Daraja STK and Paybill transactions. Unmatched Paybill receipts can be linked once to the correct existing order.</p>
          </div>
          <button onClick={() => void loadPayments()} className="rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2 text-sm font-semibold hover:bg-white/10" type="button">Refresh</button>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"><p className="text-xs uppercase tracking-wide text-slate-400">Received (successful)</p><p className="mt-2 text-2xl font-semibold">{summary ? money.format(summary.totalReceived) : "—"}</p><p className="mt-1 text-sm text-slate-400">{summary?.successfulCount ?? 0} confirmed payments</p></div>
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4"><p className="text-xs uppercase tracking-wide text-amber-100/80">Needs reconciliation</p><p className="mt-2 text-2xl font-semibold text-amber-50">{summary ? money.format(summary.unmatchedAmount) : "—"}</p><p className="mt-1 text-sm text-amber-100/70">{summary?.unmatchedCount ?? 0} unmatched receipts</p></div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"><p className="text-xs uppercase tracking-wide text-slate-400">Ledger records</p><p className="mt-2 text-2xl font-semibold">{loading ? "…" : payments.length}</p><p className="mt-1 text-sm text-slate-400">Up to 250 matching records shown</p></div>
        </section>

        <form onSubmit={(event: FormEvent) => { event.preventDefault(); void loadPayments(); }} className="grid gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4 md:grid-cols-4 xl:grid-cols-7">
          <input value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="Receipt / transaction ID" className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm" />
          <input value={filters.accountReference} onChange={(event) => setFilters({ ...filters, accountReference: event.target.value })} placeholder="Account / BillRef" className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm" />
          <input value={filters.phoneNumber} onChange={(event) => setFilters({ ...filters, phoneNumber: event.target.value })} placeholder="Phone number" className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm" />
          <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm"><option value="ALL">All statuses</option>{(["PENDING", "SUCCESS", "FAILED", "CANCELLED", "UNMATCHED"] as const).map((status) => <option key={status}>{status}</option>)}</select>
          <select value={filters.channel} onChange={(event) => setFilters({ ...filters, channel: event.target.value })} className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm"><option value="ALL">All channels</option><option value="C2B">C2B</option><option value="STK">STK</option></select>
          <input type="date" aria-label="From date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm" />
          <div className="flex gap-2"><input type="date" aria-label="To date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm" /><button className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400" type="submit">Search</button></div>
        </form>

        {error ? <div role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
        <section className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60">
          <table className="min-w-[1200px] w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400"><tr><th className="p-3">Receipt / transaction</th><th className="p-3">Date</th><th className="p-3">Channel</th><th className="p-3">Phone</th><th className="p-3">Account reference</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Linked order</th><th className="p-3">Result</th><th className="p-3">Action</th></tr></thead>
            <tbody>{payments.map((payment) => <tr key={payment.id} className="border-b border-white/5 align-top hover:bg-white/[0.025]"><td className="p-3 font-mono text-xs text-slate-200">{payment.receiptNumber || payment.transactionId || "—"}<div className="mt-1 font-sans text-[11px] text-slate-500">Created {formatDate(payment.createdAt)}</div></td><td className="p-3 whitespace-nowrap">{formatDate(payment.transactionAt)}</td><td className="p-3">{payment.channel}</td><td className="p-3 font-mono text-xs">{payment.phoneNumber || "—"}</td><td className="p-3">{payment.accountReference || "—"}</td><td className="p-3 whitespace-nowrap font-semibold">{money.format(payment.amount ?? payment.requestedAmount ?? 0)}</td><td className="p-3"><span className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusClass(payment.status)}`}>{payment.status}</span></td><td className="p-3">{payment.order ? <><div className="font-medium">{payment.order.reference}</div><div className="text-xs text-slate-400">{payment.order.kind === "ORDER" ? "POS order" : "Website order"} · {money.format(payment.order.paid)} / {money.format(payment.order.total)}</div></> : "—"}</td><td className="max-w-[220px] p-3 text-xs text-slate-300">{payment.resultDescription || "—"}</td><td className="p-3">{payment.status === "UNMATCHED" && payment.channel === "C2B" ? <button type="button" onClick={() => selectForReconciliation(payment)} className="rounded-lg border border-amber-300/40 bg-amber-300/10 px-3 py-1.5 text-xs font-bold text-amber-100 hover:bg-amber-300/20">Reconcile</button> : "—"}</td></tr>)}{!loading && !payments.length ? <tr><td colSpan={10} className="p-8 text-center text-slate-400">No matching M-Pesa payments.</td></tr> : null}</tbody>
          </table>
        </section>

        {selectedPayment ? <section className="rounded-2xl border border-amber-300/30 bg-slate-900 p-5 shadow-2xl"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">Reconcile unmatched C2B payment</h2><p className="mt-1 text-sm text-slate-300">Receipt <span className="font-mono">{selectedPayment.receiptNumber || selectedPayment.transactionId || selectedPayment.id}</span> · {money.format(selectedPayment.amount ?? selectedPayment.requestedAmount ?? 0)} · Account {selectedPayment.accountReference || "—"}</p></div><button type="button" onClick={() => { setSelectedPayment(null); setCandidates([]); setSelectedCandidate(null); }} className="text-sm text-slate-300 hover:text-white">Close</button></div><div className="mt-5 flex gap-2"><input value={candidateQuery} onChange={(event) => setCandidateQuery(event.target.value)} placeholder="Search order number, website order, customer" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm" /><button type="button" onClick={() => void loadCandidates(selectedPayment)} className="rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold hover:bg-white/10">Find orders</button></div><div className="mt-3 grid gap-2 md:grid-cols-2">{candidates.map((candidate) => <button type="button" key={`${candidate.kind}:${candidate.id}`} onClick={() => { setSelectedCandidate(candidate); setConfirmed(false); }} className={`rounded-xl border p-3 text-left ${selectedCandidate?.id === candidate.id && selectedCandidate.kind === candidate.kind ? "border-emerald-400 bg-emerald-400/10" : "border-white/10 bg-slate-950/60 hover:border-white/25"}`}><div className="flex justify-between gap-2"><span className="font-semibold">{candidate.reference}</span><span className="text-xs text-slate-400">{candidate.kind === "ORDER" ? "POS" : "Website"}</span></div><div className="mt-1 text-sm text-slate-300">{candidate.customerName} · {candidate.customerPhone || "No phone"}</div><div className="mt-2 text-xs text-slate-400">Paid {money.format(candidate.paid)} of {money.format(candidate.total)}</div></button>)}</div>{selectedPreview && selectedCandidate ? <div className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-400/[0.07] p-4"><h3 className="font-semibold text-emerald-100">Confirm accounting effect</h3><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-4"><div><dt className="text-slate-400">Payment amount</dt><dd>{money.format(selectedPreview.amount)}</dd></div><div><dt className="text-slate-400">Selected order</dt><dd>{selectedCandidate.reference}</dd></div><div><dt className="text-slate-400">Current paid</dt><dd>{money.format(selectedCandidate.paid)}</dd></div><div><dt className="text-slate-400">Resulting balance</dt><dd>{money.format(selectedPreview.balance)}</dd></div></dl><label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-slate-200"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" />I confirm this original M-Pesa receipt belongs to the selected order and should be applied once.</label><button type="button" disabled={!confirmed || reconciling} onClick={() => void reconcile()} className="mt-4 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">{reconciling ? "Reconciling…" : "Apply and reconcile payment"}</button></div> : null}</section> : null}
      </div>
    </main>
  );
}
