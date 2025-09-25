"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";

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
            <p className="max-w-md text-slate-400">Sign in to manage orders, pricing, and returns for your assigned shop(s).</p>

            <div className="mt-6 md:hidden">
              <LoginButton />
            </div>

            <div className="mt-6 text-xs text-slate-500 md:mt-10">
              <Link href="/" className="underline underline-offset-2 text-slate-300 hover:text-white">← Back to Home</Link>
            </div>
          </section>

          <section className="hidden items-center justify-center md:flex">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(18,22,32,.9),rgba(18,22,32,.7))] p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)] backdrop-blur">
              <LoginButton />

              <div className="mt-4 text-center text-xs text-slate-400">You’ll be redirected to Google to sign in.</div>

              <div className="mt-6 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              <div className="mt-6 space-y-2 text-xs text-slate-500">
                <p>Having trouble? Contact your admin for access.</p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function LoginButton() {
  return (
    <button
      onClick={() => signIn("google", { callbackUrl: "/attendant" })}
      className="group flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-slate-100 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
      aria-label="Continue with Google"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#EA4335" d="M12 10.2v3.92h5.46c-.24 1.4-1.65 4.1-5.46 4.1-3.29 0-5.97-2.72-5.97-6.07S8.71 6.1 12 6.1c1.88 0 3.14.8 3.86 1.48l2.62-2.53C17.23 3.5 14.86 2.5 12 2.5 6.99 2.5 2.94 6.53 2.94 12S6.99 21.5 12 21.5c6.9 0 9.55-4.82 9.55-7.2 0-.48-.05-.84-.11-1.2H12Z"/>
      </svg>
      Continue with Google
    </button>
  );
}
