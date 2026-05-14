"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function AgentLoginForm() {
  const params = useSearchParams();
  const callbackUrl = params?.get("callbackUrl") || "/agents/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
      callbackUrl,
    });
    if (res?.ok && res.url) {
      window.location.href = res.url;
      return;
    }
    setError(res?.error || "Unable to sign in");
    setBusy(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">Agent portal</p>
        <h1 className="text-3xl font-semibold text-white">Sign in to your BETECH affiliate account</h1>
        <p className="text-sm text-slate-400">
          Track referrals, sales, commissions, payout requests, and approval status from one dashboard.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
      ) : null}

      <div className="space-y-2">
        <label className="text-sm text-slate-300">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-emerald-400/60"
          placeholder="agent@example.com"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm text-slate-300">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-emerald-400/60"
          placeholder="Your password"
        />
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-2xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Signing in..." : "Sign in"}
      </button>

      <p className="text-sm text-slate-400">
        New here?{" "}
        <Link href="/agents/register" className="font-medium text-emerald-300 hover:text-emerald-200">
          Create your agent account
        </Link>
      </p>
    </form>
  );
}
