"use client";

import { useState } from "react";

type AgentProfileSettingsFormProps = {
  initialValues: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    nationalId: string;
    kraPin: string;
    county: string;
    city: string;
    country: string;
    address: string;
  };
};

export default function AgentProfileSettingsForm({ initialValues }: AgentProfileSettingsFormProps) {
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
      setError(payload.error || "Unable to update profile.");
      setBusy(false);
      return;
    }

    setSuccess("Profile updated successfully.");
    setBusy(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-[28px] border border-[#e4d4cb] bg-white p-6 shadow-[0_12px_40px_rgba(64,32,18,0.08)]">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#7a0000]">Profile settings</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-[#210505]">Your details</h2>
        <p className="mt-2 text-sm text-slate-600">
          Keep your contact and identity details updated so approvals, payouts, and sales follow-up stay smooth.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">First name</span>
          <input
            value={form.firstName}
            onChange={(event) => update("firstName", event.target.value)}
            className="w-full rounded-2xl border border-[#dcc8bd] bg-[#fffaf5] px-4 py-3 text-slate-900 outline-none transition focus:border-[#7a0000]/40"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Last name</span>
          <input
            value={form.lastName}
            onChange={(event) => update("lastName", event.target.value)}
            className="w-full rounded-2xl border border-[#dcc8bd] bg-[#fffaf5] px-4 py-3 text-slate-900 outline-none transition focus:border-[#7a0000]/40"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
            className="w-full rounded-2xl border border-[#dcc8bd] bg-[#fffaf5] px-4 py-3 text-slate-900 outline-none transition focus:border-[#7a0000]/40"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Phone</span>
          <input
            value={form.phone}
            onChange={(event) => update("phone", event.target.value)}
            className="w-full rounded-2xl border border-[#dcc8bd] bg-[#fffaf5] px-4 py-3 text-slate-900 outline-none transition focus:border-[#7a0000]/40"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">National ID</span>
          <input
            value={form.nationalId}
            onChange={(event) => update("nationalId", event.target.value)}
            className="w-full rounded-2xl border border-[#dcc8bd] bg-[#fffaf5] px-4 py-3 text-slate-900 outline-none transition focus:border-[#7a0000]/40"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">KRA PIN</span>
          <input
            value={form.kraPin}
            onChange={(event) => update("kraPin", event.target.value)}
            className="w-full rounded-2xl border border-[#dcc8bd] bg-[#fffaf5] px-4 py-3 text-slate-900 outline-none transition focus:border-[#7a0000]/40"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">County</span>
          <input
            value={form.county}
            onChange={(event) => update("county", event.target.value)}
            className="w-full rounded-2xl border border-[#dcc8bd] bg-[#fffaf5] px-4 py-3 text-slate-900 outline-none transition focus:border-[#7a0000]/40"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Town / City</span>
          <input
            value={form.city}
            onChange={(event) => update("city", event.target.value)}
            className="w-full rounded-2xl border border-[#dcc8bd] bg-[#fffaf5] px-4 py-3 text-slate-900 outline-none transition focus:border-[#7a0000]/40"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Country</span>
          <input
            value={form.country}
            onChange={(event) => update("country", event.target.value)}
            className="w-full rounded-2xl border border-[#dcc8bd] bg-[#fffaf5] px-4 py-3 text-slate-900 outline-none transition focus:border-[#7a0000]/40"
          />
        </label>
      </div>

      <label className="space-y-2">
        <span className="text-sm font-medium text-slate-700">Address</span>
        <textarea
          rows={4}
          value={form.address}
          onChange={(event) => update("address", event.target.value)}
          className="w-full rounded-2xl border border-[#dcc8bd] bg-[#fffaf5] px-4 py-3 text-slate-900 outline-none transition focus:border-[#7a0000]/40"
        />
      </label>

      <button
        type="submit"
        disabled={busy}
        className="rounded-2xl bg-[#7a0000] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}
