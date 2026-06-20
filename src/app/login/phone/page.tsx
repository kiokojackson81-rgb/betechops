"use client";

import { useEffect, useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { getTownsForCounty, kenyaCountyOptions } from "@/lib/agents/kenyaMarkets";
import { isAgentsHost } from "@/lib/runtimeUrls";

type AccountPreview = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
} | null;

type IdentifyResponse = {
  ok: boolean;
  identifierType?: "email" | "phone";
  identifier?: string;
  normalizedPhone?: string;
  maskedPhone?: string;
  account?: AccountPreview;
  message?: string;
  error?: string;
};

type VerifyResponse = {
  ok: boolean;
  verificationToken?: string;
  redirectTo?: string;
  requiresProfileCompletion?: boolean;
  error?: string;
  user?: {
    email?: string | null;
    phone?: string | null;
    name?: string | null;
  };
};

function normalizeAgentCallbackForHost(target: string, isAgentsDomainFlow: boolean) {
  if (!isAgentsDomainFlow) return target;
  if (target === "/agents") return "/";
  if (target.startsWith("/agents/")) return target.slice("/agents".length) || "/";
  return target;
}

function getDefaultCallbackForHost(isAgentsDomainFlow: boolean) {
  return isAgentsDomainFlow ? "/dashboard" : "/account";
}

function getResolvedPostLoginUrlForFlow(target: string, isAgentsDomainFlow: boolean, isAgentFlow: boolean) {
  const normalizedTarget = normalizeAgentCallbackForHost(target || getDefaultCallbackForHost(isAgentsDomainFlow), isAgentsDomainFlow);
  if (!isAgentFlow) return normalizedTarget;
  return `/auth/post-login?callbackUrl=${encodeURIComponent(normalizedTarget)}`;
}

async function waitForAuthenticatedSession(expectAgentSession: boolean, attempts = 20, delayMs = 250) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch("/api/auth/session", {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const payload = await response.json().catch(() => null);
      const hasSession = Boolean(payload?.user);
      const isAgentSession = Boolean(payload?.user?.isAgent);
      if (hasSession && (!expectAgentSession || isAgentSession)) {
        return true;
      }
    } catch {
      // Ignore transient polling failures while the session cookie settles.
    }

    await new Promise((resolve) => window.setTimeout(resolve, delayMs));
  }

  return false;
}

