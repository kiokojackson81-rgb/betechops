import Link from "next/link";

export const metadata = {
  title: "Help",
};

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-[#040713] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(5,8,17,0.95),rgba(6,9,18,0.88))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] sm:p-8">
        <div className="text-[11px] uppercase tracking-[0.34em] text-cyan-300">BetechOps</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Help</h1>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          Need assistance with login, access, or navigating BetechOps? Our team can help you reach the correct Betech Solar channel.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <a
            href="mailto:info@betech.co.ke?subject=BetechOps%20Help"
            className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-4 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20"
          >
            Email support
          </a>
          <a
            href="https://www.betech.co.ke/"
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm font-semibold text-slate-200 hover:bg-white/10"
          >
            Visit Betech Solar website
          </a>
        </div>
        <div className="mt-8">
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
