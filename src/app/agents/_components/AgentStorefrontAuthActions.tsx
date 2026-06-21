"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

type AgentStorefrontAuthActionsProps = {
  dashboardHref: string;
  loginHref: string;
  homeHref: string;
  loggedIn: boolean;
};

export default function AgentStorefrontAuthActions({
  dashboardHref,
  loginHref,
  homeHref,
  loggedIn,
}: AgentStorefrontAuthActionsProps) {
  if (!loggedIn) {
    return (
      <Link
        href={loginHref}
        className="inline-flex min-h-[2.75rem] items-center justify-center rounded-2xl border border-[#7a0000]/12 bg-white px-4 py-3 text-sm font-semibold text-[#7a0000] shadow-[0_12px_24px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5"
      >
        Login
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap justify-end gap-2.5">
      <Link
        href={dashboardHref}
        className="inline-flex min-h-[2.75rem] items-center justify-center rounded-2xl bg-[#7a0000] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(122,0,0,0.16)] transition hover:-translate-y-0.5"
      >
        Go to dashboard
      </Link>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: homeHref })}
        className="inline-flex min-h-[2.75rem] items-center justify-center rounded-2xl border border-[#7a0000]/12 bg-white px-4 py-3 text-sm font-semibold text-[#7a0000] shadow-[0_12px_24px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5"
      >
        Logout
      </button>
    </div>
  );
}
