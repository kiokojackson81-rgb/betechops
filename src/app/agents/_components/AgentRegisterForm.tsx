"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { agentPath } from "@/lib/agents/host";

type RegisterResponse = {
  ok?: boolean;
  error?: string;
};

type AgentRegisterFormProps = {
  useRootPaths?: boolean;
};

export default function AgentRegisterForm({ useRootPaths = false }: AgentRegisterFormProps) {
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    country: "Kenya",
    county: "",
    city: "",
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);

    const referralCode = params?.get("ref") || "";
    const res = await fetch("/api/agents/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, referralCode }),
    });
    const payload = (await res.json()) as RegisterResponse;
    if (!res.ok) {
      setError(payload.error || "Unable to create account");
      setBusy(false);
      return;
    }

    setSuccess("Account created. Redirecting to your dashboard...");
    const dashboardPath = agentPath("/dashboard", useRootPaths);
    const absoluteCallbackUrl =
      typeof window === "undefined" ? dashboardPath : new URL(dashboardPath, window.location.origin).toString();
    const signInRes = await signIn("credentials", {
      redirect: false,
      email: form.email,
      password: form.password,
      callbackUrl: absoluteCallbackUrl,
    });
    if (signInRes?.ok && signInRes.url) {
      window.location.href = signInRes.url;
      return;
    }
    window.location.href = agentPath("/login", useRootPaths);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">Affiliate onboarding</p>
        <h1 className="text-3xl font-semibold text-white">Register as a BETECH agent</h1>
        <p className="text-sm text-slate-400">
          Open one account for referrals, commission tracking, payouts, and future KYC approval.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{success}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm text-slate-300">First name</label>
          <input
            required
            value={form.firstName}
            onChange={(event) => update("firstName", event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400/60"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-slate-300">Last name</label>
          <input
            required
            value={form.lastName}
            onChange={(event) => update("lastName", event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400/60"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm text-slate-300">Email</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400/60"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-slate-300">Phone</label>
          <input
            required
            value={form.phone}
            onChange={(event) => update("phone", event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400/60"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-slate-300">Password</label>
        <input
          type="password"
          required
          minLength={8}
          value={form.password}
          onChange={(event) => update("password", event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400/60"
          placeholder="At least 8 characters"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm text-slate-300">Country</label>
          <input
            value={form.country}
            onChange={(event) => update("country", event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400/60"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-slate-300">County</label>
          <input
            value={form.county}
            onChange={(event) => update("county", event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400/60"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-slate-300">City</label>
          <input
            value={form.city}
            onChange={(event) => update("city", event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400/60"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-2xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Creating account..." : "Create agent account"}
      </button>

      <p className="text-sm text-slate-400">
        Already registered?{" "}
        <Link href={agentPath("/login", useRootPaths)} className="font-medium text-cyan-300 hover:text-cyan-200">
          Sign in here
        </Link>
      </p>
    </form>
  );
}
