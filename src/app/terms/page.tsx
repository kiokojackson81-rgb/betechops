import Link from "next/link";

export const metadata = {
  title: "Terms of Service",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#040713] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(5,8,17,0.95),rgba(6,9,18,0.88))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] sm:p-8">
        <div className="text-[11px] uppercase tracking-[0.34em] text-cyan-300">BetechOps</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Terms of Service</h1>
        <div className="mt-6 space-y-4 text-sm leading-7 text-slate-300">
          <p>BetechOps provides secure access to Betech Solar Solutions digital services and operational workflows.</p>
          <p>Access to staff and internal tools is restricted to authorized users using approved credentials.</p>
          <p>Users must keep account credentials private and use the platform only for permitted Betech Solar activities.</p>
          <p>Unauthorized access attempts, misuse of protected tools, or interference with platform operations may result in immediate access restriction.</p>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="mailto:info@betech.co.ke?subject=BetechOps%20Terms%20Question"
            className="rounded-2xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20"
          >
            Ask a question
          </a>
          <Link
            href="/"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10"
          >
            Back to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
