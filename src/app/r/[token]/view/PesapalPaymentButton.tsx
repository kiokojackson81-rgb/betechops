"use client";

import { useState } from "react";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { receiptMoney } from "@/lib/customerReceiptPresentation";
import PesapalAcceptedPaymentMethods from "./PesapalAcceptedPaymentMethods";

export default function PesapalPaymentButton({ token, balance }: { token: string; balance: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function start() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/public/receipts/${encodeURIComponent(token)}/pesapal`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: Math.round(balance) }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok || !data.redirectUrl) throw new Error(data.error || "Pesapal checkout is not available right now.");
      window.location.assign(data.redirectUrl);
    } catch (cause) {
      setBusy(false);
      setError(cause instanceof Error ? cause.message : "Unable to open Pesapal checkout.");
    }
  }
  return <section aria-labelledby="pesapal-payment-heading" className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50 p-5 sm:p-6">
    <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-700 text-white"><ShieldCheck aria-hidden="true" /></span><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-800">Secure web payment</p><h2 id="pesapal-payment-heading" className="mt-1 text-xl font-bold text-slate-900">Pay with Pesapal</h2><p className="mt-1 text-sm leading-6 text-slate-700">Outstanding balance: <strong>{receiptMoney(balance)}</strong>. Use card, bank, or another payment method available in Pesapal&apos;s secure checkout.</p></div></div>
    <PesapalAcceptedPaymentMethods />
    <button type="button" disabled={busy} onClick={() => void start()} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-indigo-700 px-4 text-sm font-bold text-white transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50">{busy ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : <CreditCard size={18} aria-hidden="true" />}{busy ? "Opening secure checkout…" : `Pay ${receiptMoney(balance)} with Pesapal`}</button>
    {error ? <p role="status" className="mt-3 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-950">{error}</p> : null}
  </section>;
}
