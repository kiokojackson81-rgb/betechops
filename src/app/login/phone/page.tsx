"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { signIn } from "next-auth/react";
import { normalizeKenyanPhone } from "@/lib/phone";

type AccountPreview = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
} | null;

type IdentifyResponse = {
  ok: boolean;
  method?: "email" | "phone";
  identifierType?: "email" | "phone";
  identifier?: string;
  normalizedPhone?: string;
  maskedPhone?: string;
  account?: AccountPreview;
  message?: string;
  error?: string;
};

export default function PhoneLoginPage() {
  const { status } = useSession();
  const [identifier, setIdentifier] = useState("");
  const [resolvedIdentifier, setResolvedIdentifier] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [identifierType, setIdentifierType] = useState<"email" | "phone" | null>(null);
  const [account, setAccount] = useState<AccountPreview>(null);
  const [otp, setOtp] = useState("");
  const [callbackUrl, setCallbackUrl] = useState("/account");
  const [postAuthRedirect, setPostAuthRedirect] = useState<string | null>(null);
  const [step, setStep] = useState<"identify" | "verify">("identify");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const canResend = cooldown <= 0;
  const resolvedPhonePreview = useMemo(() => normalizedPhone || normalizeKenyanPhone(phoneInput), [normalizedPhone, phoneInput]);
  const normalizedEmailPreview = useMemo(() => resolvedIdentifier.trim().toLowerCase(), [resolvedIdentifier]);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setCallbackUrl(params.get("callbackUrl") || "/account");
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    const target = postAuthRedirect || (step === "identify" ? callbackUrl || "/account" : null);
    if (!target) return;
    window.location.replace(target);
  }, [callbackUrl, postAuthRedirect, status, step]);

  if (status === "authenticated") {
    return null;
  }

  async function handleIdentify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const payload = (await response.json().catch(() => null)) as IdentifyResponse | null;

      if (!response.ok || !payload?.ok || !payload.identifierType || !payload.identifier) {
        throw new Error(payload?.error || "Unable to identify your account.");
      }

      setIdentifierType(payload.identifierType || null);
      setResolvedIdentifier(payload.identifier);
      setNormalizedPhone(payload.normalizedPhone || "");
      setMaskedPhone(payload.maskedPhone || payload.normalizedPhone || "");
      setPhoneInput(payload.normalizedPhone || "");
      setAccount(payload.account || null);
      setMessage(payload.message || null);
      setStep("verify");
      setOtp("");
      setCooldown(0);
    } catch (identifyError) {
      setError(identifyError instanceof Error ? identifyError.message : "Unable to identify your account.");
    } finally {
      setBusy(false);
    }
  }

  async function sendOtp() {
    if (identifierType === "email") {
      const email = normalizedEmailPreview;
      if (!email) {
        throw new Error("Enter a valid email address.");
      }

      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifierType: "email", identifier: email }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Unable to send OTP.");
      }

      setResolvedIdentifier(payload.identifier || payload.email || email);
      setMessage(payload.message || `We sent a verification code to ${email}.`);
      setCooldown(45);
      return;
    }

    const phone = normalizeKenyanPhone(phoneInput || normalizedPhone);
    if (!phone) {
      throw new Error("Enter a valid Kenyan phone number like 0712345678 or 0101234567.");
    }

    const response = await fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifierType: "phone", identifier: phone }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || "Unable to send OTP.");
    }

    setNormalizedPhone(payload.phone || phone);
    setPhoneInput(payload.phone || phone);
    setMaskedPhone(payload.phone || phone);
    setMessage(payload.message || `We sent a verification code to ${phone}.`);
    setCooldown(45);
  }

  async function handleSendOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      await sendOtp();
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
      let requestBody: Record<string, string>;
      if (identifierType === "email") {
        const email = normalizedEmailPreview;
        if (!email) {
          throw new Error("Enter a valid email address.");
        }
        requestBody = {
          identifierType: "email",
          identifier: email,
          code: otp,
        };
      } else {
        const phone = normalizeKenyanPhone(phoneInput || normalizedPhone);
        if (!phone) {
          throw new Error("Enter a valid Kenyan phone number like 0712345678 or 0101234567.");
        }
        requestBody = {
          identifierType: "phone",
          identifier: phone,
          code: otp,
        };
      }

      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "OTP verification failed.");
      }

      const target = payload.requiresProfileCompletion
        ? `/account/complete-profile?next=${encodeURIComponent(payload.redirectTo || callbackUrl)}`
        : payload.redirectTo || callbackUrl;
      setPostAuthRedirect(target);

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

  function resetFlow() {
    setStep("identify");
    setIdentifier("");
    setResolvedIdentifier("");
    setPhoneInput("");
    setNormalizedPhone("");
    setMaskedPhone("");
    setIdentifierType(null);
    setAccount(null);
    setPostAuthRedirect(null);
    setOtp("");
    setMessage(null);
    setError(null);
    setCooldown(0);
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(242,178,15,0.16),transparent_24%),linear-gradient(180deg,#fffdf8_0%,#fff3e5_100%)] px-4 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-md">
        <div className="rounded-[2rem] border border-[#7a0000]/10 bg-white p-6 shadow-[0_28px_70px_rgba(122,0,0,0.10)] sm:p-7">
          <div className="text-xs font-black uppercase tracking-[0.24em] text-[#7a0000]">Customer login</div>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
            {step === "identify" ? "Sign in with email or phone" : identifierType === "email" ? "Verify with email OTP" : "Verify with SMS OTP"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {step === "identify"
              ? "Start with the email address or Kenyan mobile number on your Betech account. We will detect the account first, then continue with one secure OTP flow."
              : identifierType === "email"
                ? "Confirm the email for this account, request an OTP by email, then enter the code to complete sign in."
                : "Confirm the phone number for this account, request an OTP by SMS, then enter the code to complete sign in."}
          </p>

          {error ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {message ? <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

          {step === "identify" ? (
            <form onSubmit={handleIdentify} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Email or mobile number</span>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  placeholder="name@example.com or 0712345678"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  className="w-full rounded-2xl border border-[#ead8c4] bg-[#fffdf9] px-4 py-3 text-base text-slate-900 outline-none transition focus:border-[#7a0000]/35 focus:ring-2 focus:ring-[#f2b20f]/30"
                />
                <span className="mt-2 block text-xs text-slate-500">Use the email or Kenyan mobile number linked to your Betech customer or agent account.</span>
              </label>

              <button
                type="submit"
                disabled={busy}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#7a0000_0%,#991010_100%)] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_36px_rgba(122,0,0,0.18)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Checking account..." : "Continue"}
              </button>
            </form>
          ) : (
            <div className="mt-6 space-y-5">
              <div className="rounded-[1.6rem] border border-[#ead8c4] bg-[#fffaf4] px-4 py-4">
                <div className="text-xs font-black uppercase tracking-[0.2em] text-[#7a0000]">
                  {account ? "Account found" : identifierType === "email" ? "Continue with email" : "Continue with phone"}
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  {identifierType === "email"
                    ? `We matched ${normalizedEmailPreview} to this account.`
                    : "Use this phone number to receive your OTP."}
                </div>
                <div className="mt-3 text-base font-semibold text-slate-900">{account?.name || "Betech customer"}</div>
                <div className="mt-1 text-sm text-slate-600">
                  {identifierType === "email" ? account?.email || normalizedEmailPreview : account?.email || maskedPhone || resolvedPhonePreview}
                </div>
              </div>

              <form onSubmit={handleSendOtp} className="space-y-4">
                {identifierType === "email" ? (
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Email address</span>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={normalizedEmailPreview}
                      readOnly
                      className="w-full rounded-2xl border border-[#ead8c4] bg-[#f8f4ec] px-4 py-3 text-base text-slate-900 outline-none"
                    />
                    <span className="mt-2 block text-xs text-slate-500">We will send a one-time verification code to this email address.</span>
                  </label>
                ) : (
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Phone number</span>
                    <input
                      type="tel"
                      required
                      autoComplete="tel"
                      placeholder="0712345678 or 0101234567"
                      value={phoneInput}
                      onChange={(event) => setPhoneInput(event.target.value)}
                      className="w-full rounded-2xl border border-[#ead8c4] bg-[#fffdf9] px-4 py-3 text-base text-slate-900 outline-none transition focus:border-[#7a0000]/35 focus:ring-2 focus:ring-[#f2b20f]/30"
                    />
                    <span className="mt-2 block text-xs text-slate-500">
                      We support Kenyan mobile numbers in formats like 0712345678, 0101234567, 2547XXXXXXXX, 2541XXXXXXXX, and +254...
                    </span>
                  </label>
                )}

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={busy || !canResend}
                    className="inline-flex flex-1 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#7a0000_0%,#991010_100%)] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_36px_rgba(122,0,0,0.18)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy ? "Sending code..." : canResend ? `Send ${identifierType === "email" ? "email" : "SMS"} OTP` : `Resend in ${cooldown}s`}
                  </button>
                  <button
                    type="button"
                    onClick={resetFlow}
                    className="inline-flex items-center justify-center rounded-2xl border border-[#7a0000]/15 bg-[#fffaf4] px-5 py-3 text-sm font-semibold text-[#7a0000]"
                  >
                    Change
                  </button>
                </div>
              </form>

              <form onSubmit={handleVerifyOtp} className="space-y-4 border-t border-[#f2e4d1] pt-5">
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
                  disabled={busy || (identifierType === "email" ? !normalizedEmailPreview : !resolvedPhonePreview)}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#7a0000_0%,#991010_100%)] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_36px_rgba(122,0,0,0.18)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? "Verifying..." : "Verify OTP and sign in"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
