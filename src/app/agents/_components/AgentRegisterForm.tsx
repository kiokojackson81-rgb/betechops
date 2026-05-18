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
        <p className="text-xs font-black uppercase tracking-[0.28em] text-[#7a0000]">Affiliate signup</p>
        <h1 className="text-4xl font-black tracking-tight text-slate-950">Create Your Agent Account</h1>
        <p className="text-base leading-8 text-slate-600">
          Fill in your details to join the Betech Solar Agents Program.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-2xl border border-[#f2b20f]/30 bg-[#fff7e8] px-4 py-3 text-sm text-[#7a0000]">{success}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">First Name</label>
          <input
            required
            value={form.firstName}
            onChange={(event) => update("firstName", event.target.value)}
            className="h-14 w-full rounded-2xl border border-[#7a0000]/10 bg-[#fcfaf7] px-4 text-slate-950 outline-none transition focus:border-[#7a0000]/55 focus:bg-white"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Last Name</label>
          <input
            required
            value={form.lastName}
            onChange={(event) => update("lastName", event.target.value)}
            className="h-14 w-full rounded-2xl border border-[#7a0000]/10 bg-[#fcfaf7] px-4 text-slate-950 outline-none transition focus:border-[#7a0000]/55 focus:bg-white"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Email Address</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
            className="h-14 w-full rounded-2xl border border-[#7a0000]/10 bg-[#fcfaf7] px-4 text-slate-950 outline-none transition focus:border-[#7a0000]/55 focus:bg-white"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Phone Number / M-Pesa Number</label>
          <input
            required
            value={form.phone}
            onChange={(event) => update("phone", event.target.value)}
            className="h-14 w-full rounded-2xl border border-[#7a0000]/10 bg-[#fcfaf7] px-4 text-slate-950 outline-none transition focus:border-[#7a0000]/55 focus:bg-white"
          />
          <p className="text-xs leading-6 text-slate-500">This number may be used for commission payouts.</p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">Create Password</label>
        <input
          type="password"
          required
          minLength={8}
          value={form.password}
          onChange={(event) => update("password", event.target.value)}
          className="h-14 w-full rounded-2xl border border-[#7a0000]/10 bg-[#fcfaf7] px-4 text-slate-950 outline-none transition focus:border-[#7a0000]/55 focus:bg-white"
          placeholder="At least 8 characters"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Country</label>
          <input
            value={form.country}
            onChange={(event) => update("country", event.target.value)}
            className="h-14 w-full rounded-2xl border border-[#7a0000]/10 bg-[#fcfaf7] px-4 text-slate-950 outline-none transition focus:border-[#7a0000]/55 focus:bg-white"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">County</label>
          <input
            value={form.county}
            onChange={(event) => update("county", event.target.value)}
            className="h-14 w-full rounded-2xl border border-[#7a0000]/10 bg-[#fcfaf7] px-4 text-slate-950 outline-none transition focus:border-[#7a0000]/55 focus:bg-white"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Town / City</label>
          <input
            value={form.city}
            onChange={(event) => update("city", event.target.value)}
            className="h-14 w-full rounded-2xl border border-[#7a0000]/10 bg-[#fcfaf7] px-4 text-slate-950 outline-none transition focus:border-[#7a0000]/55 focus:bg-white"
          />
        </div>
      </div>

      <div className="rounded-[1.4rem] border border-[#f2b20f]/20 bg-[#fff7e9] px-4 py-4 text-sm leading-7 text-slate-700">
        <div className="font-black uppercase tracking-[0.16em] text-[#7a0000]">Create account → refer customers → earn 6%</div>
        <div className="mt-2">Join the platform, submit customer orders, and start building commission through completed solar sales.</div>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="h-14 w-full rounded-2xl bg-[linear-gradient(135deg,#7a0000_0%,#9a1010_100%)] px-4 text-base font-bold text-white shadow-[0_18px_40px_rgba(122,0,0,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_50px_rgba(122,0,0,0.24)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Creating Account..." : "Create Agent Account"}
      </button>

      <div className="rounded-[1.4rem] border border-[#7a0000]/10 bg-white px-4 py-4 text-sm text-slate-600 shadow-[0_12px_24px_rgba(15,23,42,0.04)]">
        <div className="font-semibold text-slate-800">Already have an account?</div>
        <Link href={agentPath("/login", useRootPaths)} className="mt-1 inline-flex font-bold text-[#7a0000] hover:text-[#9a1010]">
          Sign in
        </Link>
      </div>
    </form>
  );
}
