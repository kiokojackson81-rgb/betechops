"use client";

import { useState } from "react";

type AgentPaymentMethodFormProps = {
  initialValues: {
    firstName: string;
    lastName: string;
    phone: string;
  };
};

export default function AgentPaymentMethodForm({ initialValues }: AgentPaymentMethodFormProps) {
  const [form, setForm] = useState(initialValues);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/agents/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || "Unable to update payment method.");
      setBusy(false);
      return;
    }

    setSuccess("Payment method updated successfully.");
    setBusy(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-[28px] border border-[#e4d4cb] bg-white p-6 shadow-[0_12px_40px_rgba(64,32,18,0.08)]">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#7a0000]">Payment method</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-[#210505]">M-Pesa payout setup</h2>
        <p className="mt-2 text-sm text-slate-600">
          Agent payouts currently go to the M-Pesa number saved on your profile. Keep the recipient name and phone correct before requesting a payout.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
      ) : null}

      <div className="rounded-[24px] border border-[#f1b81d]/30 bg-[#fff3cf] p-4 text-sm text-[#5a4300]">
        Current payout rails:
        <div className="mt-2 font-semibold text-[#210505]">M-Pesa only for now</div>
        <div className="mt-1 text-[#715600]">Bank payout options can be added later without changing your referral workflow.</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Recipient first name</span>
          <input
            value={form.firstName}
            onChange={(event) => update("firstName", event.target.value)}
            className="w-full rounded-2xl border border-[#dcc8bd] bg-[#fffaf5] px-4 py-3 text-slate-900 outline-none transition focus:border-[#7a0000]/40"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Recipient last name</span>
          <input
            value={form.lastName}
            onChange={(event) => update("lastName", event.target.value)}
            className="w-full rounded-2xl border border-[#dcc8bd] bg-[#fffaf5] px-4 py-3 text-slate-900 outline-none transition focus:border-[#7a0000]/40"
          />
        </label>
      </div>

      <label className="space-y-2">
        <span className="text-sm font-medium text-slate-700">M-Pesa number</span>
        <input
          value={form.phone}
          onChange={(event) => update("phone", event.target.value)}
          placeholder="07XXXXXXXX"
          className="w-full rounded-2xl border border-[#dcc8bd] bg-[#fffaf5] px-4 py-3 text-slate-900 outline-none transition focus:border-[#7a0000]/40"
        />
      </label>

      <button
        type="submit"
        disabled={busy}
        className="rounded-2xl bg-[#7a0000] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Saving..." : "Save payout details"}
      </button>
    </form>
  );
}
