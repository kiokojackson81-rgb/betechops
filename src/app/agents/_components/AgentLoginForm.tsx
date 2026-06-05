"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { agentPath } from "@/lib/agents/host";

type AgentLoginFormProps = {
  useRootPaths?: boolean;
};

export default function AgentLoginForm({ useRootPaths = false }: AgentLoginFormProps) {
  const params = useSearchParams();
  const callbackUrl = params?.get("callbackUrl") || agentPath("/dashboard", useRootPaths);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const absoluteCallbackUrl =
      typeof window === "undefined"
        ? callbackUrl
        : new URL(callbackUrl, window.location.origin).toString();
    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
      callbackUrl: absoluteCallbackUrl,
    });
    if (res?.ok && res.url) {
      window.location.href = res.url;
      return;
    }
    setError(res?.error || "Unable to sign in");
    setBusy(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
      <div className="space-y-2">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-[#7a0000]">Agent Portal</p>
        <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Welcome back</h1>
        <p className="text-base leading-7 text-slate-600 sm:leading-8">
          Sign in to manage your referrals, track commissions, and submit customer orders.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-14 w-full rounded-2xl border border-[#7a0000]/10 bg-[#fcfaf7] px-4 text-slate-950 outline-none transition focus:border-[#7a0000]/55 focus:bg-white"
          placeholder="agent@example.com"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-14 w-full rounded-2xl border border-[#7a0000]/10 bg-[#fcfaf7] px-4 text-slate-950 outline-none transition focus:border-[#7a0000]/55 focus:bg-white"
          placeholder="Your password"
        />
      </div>

      <div className="rounded-[1.4rem] border border-[#f2b20f]/20 bg-[#fff7e9] px-4 py-4 text-sm leading-7 text-slate-700">
        <div className="font-black uppercase tracking-[0.16em] text-[#7a0000]">Why sign in?</div>
        <div className="mt-2">6% commission on completed sales. Track customer orders, referrals, and M-Pesa withdrawals in one place.</div>
      </div>

      <Link
        href={`/login/phone?callbackUrl=${encodeURIComponent(callbackUrl)}`}
        className="flex h-14 w-full items-center justify-center rounded-2xl border border-[#7a0000]/12 bg-[#fffaf4] px-4 text-base font-bold text-[#7a0000] shadow-[0_12px_24px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5"
      >
        Sign in with phone OTP
      </Link>

      <button
        type="submit"
        disabled={busy}
        className="h-14 w-full rounded-2xl bg-[linear-gradient(135deg,#7a0000_0%,#9a1010_100%)] px-4 text-base font-bold text-white shadow-[0_18px_40px_rgba(122,0,0,0.18)] transition active:scale-[0.99] hover:-translate-y-0.5 hover:bg-[#7a0000] hover:shadow-[0_24px_50px_rgba(122,0,0,0.24)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Signing In..." : "Sign In"}
      </button>

      <div className="rounded-[1.4rem] border border-[#7a0000]/10 bg-white px-4 py-4 text-sm text-slate-600 shadow-[0_12px_24px_rgba(15,23,42,0.04)]">
        <div className="font-semibold text-slate-800">New agent?</div>
        <Link href={agentPath("/register", useRootPaths)} className="mt-1 inline-flex font-bold text-[#7a0000] hover:text-[#9a1010]">
          Create your BETECH affiliate account
        </Link>
      </div>
    </form>
  );
}
