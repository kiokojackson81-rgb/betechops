"use client";

import { useMemo, useState } from "react";

const money = (value: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value || 0);

type AgentWithdrawalRequestFormProps = {
  availableAmount: number;
  pendingAmount: number;
  paidAmount: number;
  phone: string;
};

export default function AgentWithdrawalRequestForm({
  availableAmount,
  pendingAmount,
  paidAmount,
  phone,
}: AgentWithdrawalRequestFormProps) {
  const defaultAmount = useMemo(() => (availableAmount > 0 ? String(Math.floor(availableAmount)) : ""), [availableAmount]);
  const [amount, setAmount] = useState(defaultAmount);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/agents/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(amount || 0),
        method: "MPESA",
        phone,
        reference: reference.trim() || null,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || "Unable to submit withdrawal request.");
      setBusy(false);
      return;
    }

    setSuccess("Withdrawal request submitted successfully. Admin will review it before payout.");
    setAmount("");
    setReference("");
    setBusy(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-[28px] border border-[#e4d4cb] bg-white p-6 shadow-[0_12px_40px_rgba(64,32,18,0.08)]">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#7a0000]">Withdraw commission</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-[#210505]">Request M-Pesa withdrawal</h2>
        <p className="mt-2 text-sm text-slate-600">
          Once your commission is available, request withdrawal here and the BETECH team will process it to your saved M-Pesa number.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[22px] border border-[#f1b81d]/30 bg-[#fff3cf] p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-[#7a0000]">Available now</div>
          <div className="mt-2 text-2xl font-black text-[#210505]">{money(availableAmount)}</div>
        </div>
        <div className="rounded-[22px] border border-[#e4d4cb] bg-[#fffaf5] p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Already requested</div>
          <div className="mt-2 text-2xl font-black text-[#210505]">{money(pendingAmount)}</div>
        </div>
        <div className="rounded-[22px] border border-[#e4d4cb] bg-[#edf9f0] p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-[#136233]">Already withdrawn</div>
          <div className="mt-2 text-2xl font-black text-[#210505]">{money(paidAmount)}</div>
        </div>
      </div>

      <label className="space-y-2">
        <span className="text-sm font-medium text-slate-700">Withdrawal amount</span>
        <input
          type="number"
          min="1"
          step="1"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="Enter amount to withdraw"
          className="w-full rounded-2xl border border-[#dcc8bd] bg-[#fffaf5] px-4 py-3 text-slate-900 outline-none transition focus:border-[#7a0000]/40"
        />
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-slate-700">Payout phone</span>
        <input
          value={phone}
          readOnly
          className="w-full rounded-2xl border border-[#dcc8bd] bg-[#f5eee7] px-4 py-3 text-slate-600 outline-none"
        />
        <span className="text-xs text-slate-500">Update your payment method first if this M-Pesa number is wrong.</span>
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-slate-700">Optional note or reference</span>
        <input
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="Optional note for admin review"
          className="w-full rounded-2xl border border-[#dcc8bd] bg-[#fffaf5] px-4 py-3 text-slate-900 outline-none transition focus:border-[#7a0000]/40"
        />
      </label>

      <button
        type="submit"
        disabled={busy || availableAmount <= 0 || !phone}
        className="rounded-2xl bg-[#7a0000] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Submitting..." : "Request Withdrawal"}
      </button>
    </form>
  );
}
