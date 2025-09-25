"use client";

import { signIn } from "next-auth/react";

export default function AdminLoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b0e13] text-slate-100">
      {/* BG gradient + subtle glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-80 w-[38rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-yellow-400/20 via-amber-300/10 to-fuchsia-500/10 blur-3xl" />
        <div className="absolute bottom-[-10rem] right-[-8rem] h-96 w-[40rem] rounded-full bg-gradient-to-tr from-purple-700/20 to-blue-600/20 blur-3xl" />
      </div>

      {/* Content */}
      <main className="relative mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
        <div className="grid w-full gap-10 md:grid-cols-2">
          {/* Left: Brand + copy */}
          <section className="flex flex-col items-start justify-center">
            <div className="mb-6 inline-flex items-center gap-3">
              {/* Simple mark */}
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 shadow-[0_8px_30px_rgba(0,0,0,.3)]" />
              <div>
                <div className="text-lg font-semibold">BetechOps</div>
                <div className="text-xs text-slate-400">Operations Control Center</div>
              </div>
            </div>

            <h1 className="mb-3 text-3xl font-semibold leading-tight md:text-4xl">
              Admin Login
            </h1>
            <p className="max-w-md text-slate-400">
              Sign in to manage shops, attendants, pricing, returns, and reports.
              Only authorized admins can access the Admin Portal.
            </p>
          </section>

          {/* Right: Card */}
          <section className="flex items-center justify-center">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(18,22,32,.9),rgba(18,22,32,.7))] p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)] backdrop-blur">
              <button
                onClick={() => signIn("google", { callbackUrl: "/admin" })}
                className="group flex w-full items-center justify-center gap-3 rounded-xl bg-yellow-400 px-5 py-3 font-semibold text-black transition hover:bg-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-400/60"
                aria-label="Continue with Google"
              >
                {/* Google 'G' */}
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#EA4335" d="M12 10.2v3.92h5.46c-.24 1.4-1.65 4.1-5.46 4.1-3.29 0-5.97-2.72-5.97-6.07S8.71 6.1 12 6.1c1.88 0 3.14.8 3.86 1.48l2.62-2.53C17.23 3.5 14.86 2.5 12 2.5 6.99 2.5 2.94 6.53 2.94 12S6.99 21.5 12 21.5c6.9 0 9.55-4.82 9.55-7.2 0-.48-.05-.84-.11-1.2H12Z"/>
                </svg>
                Continue with Google
              </button>

              <div className="mt-4 text-center text-xs text-slate-400">
                You’ll be redirected to Google to sign in. Non-admin accounts will be bounced back here.
              </div>

              <div className="mt-6 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              <div className="mt-6 space-y-2 text-xs text-slate-500">
                <p>By continuing, you agree to our acceptable use and security policies.</p>
                <p>
                  Problems signing in? Contact{" "}
                  <a href="mailto:kiokojackson81@gmail.com" className="text-slate-300 underline underline-offset-2">
                    support
                  </a>.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
