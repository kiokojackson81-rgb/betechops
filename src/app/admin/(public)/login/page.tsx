"use client";

export const dynamic = "force-dynamic";

import React, { Suspense } from "react";
import CredentialLoginForm from "@/components/CredentialLoginForm";

export default function AdminLoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b0e13] text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-80 w-[38rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-yellow-400/20 via-amber-300/10 to-fuchsia-500/10 blur-3xl" />
        <div className="absolute bottom-[-10rem] right-[-8rem] h-96 w-[40rem] rounded-full bg-gradient-to-tr from-purple-700/20 to-blue-600/20 blur-3xl" />
      </div>

      <main className="relative mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
        <div className="grid w-full gap-10 md:grid-cols-2">
          <section className="flex flex-col items-start justify-center space-y-3">
            <div className="inline-flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 shadow-[0_8px_30px_rgba(0,0,0,.3)]" />
              <div>
                <div className="text-lg font-semibold">BetechOps</div>
                <div className="text-xs text-slate-400">Operations Control Center</div>
              </div>
            </div>

            <h1 className="text-3xl font-semibold leading-tight md:text-4xl">Admin Login</h1>
            <p className="max-w-md text-slate-400">
              Sign in with your company email and password to manage shops, attendants, and reports.
            </p>
          </section>

          <section className="flex items-center justify-center">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(18,22,32,.9),rgba(18,22,32,.7))] p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)] backdrop-blur">
              <Suspense fallback={<div className="py-6">Loading…</div>}>
                <CredentialLoginForm defaultRedirect="/auth/post-login?intended=admin" title="Admin sign in" description="Admins use your betech.co.ke email and password." />
              </Suspense>
              <div className="mt-6 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <div className="mt-4 text-xs text-slate-400">
                Need help? Email{" "}
                <a href="mailto:kiokojackson81@gmail.com" className="underline underline-offset-2 text-slate-300 hover:text-white">
                  support
                </a>
                .
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
