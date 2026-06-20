"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { agentPath } from "@/lib/agents/host";

type AgentLoginFormProps = {
  useRootPaths?: boolean;
};

export default function AgentLoginForm({ useRootPaths = false }: AgentLoginFormProps) {
  const params = useSearchParams();
  const callbackUrl = params?.get("callbackUrl") || agentPath("/dashboard", useRootPaths);
  const otpHref = `/login/phone?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="space-y-2">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-[#7a0000]">Agent Portal</p>
        <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Welcome back</h1>
        <p className="text-base leading-7 text-slate-600 sm:leading-8">
          Sign in with your phone number or email OTP to manage referrals, track commissions, and submit customer orders.
        </p>
      </div>

      <div className="rounded-[1.4rem] border border-[#f2b20f]/20 bg-[#fff7e9] px-4 py-4 text-sm leading-7 text-slate-700">
        <div className="font-black uppercase tracking-[0.16em] text-[#7a0000]">Passwordless agent access</div>
        <div className="mt-2">
          We send a one-time code immediately. Existing agents go straight to the dashboard, and new agents finish a short profile once after OTP verification.
        </div>
      </div>

      <Link
        href={otpHref}
        className="flex h-14 w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#7a0000_0%,#9a1010_100%)] px-4 text-base font-bold text-white shadow-[0_18px_40px_rgba(122,0,0,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_50px_rgba(122,0,0,0.24)]"
      >
        Continue with OTP
      </Link>

      <div className="rounded-[1.4rem] border border-[#7a0000]/10 bg-white px-4 py-4 text-sm text-slate-600 shadow-[0_12px_24px_rgba(15,23,42,0.04)]">
        <div className="font-semibold text-slate-800">New agent?</div>
        <Link href={otpHref} className="mt-1 inline-flex font-bold text-[#7a0000] hover:text-[#9a1010]">
          Create your BETECH affiliate account
        </Link>
      </div>
    </div>
  );
}
