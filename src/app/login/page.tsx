export const dynamic = "force-dynamic";
import React, { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import CredentialLoginForm from "@/components/CredentialLoginForm";
import { isAgentsHost } from "@/lib/agents/host";
import { isOpsHost } from "@/lib/runtimeUrls";

export default async function LoginPage() {
  const host = (await headers()).get("host");
  if (isAgentsHost(host)) {
    redirect("/login/phone?callbackUrl=/account");
  }

  if (!isOpsHost(host)) {
    redirect("/login/phone");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(18,22,32,.9),rgba(18,22,32,.7))] p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)]">
        <Suspense fallback={<div className="py-6">Loading…</div>}>
          <CredentialLoginForm defaultRedirect="/auth/post-login" title="BetechOps sign in" description="Use your @betech.co.ke credentials to access the platform." />
        </Suspense>
      </div>
    </div>
  );
}
