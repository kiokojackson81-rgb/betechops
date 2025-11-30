"use client";

import Link from "next/link";
import CredentialLoginForm from "@/components/CredentialLoginForm";

export default function AttendantLoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b0e13] text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 left-1/2 h-72 w-[30rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-sky-400/25 via-cyan-300/10 to-fuchsia-500/10 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-[-8rem] h-96 w-[36rem] rounded-full bg-gradient-to-tr from-indigo-600/20 to-blue-500/20 blur-3xl" />
      </div>

      <main className="relative mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
        <div className="grid w-full gap-8 md:grid-cols-2">
          <section className="flex flex-col items-start justify-center">
            <div className="mb-6 inline-flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 shadow-[0_8px_30px_rgba(0,0,0,.3)]" />
              <div>
                <div className="text-lg font-semibold">BetechOps</div>
                <div className="text-xs text-slate-400">Attendant Portal</div>
              </div>
            </div>

            <h1 className="mb-3 text-3xl font-semibold leading-tight md:text-4xl">Attendant Login</h1>
            <p className="max-w-md text-slate-400">
              Sign in with your company email and password to manage your daily tasks.
            </p>
            <div className="mt-6 text-xs text-slate-500 md:mt-10">
              <Link href="/" className="underline underline-offset-2 text-slate-300 hover:text-white">
                Back to Home
              </Link>
            </div>
          </section>

          <section className="flex items-center justify-center">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(18,22,32,.9),rgba(18,22,32,.7))] p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)] backdrop-blur">
              <CredentialLoginForm
                defaultRedirect="/attendant"
                title="Credential login"
                description="Use your @betech.co.ke email and password."
              />
              <div className="mt-4 text-center text-xs text-slate-400">
                Need help? Contact your admin.
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
