"use client";

import { useEffect, useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";

export default function AdminCustomerLoginPage() {
  const { status } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const params = useMemo(
    () => (typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search)),
    [],
  );
  const token = params.get("token") || "";
  const callbackUrl = params.get("callbackUrl") || "/account";

  useEffect(() => {
    if (status === "authenticated") {
      window.location.replace(callbackUrl);
      return;
    }
    if (!token) {
      setError("Missing customer login token.");
      setLoading(false);
      return;
    }

    let active = true;

    async function run() {
      const result = await signIn("phone-otp", {
        redirect: false,
        verificationToken: token,
        callbackUrl,
      });

      if (!active) return;

      if (!result?.ok) {
        setError(result?.error || "Unable to open the customer account right now.");
        setLoading(false);
        return;
      }

      window.location.replace(result.url || callbackUrl);
    }

    run().catch((signInError) => {
      if (!active) return;
      setError(signInError instanceof Error ? signInError.message : "Unable to open the customer account right now.");
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [callbackUrl, status, token]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(242,178,15,0.16),transparent_24%),linear-gradient(180deg,#fffdf8_0%,#fff3e5_100%)] px-4 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-md">
        <div className="rounded-[2rem] border border-[#7a0000]/10 bg-white p-6 shadow-[0_28px_70px_rgba(122,0,0,0.10)] sm:p-7">
          <div className="text-xs font-black uppercase tracking-[0.24em] text-[#7a0000]">Customer account</div>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Opening customer portal</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {loading
              ? "We are securely signing you into the linked customer account and loading the requested order view."
              : "The customer account could not be opened automatically."}
          </p>
          {error ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        </div>
      </div>
    </div>
  );
}