export default function PhoneLoginPage() {
  const { status } = useSession();
  const [isAgentsDomainFlow, setIsAgentsDomainFlow] = useState(false);
  const [callbackReady, setCallbackReady] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [resolvedIdentifier, setResolvedIdentifier] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [identifierType, setIdentifierType] = useState<"email" | "phone" | null>(null);
  const [account, setAccount] = useState<AccountPreview>(null);
  const [otp, setOtp] = useState("");
  const [callbackUrl, setCallbackUrl] = useState<string | null>(null);
  const [postAuthRedirect, setPostAuthRedirect] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [step, setStep] = useState<"identify" | "verify" | "complete-profile">("identify");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileCounty, setProfileCounty] = useState("");
  const [profileTown, setProfileTown] = useState("");
  const [profileEstateLandmark, setProfileEstateLandmark] = useState("");

  const normalizedEmailPreview = useMemo(() => resolvedIdentifier.trim().toLowerCase(), [resolvedIdentifier]);
  const canResend = cooldown <= 0;
  const availableTowns = useMemo(() => getTownsForCounty(profileCounty), [profileCounty]);
  const isCheckoutFlow = callbackUrl === "/checkout";
  const isAgentFlow =
    callbackUrl === "/dashboard" ||
    callbackUrl === "/agents/dashboard" ||
    (callbackUrl?.startsWith("/agents/") ?? false) ||
    (isAgentsDomainFlow && (callbackUrl?.startsWith("/") ?? false));

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    const nextIsAgentsDomainFlow = isAgentsHost(window.location.host);
    setIsAgentsDomainFlow(nextIsAgentsDomainFlow);
    const params = new URLSearchParams(window.location.search);
    const requestedCallback = params.get("callbackUrl") || getDefaultCallbackForHost(nextIsAgentsDomainFlow);
    setCallbackUrl(normalizeAgentCallbackForHost(requestedCallback, nextIsAgentsDomainFlow));
    setCallbackReady(true);
  }, []);

  useEffect(() => {
    if (!callbackReady) return;
    if (status !== "authenticated") return;
    if (step === "complete-profile") return;
    const target =
      postAuthRedirect || (step === "identify" ? callbackUrl || getDefaultCallbackForHost(isAgentsDomainFlow) : null);
    if (!target) return;
    window.location.replace(getResolvedPostLoginUrlForFlow(target, isAgentsDomainFlow, isAgentFlow));
  }, [callbackReady, callbackUrl, postAuthRedirect, status, step, isAgentFlow, isAgentsDomainFlow]);

  if (status === "authenticated" && step !== "complete-profile") {
    return null;
  }

  function hydrateProfileFields(payload?: AccountPreview, emailFallback?: string, phoneFallback?: string) {
    setProfileName(payload?.name || "");
    setProfileEmail(payload?.email || emailFallback || "");
    setProfilePhone(payload?.phone || phoneFallback || "");
  }

  async function sendOtp(nextIdentifierType: "email" | "phone", nextIdentifier: string, nextPhone?: string) {
    const response = await fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifierType: nextIdentifierType,
        identifier: nextIdentifierType === "email" ? nextIdentifier : nextPhone || nextIdentifier,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || "Unable to send OTP.");
    }

    if (nextIdentifierType === "email") {
      setResolvedIdentifier(payload.identifier || payload.email || nextIdentifier);
      setMessage(`Enter the code we sent to ${payload.identifier || payload.email || nextIdentifier}.`);
    } else {
      const phone = payload.phone || nextPhone || nextIdentifier;
      setNormalizedPhone(phone);
      setMaskedPhone(phone);
      setResolvedIdentifier(phone);
      setMessage(`Enter the code we sent to ${phone}.`);
    }
    setCooldown(45);
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
        throw new Error(payload?.error || "Unable to continue right now.");
      }

      setIdentifierType(payload.identifierType);
      setResolvedIdentifier(payload.identifier);
      setNormalizedPhone(payload.normalizedPhone || "");
      setMaskedPhone(payload.maskedPhone || payload.normalizedPhone || "");
      setAccount(payload.account || null);
      hydrateProfileFields(
        payload.account || null,
        payload.identifierType === "email" ? payload.identifier : payload.account?.email || "",
        payload.identifierType === "phone" ? payload.normalizedPhone || payload.identifier : payload.account?.phone || "",
      );
      setStep("verify");
      setOtp("");

      await sendOtp(payload.identifierType, payload.identifier, payload.normalizedPhone || payload.identifier);
    } catch (identifyError) {
      setError(identifyError instanceof Error ? identifyError.message : "Unable to continue right now.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResendOtp() {
    if (!identifierType || !canResend) return;
    setBusy(true);
    setError(null);
    try {
      await sendOtp(identifierType, resolvedIdentifier, normalizedPhone || resolvedIdentifier);
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
      const requestBody =
        identifierType === "email"
          ? {
              identifierType: "email",
              identifier: normalizedEmailPreview,
              code: otp,
              callbackUrl: callbackUrl || getDefaultCallbackForHost(isAgentsDomainFlow),
            }
          : {
              identifierType: "phone",
              identifier: normalizedPhone || resolvedIdentifier,
              code: otp,
              callbackUrl: callbackUrl || getDefaultCallbackForHost(isAgentsDomainFlow),
            };

      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const payload = (await response.json().catch(() => null)) as VerifyResponse | null;

      if (!response.ok || !payload?.ok || !payload.verificationToken) {
        throw new Error(payload?.error || "OTP verification failed.");
      }

      const target = normalizeAgentCallbackForHost(
        payload.redirectTo || callbackUrl || getDefaultCallbackForHost(isAgentsDomainFlow),
        isAgentsDomainFlow,
      );
      setPostAuthRedirect(target);
      setVerificationToken(payload.verificationToken);

      const signInResult = await signIn("phone-otp", {
        redirect: false,
        verificationToken: payload.verificationToken,
        callbackUrl: target,
      });

      if (!signInResult?.ok) {
        throw new Error(signInResult?.error || "Unable to create your session.");
      }

      if (payload.requiresProfileCompletion) {
        hydrateProfileFields(
          payload.user
            ? {
                name: payload.user.name,
                email: payload.user.email,
                phone: payload.user.phone,
              }
            : account,
          identifierType === "email" ? normalizedEmailPreview : payload.user?.email || "",
          identifierType === "phone" ? normalizedPhone || resolvedIdentifier : payload.user?.phone || "",
        );
        setStep("complete-profile");
        setMessage(null);
        return;
      }

      await waitForAuthenticatedSession(isAgentFlow);
      window.location.href = getResolvedPostLoginUrlForFlow(signInResult.url || target, isAgentsDomainFlow, isAgentFlow);
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Invalid OTP.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCompleteProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/account/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountMode: isAgentFlow ? "agent" : "customer",
          name: profileName,
          email: profileEmail,
          phone: profilePhone,
          whatsappNumber: profilePhone,
          county: profileCounty,
          town: profileTown,
          estateLandmark: profileEstateLandmark,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to save your profile.");
      }

      const target = normalizeAgentCallbackForHost(
        postAuthRedirect || callbackUrl || getDefaultCallbackForHost(isAgentsDomainFlow),
        isAgentsDomainFlow,
      );
      if (!verificationToken) {
        window.location.href = target;
        return;
      }

      const signInResult = await signIn("phone-otp", {
        redirect: false,
        verificationToken,
        callbackUrl: target,
      });

      if (!signInResult?.ok) {
        throw new Error(signInResult?.error || "Unable to create your session.");
      }

      await waitForAuthenticatedSession(isAgentFlow);
      window.location.href = getResolvedPostLoginUrlForFlow(signInResult.url || target, isAgentsDomainFlow, isAgentFlow);
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : "Unable to save your profile.");
    } finally {
      setBusy(false);
    }
  }

  function resetFlow() {
    setStep("identify");
    setIdentifier("");
    setResolvedIdentifier("");
    setNormalizedPhone("");
    setMaskedPhone("");
    setIdentifierType(null);
    setAccount(null);
    setOtp("");
    setPostAuthRedirect(null);
    setVerificationToken(null);
    setProfileName("");
    setProfileEmail("");
    setProfilePhone("");
    setProfileCounty("");
    setProfileTown("");
    setProfileEstateLandmark("");
    setMessage(null);
    setError(null);
    setCooldown(0);
  }

  const otpDestination = identifierType === "email" ? normalizedEmailPreview : maskedPhone || normalizedPhone || resolvedIdentifier;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(242,178,15,0.16),transparent_24%),linear-gradient(180deg,#fffdf8_0%,#fff3e5_100%)] px-4 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-md">
        <div className="rounded-[2rem] border border-[#7a0000]/10 bg-white p-6 shadow-[0_28px_70px_rgba(122,0,0,0.10)] sm:p-7">
          <div className="text-xs font-black uppercase tracking-[0.24em] text-[#7a0000]">{isAgentFlow ? "Agent login" : "Customer login"}</div>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
            {step === "identify"
              ? isAgentFlow
                ? "Agent sign in"
                : isCheckoutFlow
                ? "Continue to checkout"
                : "Sign in with email or phone"
              : identifierType === "email"
                ? "Verify with email OTP"
                : "Verify with SMS OTP"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {step === "identify"
              ? isAgentFlow
                ? "Enter your email address or Kenyan mobile number. We will send an OTP immediately, sign you in to your agent dashboard, or help you create your affiliate account without a password."
                : isCheckoutFlow
                ? "Enter your email address or Kenyan mobile number. We will send an OTP immediately, sign you in or create your account, then return you to checkout with any saved details prefilled."
                : "Enter your email address or Kenyan mobile number. We will immediately send you a one-time verification code."
              : "Enter the code to complete sign in."}
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
              </label>

              <button
                type="submit"
                disabled={busy}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#7a0000_0%,#991010_100%)] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_36px_rgba(122,0,0,0.18)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Sending code..." : "Continue"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
              <div className="rounded-[1.6rem] border border-[#ead8c4] bg-[#fffaf4] px-4 py-4">
                <div className="text-xs font-black uppercase tracking-[0.2em] text-[#7a0000]">
                  {identifierType === "email" ? "Verify with email OTP" : "Verify with SMS OTP"}
                </div>
                <div className="mt-2 text-sm text-slate-600">Enter the code we have sent to {otpDestination}.</div>
              </div>

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

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex flex-1 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#7a0000_0%,#991010_100%)] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_36px_rgba(122,0,0,0.18)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? "Verifying..." : "Verify OTP and sign in"}
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={busy || !canResend}
                  className="inline-flex items-center justify-center rounded-2xl border border-[#7a0000]/15 bg-[#fffaf4] px-5 py-3 text-sm font-semibold text-[#7a0000] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {canResend ? "Resend code" : `${cooldown}s`}
                </button>
              </div>

              <button
                type="button"
                onClick={resetFlow}
                className="inline-flex w-full items-center justify-center rounded-2xl border border-[#7a0000]/15 bg-white px-5 py-3 text-sm font-semibold text-[#7a0000]"
              >
                Change email or phone
              </button>
            </form>
          )}
        </div>
      </div>

      {step === "complete-profile" ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 px-4 py-4 sm:flex sm:items-center sm:justify-center sm:py-6">
          <div className="mx-auto w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[2rem] border border-[#7a0000]/10 bg-white p-5 shadow-[0_32px_80px_rgba(15,23,42,0.22)] sm:max-h-[calc(100vh-3rem)] sm:p-7">
            <div className="text-xs font-black uppercase tracking-[0.24em] text-[#7a0000]">Complete profile</div>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
              {isAgentFlow ? "Finish creating your agent account" : "Finish creating your account"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {isAgentFlow
                ? "Your OTP is verified. Add your details once so we can create your Betech agent account and log you in."
                : "Your OTP is verified. Add your details once so we can save your Betech customer account and log you in."}
            </p>

            <form onSubmit={handleCompleteProfile} className="mt-6 space-y-3 sm:space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Full name</span>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  className="w-full rounded-2xl border border-[#ead8c4] bg-[#fffdf9] px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#7a0000]/35 focus:ring-2 focus:ring-[#f2b20f]/30"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Email address</span>
                <input
                  type="email"
                  value={profileEmail}
                  onChange={(event) => setProfileEmail(event.target.value)}
                  className="w-full rounded-2xl border border-[#ead8c4] bg-[#fffdf9] px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#7a0000]/35 focus:ring-2 focus:ring-[#f2b20f]/30"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Phone number</span>
                <input
                  type="tel"
                  value={profilePhone}
                  onChange={(event) => setProfilePhone(event.target.value)}
                  placeholder="0712345678 or 0101234567"
                  className="w-full rounded-2xl border border-[#ead8c4] bg-[#fffdf9] px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#7a0000]/35 focus:ring-2 focus:ring-[#f2b20f]/30"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">County</span>
                  <select
                    value={profileCounty}
                    onChange={(event) => {
                      const nextCounty = event.target.value;
                      const nextTowns = getTownsForCounty(nextCounty);
                      setProfileCounty(nextCounty);
                      setProfileTown((current) => (nextTowns.some((town) => town === current) ? current : ""));
                    }}
                    className="w-full rounded-2xl border border-[#ead8c4] bg-[#fffdf9] px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#7a0000]/35 focus:ring-2 focus:ring-[#f2b20f]/30"
                  >
                    <option value="">Select county</option>
                    {kenyaCountyOptions.map((county) => (
                      <option key={county} value={county}>
                        {county}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Town / city</span>
                  <select
                    value={profileTown}
                    onChange={(event) => setProfileTown(event.target.value)}
                    disabled={!profileCounty}
                    className="w-full rounded-2xl border border-[#ead8c4] bg-[#fffdf9] px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#7a0000]/35 focus:ring-2 focus:ring-[#f2b20f]/30"
                  >
                    <option value="">{profileCounty ? "Select town / city" : "Choose county first"}</option>
                    {availableTowns.map((town) => (
                      <option key={town} value={town}>
                        {town}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Specific locality / estate / landmark</span>
                <input
                  type="text"
                  value={profileEstateLandmark}
                  onChange={(event) => setProfileEstateLandmark(event.target.value)}
                  className="w-full rounded-2xl border border-[#ead8c4] bg-[#fffdf9] px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#7a0000]/35 focus:ring-2 focus:ring-[#f2b20f]/30"
                />
              </label>

              <button
                type="submit"
                disabled={busy}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#7a0000_0%,#991010_100%)] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_36px_rgba(122,0,0,0.18)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Saving..." : "Submit and login"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
