"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clipboard, Copy, Landmark, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { receiptMoney } from "@/lib/customerReceiptPresentation";

const MPESA_EXPRESS_LIMIT = 250_000;

function CopyValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }
  return <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
    <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-0.5 break-all font-mono text-base font-bold text-slate-900">{value}</p></div>
    <button type="button" onClick={() => void copy()} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-bold text-slate-700 transition hover:border-[#870000] hover:text-[#870000]" aria-label={`Copy ${label}`}>
      {copied ? <Check size={16} className="text-emerald-600" aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}{copied ? "Copied" : "Copy"}
    </button>
  </div>;
}

export default function ProjectPaymentOptions({ token, balance }: { token: string; balance: number }) {
  const maximum = Math.min(Math.max(0, Math.round(balance)), MPESA_EXPRESS_LIMIT);
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState(String(maximum));
  const [state, setState] = useState<"ready" | "sending" | "pending" | "success" | "failed">("ready");
  const [message, setMessage] = useState("");
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);

  const selectedAmount = useMemo(() => Math.max(0, Math.round(Number(amount))), [amount]);
  const balanceAfterThisPrompt = Math.max(0, balance - selectedAmount);

  useEffect(() => {
    if (!checkoutRequestId || state !== "pending") return;
    let active = true;
    const poll = async () => {
      try {
        const response = await fetch(`/api/payments/mpesa/stk/status?checkoutRequestId=${encodeURIComponent(checkoutRequestId)}`, { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!active || !response.ok) return;
        const next = String(data.payment?.status || "PENDING").toUpperCase();
        if (next === "SUCCESS") {
          setState("success");
          setMessage(`Payment received${data.payment?.receiptNumber ? ` — M-Pesa receipt: ${data.payment.receiptNumber}` : ""}. Your balance will refresh shortly.`);
          window.setTimeout(() => window.location.reload(), 1800);
        } else if (["FAILED", "CANCELLED"].includes(next)) {
          setState("failed");
          setMessage(data.payment?.resultDescription || "The M-Pesa request was not completed. You can try again.");
        }
      } catch {
        // Keep waiting: the callback and ledger remain authoritative.
      }
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 2000);
    return () => { active = false; window.clearInterval(interval); };
  }, [checkoutRequestId, state]);

  async function requestMpesaExpress() {
    setState("sending");
    setMessage("");
    try {
      const response = await fetch(`/api/public/receipts/${encodeURIComponent(token)}/project/mpesa-express`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone, amount: selectedAmount }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "Unable to send the M-Pesa Express prompt.");
      setCheckoutRequestId(data.checkoutRequestId);
      setState("pending");
      setMessage("An M-Pesa prompt has been sent. Check your phone and enter your PIN only in the Safaricom prompt.");
    } catch (error) {
      setState("failed");
      setMessage(error instanceof Error ? error.message : "Unable to send the M-Pesa Express prompt.");
    }
  }

  const busy = state === "sending" || state === "pending";
  return <section aria-labelledby="project-payment-heading" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
    <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white"><ShieldCheck aria-hidden="true" /></span><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-800">Secure payment options</p><h2 id="project-payment-heading" className="mt-1 text-xl font-bold text-slate-900">Pay your project balance</h2><p className="mt-1 text-sm leading-6 text-slate-700">Outstanding balance: <strong>{receiptMoney(balance)}</strong>. Choose the payment method that works best for you.</p></div></div>

    <div className="mt-5 grid gap-4">
      <section className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
        <div className="flex items-start gap-3"><Smartphone className="mt-0.5 text-emerald-700" aria-hidden="true" /><div><h3 className="font-bold text-emerald-950">M-Pesa Express</h3><p className="mt-1 text-sm leading-5 text-emerald-900">We send a secure payment prompt straight to your phone.</p></div></div>
        {balance > MPESA_EXPRESS_LIMIT ? <div className="mt-3 rounded-lg border border-emerald-200 bg-white/80 p-3 text-sm leading-5 text-emerald-950"><strong>Large-payment guide:</strong> M-Pesa Express accepts up to KSh 250,000 per prompt. Start with <strong>{receiptMoney(maximum)}</strong>, then pay the remaining <strong>{receiptMoney(balanceAfterThisPrompt)}</strong> in your next prompt. This keeps every payment within Safaricom’s per-prompt limit.</div> : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">M-Pesa number<input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="07XXXXXXXX" disabled={busy} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal text-slate-900 outline-none focus:border-emerald-600" /></label><label className="text-sm font-semibold text-slate-700">Amount for this prompt<input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="numeric" type="number" min={1} max={maximum} disabled={busy} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal text-slate-900 outline-none focus:border-emerald-600" /><span className="mt-1 block text-xs font-normal text-slate-600">Maximum per prompt: {receiptMoney(maximum)}</span></label></div>
        {message ? <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm ${state === "success" ? "bg-emerald-100 text-emerald-900" : state === "pending" ? "bg-sky-100 text-sky-900" : "bg-amber-100 text-amber-950"}`}>{message}</p> : null}
        <button type="button" disabled={busy || !phone.trim() || selectedAmount < 1 || selectedAmount > maximum} onClick={() => void requestMpesaExpress()} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">{state === "sending" ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : <Smartphone size={18} aria-hidden="true" />}{state === "pending" ? "Waiting for M-Pesa…" : state === "sending" ? "Sending prompt…" : `Pay ${receiptMoney(selectedAmount || 0)} with M-Pesa`}</button>
        <p className="mt-3 text-xs leading-5 text-slate-600">Never enter your M-Pesa PIN on this page. Enter it only on Safaricom’s prompt on your phone.</p>
      </section>

      <section className="rounded-xl border border-sky-200 bg-sky-50/70 p-4"><div className="flex items-start gap-3"><Clipboard className="mt-0.5 text-sky-700" aria-hidden="true" /><div><h3 className="font-bold text-sky-950">M-Pesa PayBill</h3><p className="mt-1 text-sm leading-5 text-slate-700">In M-Pesa, choose <strong>Lipa na M-Pesa → PayBill</strong>, then use the details below. For a first payment, we recommend starting with up to KSh 250,000 and paying the balance next.</p></div></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><CopyValue label="Business number" value="247247" /><CopyValue label="Account number" value="722151" /></div></section>

      <section className="rounded-xl border border-violet-200 bg-violet-50/70 p-4"><div className="flex items-start gap-3"><Landmark className="mt-0.5 text-violet-700" aria-hidden="true" /><div><h3 className="font-bold text-violet-950">Bank transfer / PesaLink</h3><p className="mt-1 text-sm leading-5 text-slate-700">Transfer through Equity Bank or PesaLink using the account details below. Please use your receipt number as the payment reference.</p></div></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><CopyValue label="Account name" value="Betech Solar Solution Limited" /><CopyValue label="Account number" value="0940287664685" /><CopyValue label="Bank" value="Equity Bank Kenya" /><CopyValue label="Branch" value="Tea Room" /></div></section>
    </div>
  </section>;
}
