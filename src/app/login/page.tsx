"use client";

import CredentialLoginForm from "@/components/CredentialLoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(18,22,32,.9),rgba(18,22,32,.7))] p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)]">
        <CredentialLoginForm
          defaultRedirect="/attendant"
          title="BetechOps sign in"
          description="Use your @betech.co.ke credentials to access the platform."
        />
      </div>
    </div>
  );
}
