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
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const params = useSearchParams();
  const callbackUrl = params?.get("callbackUrl") || defaultRedirect;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    if (challengeId) {
      const res = await signIn("stephen-sms-otp", {
        redirect: false,
        challengeId,
        code: otp,
        callbackUrl,
      });
      if (res?.ok) {
        if (res.url) window.location.href = res.url;
        return;
      }
      setError("The verification code is invalid or has expired. Sign in again to receive a new code.");
      setBusy(false);
      return;
    }

    if (email.trim().toLowerCase() === "stephen@betech.co.ke") {
      const response = await fetch("/api/auth/stephen-login-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.ok && data.challengeId) {
        setChallengeId(data.challengeId);
        setMaskedPhone(data.phone || "your registered phone");
        setOtp("");
        setBusy(false);
        return;
      }
      setError(data?.error || "Unable to start SMS verification.");
      setBusy(false);
      return;
    }

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
      {challengeId ? (
        <>
          <p className="text-sm text-slate-300">A six-digit verification code was sent to {maskedPhone}.</p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
            placeholder="6-digit SMS code"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-full rounded-lg border border-slate-700 bg-black/30 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={() => { setChallengeId(null); setOtp(""); setMaskedPhone(""); setError(null); }}
            className="text-sm text-emerald-300 hover:text-emerald-200"
          >
            Use a different sign-in
          </button>
        </>
      ) : (
        <>
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
        </>
      )}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-black hover:brightness-95 disabled:opacity-60"
      >
        {busy ? "Signing in…" : challengeId ? "Verify and sign in" : "Sign in"}
      </button>
    </form>
  );
}
