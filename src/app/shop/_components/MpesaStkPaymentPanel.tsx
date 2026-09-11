"use client";

import { useEffect, useRef, useState } from "react";

type ResourceType = "ORDER" | "SITE_VISIT" | "LPP";
type StkState = "READY" | "REQUESTING" | "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED" | "TIMEOUT";

function kes(value: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(value);
}

export default function MpesaStkPaymentPanel({
  resourceType, reference, amountDue, initialPhone, allowAmountChoice = false, onSuccess,
}: {
  resourceType: ResourceType;
  reference: string;
  amountDue: number;
  initialPhone?: string | null;
  allowAmountChoice?: boolean;
  onSuccess?: () => void;
}) {
  const [phoneNumber, setPhoneNumber] = useState(initialPhone || "");
  const [installmentAmount, setInstallmentAmount] = useState(String(Math.max(1, Math.round(amountDue))));
  const [state, setState] = useState<StkState>("READY");
  const [message, setMessage] = useState("");
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const started = useRef<number | null>(null);

  useEffect(() => {
    if (!checkoutRequestId || state !== "PENDING") return;
    let active = true;
    const poll = async () => {
      try {
        const response = await fetch(`/api/payments/mpesa/stk/status?checkoutRequestId=${encodeURIComponent(checkoutRequestId)}`, { cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        if (!active || !response.ok) return;
        const next = String(body.payment?.status || "PENDING") as StkState;
        if (["SUCCESS", "FAILED", "CANCELLED"].includes(next)) {
          setState(next);
          setMessage(body.payment?.resultDescription || (next === "SUCCESS" ? "Payment confirmed." : "The M-Pesa request was not completed."));
          if (next === "SUCCESS") onSuccess?.();
          return;
        }
        if (started.current && Date.now() - started.current > 3 * 60 * 1000) {
          setState("TIMEOUT");
          setMessage("We have not received a final result yet. You may retry only after checking your M-Pesa messages.");
        }
      } catch {
        // Temporary network loss must not change the accounting state.
      }
    };
    void poll();
    const id = window.setInterval(() => void poll(), 3500);
    return () => { active = false; window.clearInterval(id); };
  }, [checkoutRequestId, onSuccess, state]);

  async function requestStk() {
    setState("REQUESTING"); setMessage("");
    try {
      const response = await fetch("/api/payments/mpesa/stk", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceType, reference, phoneNumber, ...(allowAmountChoice ? { installmentAmount: Number(installmentAmount) } : {}) }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) throw new Error(body.error || "M-Pesa could not start the payment request.");
      setCheckoutRequestId(body.checkoutRequestId); started.current = Date.now(); setState("PENDING");
      setMessage(`M-Pesa request sent to ${phoneNumber.replace(/^\+/, "")}. Check your phone and enter your M-Pesa PIN.`);
    } catch (error) {
      setState("FAILED"); setMessage(error instanceof Error ? error.message : "M-Pesa could not start the payment request.");
    }
  }

  const disabled = state === "REQUESTING" || state === "PENDING" || amountDue < 1;
  return <section className="rounded-[22px] border border-[#7a0000]/15 bg-[#fffaf4] p-5">
    <div className="text-xs font-black uppercase tracking-[.16em] text-[#7a0000]">Secure M-Pesa payment</div>
    <h2 className="mt-2 text-xl font-black text-slate-950">Pay with M-Pesa</h2>
    <p className="mt-2 text-sm leading-6 text-slate-600">Reference: <strong>{reference}</strong>. The amount is verified by Betech before Safaricom receives the request.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-sm font-bold text-slate-700">Phone number<input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} inputMode="tel" placeholder="07XXXXXXXX" disabled={disabled} className="min-h-11 rounded-xl border border-[#7a0000]/15 bg-white px-3 font-normal" /></label>
      {allowAmountChoice ? <label className="grid gap-1 text-sm font-bold text-slate-700">Installment amount<input value={installmentAmount} onChange={(e) => setInstallmentAmount(e.target.value)} type="number" min={1} max={amountDue} disabled={disabled} className="min-h-11 rounded-xl border border-[#7a0000]/15 bg-white px-3 font-normal" /></label> : <div className="rounded-xl border border-[#7a0000]/10 bg-white px-4 py-2"><div className="text-xs font-bold text-slate-500">Amount due now</div><div className="text-lg font-black text-slate-950">{kes(amountDue)}</div></div>}
    </div>
    {allowAmountChoice ? <p className="mt-2 text-xs text-slate-600">Outstanding balance: {kes(amountDue)}. Betech validates the requested installment before sending a prompt.</p> : null}
    {message ? <div role="status" className={`mt-4 rounded-xl px-4 py-3 text-sm ${state === "SUCCESS" ? "bg-emerald-50 text-emerald-800" : state === "PENDING" ? "bg-sky-50 text-sky-800" : "bg-amber-50 text-amber-900"}`}>{message}</div> : null}
    <button type="button" onClick={() => void requestStk()} disabled={disabled} className="mt-4 min-h-11 rounded-xl bg-[#7a0000] px-5 text-sm font-black text-white disabled:opacity-50">{state === "REQUESTING" ? "Sending request…" : state === "PENDING" ? "Waiting for M-Pesa…" : state === "SUCCESS" ? "Payment confirmed" : state === "FAILED" || state === "CANCELLED" || state === "TIMEOUT" ? "Retry M-Pesa prompt" : "Send M-Pesa prompt"}</button>
    <p className="mt-3 text-xs text-slate-500">Never enter your M-Pesa PIN on this website. Enter it only in Safaricom’s prompt on your phone.</p>
  </section>;
}
