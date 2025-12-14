"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

type CredentialLoginFormProps = {
  defaultRedirect: string;
  title?: string;
  description?: string;
};

export default function CredentialLoginForm({
  defaultRedirect,
  title = "Sign in",
  description,
}: CredentialLoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const params = useSearchParams();
  const callbackUrl = params?.get("callbackUrl") || defaultRedirect;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
      callbackUrl,
    });
    if (res?.ok) {
      if (res.url) window.location.href = res.url;
      return;
    }
    setError(res?.error || "Invalid credentials");
    setBusy(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {description ? <p className="text-sm text-slate-400">{description}</p> : null}
      {error ? <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}
      <input
        type="email"
        required
        autoComplete="email"
        placeholder="name@betech.co.ke"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-black/30 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500"
      />
      <input
        type="password"
        required
        autoComplete="current-password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-black/30 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500"
      />
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-black hover:brightness-95 disabled:opacity-60"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
