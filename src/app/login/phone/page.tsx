"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { normalizeKenyanPhone } from "@/lib/phone";

export default function PhoneLoginPage() {
  const [phoneInput, setPhoneInput] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [callbackUrl, setCallbackUrl] = useState("/account");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setCallbackUrl(params.get("callbackUrl") || "/account");
  }, []);

  async function handleSendOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const phone = normalizeKenyanPhone(phoneInput);
      if (!phone) {
        throw new Error("Enter a valid Kenyan phone number like 0712345678.");
      }

      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Unable to send OTP.");
      }

      setNormalizedPhone(payload.phone || phone);
      setOtpSent(true);
      setMessage(payload.message || `We sent a verification code to ${phone}.`);
      setCooldown(45);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Unable to send OTP.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone || phoneInput, code: otp }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "OTP verification failed.");
      }

      const target = payload.requiresProfileCompletion
        ? `/account/complete-profile?next=${encodeURIComponent(payload.redirectTo || callbackUrl)}`
        : payload.redirectTo || callbackUrl;

      const signInResult = await signIn("phone-otp", {
        redirect: false,
        verificationToken: payload.verificationToken,
        callbackUrl: target,
      });

      if (!signInResult?.ok) {
        throw new Error(signInResult?.error || "Unable to create your session.");
      }

      window.location.href = signInResult.url || target;
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Invalid OTP.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(242,178,15,0.16),transparent_24%),linear-gradient(180deg,#fffdf8_0%,#fff3e5_100%)] px-4 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-md">
        <div className="rounded-[2rem] border border-[#7a0000]/10 bg-white p-6 shadow-[0_28px_70px_rgba(122,0,0,0.10)] sm:p-7">
          <div className="text-xs font-black uppercase tracking-[0.24em] text-[#7a0000]">Phone OTP</div>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Sign in with your phone number</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Enter your Kenyan mobile number. We will send an SMS code, verify it, and then connect your Betech customer or agent account to one shared identity.
          </p>

          {error ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {message ? <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

          {!otpSent ? (
            <form onSubmit={handleSendOtp} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Phone number</span>
                <input
                  type="tel"
                  required
                  autoComplete="tel"
                  placeholder="0712345678"
                  value={phoneInput}
                  onChange={(event) => setPhoneInput(event.target.value)}
                  className="w-full rounded-2xl border border-[#ead8c4] bg-[#fffdf9] px-4 py-3 text-base text-slate-900 outline-none transition focus:border-[#7a0000]/35 focus:ring-2 focus:ring-[#f2b20f]/30"
                />
                <span className="mt-2 block text-xs text-slate-500">We currently support Kenyan mobile numbers in the +2547XXXXXXXX format.</span>
              </label>

              <button
                type="submit"
                disabled={busy || cooldown > 0}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#7a0000_0%,#991010_100%)] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_36px_rgba(122,0,0,0.18)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Sending code..." : cooldown > 0 ? `Resend in ${cooldown}s` : "Send OTP"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Enter OTP code</span>
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  className="w-full rounded-2xl border border-[#ead8c4] bg-[#fffdf9] px-4 py-3 text-base tracking-[0.3em] text-slate-900 outline-none transition focus:border-[#7a0000]/35 focus:ring-2 focus:ring-[#f2b20f]/30"
                />
              </label>

              <button
                type="submit"
                disabled={busy}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#7a0000_0%,#991010_100%)] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_36px_rgba(122,0,0,0.18)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Verifying..." : "Verify OTP and continue"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setOtpSent(false);
                  setOtp("");
                  setMessage(null);
                  setError(null);
                }}
                className="inline-flex w-full items-center justify-center rounded-2xl border border-[#7a0000]/15 bg-[#fffaf4] px-5 py-3 text-sm font-semibold text-[#7a0000]"
              >
                Use a different phone number
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
