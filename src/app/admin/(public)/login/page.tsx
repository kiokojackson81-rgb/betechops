"use client";

import EmailLoginForm from "@/components/EmailLoginForm";

export default function AdminLoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b0e13] text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-80 w-[38rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-yellow-400/20 via-amber-300/10 to-fuchsia-500/10 blur-3xl" />
        <div className="absolute bottom-[-10rem] right-[-8rem] h-96 w-[40rem] rounded-full bg-gradient-to-tr from-purple-700/20 to-blue-600/20 blur-3xl" />
      </div>

      <main className="relative mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
        <div className="grid w-full gap-10 md:grid-cols-2">
          <section className="flex flex-col items-start justify-center">
            <div className="mb-6 inline-flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 shadow-[0_8px_30px_rgba(0,0,0,.3)]" />
              <div>
                <div className="text-lg font-semibold">BetechOps</div>
                <div className="text-xs text-slate-400">Operations Control Center</div>
              </div>
            </div>

            <h1 className="mb-3 text-3xl font-semibold leading-tight md:text-4xl">Admin Login</h1>
            <p className="max-w-md text-slate-400">
              Use your company email to manage shops, attendants, and operational reporting.
            </p>
          </section>

          <section className="flex items-center justify-center">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(18,22,32,.9),rgba(18,22,32,.7))] p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)] backdrop-blur">
              <EmailLoginForm callbackUrl="/admin" buttonText="Send admin link" placeholder="admin@betech.co.ke" />

              <div className="mt-4 text-center text-xs text-slate-400">
                You'll receive a secure link directly in your inbox.
              </div>

              <div className="mt-6 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              <div className="mt-6 space-y-2 text-xs text-slate-500">
                <p>By continuing, you agree to our security policies.</p>
                <p>
                  Need help? Email{" "}
                  <a href="mailto:kiokojackson81@gmail.com" className="text-slate-300 underline underline-offset-2">
                    support
                  </a>
                  .
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
