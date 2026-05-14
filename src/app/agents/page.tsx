import Link from "next/link";
import { BarChart3, CreditCard, ShieldCheck, Users } from "lucide-react";

const featureCards = [
  {
    icon: Users,
    title: "Referral growth",
    copy: "Share your BETECH code, onboard customers, and watch referrals turn into tracked sales.",
  },
  {
    icon: BarChart3,
    title: "Commission visibility",
    copy: "See pending and paid commission totals without waiting for manual updates.",
  },
  {
    icon: CreditCard,
    title: "Payout requests",
    copy: "Submit payout requests from the same dashboard that holds your earnings history.",
  },
  {
    icon: ShieldCheck,
    title: "KYC and approval",
    copy: "Keep your profile, ID documents, and payout details in one secure workflow.",
  },
];

export default function AgentsLandingPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.22),transparent_30%),linear-gradient(180deg,#020617_0%,#0f172a_52%,#020617_100%)] px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-10">
        <section className="grid gap-8 overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(140deg,rgba(15,23,42,.95),rgba(2,6,23,.98))] p-8 shadow-[0_30px_90px_rgba(0,0,0,.35)] lg:grid-cols-[1.25fr_0.75fr] lg:p-12">
          <div className="space-y-6">
            <div className="inline-flex rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200">
              BETECH Agents
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
                One affiliate workspace for referrals, commissions, and payouts.
              </h1>
              <p className="max-w-2xl text-base text-slate-400 md:text-lg">
                This module runs inside the existing BETECHOPS platform and gives agents a focused portal for performance,
                earnings, and KYC approval without touching the core ops workflows.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link href="/agents/register" className="rounded-2xl bg-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:brightness-95">
                Create account
              </Link>
              <Link href="/agents/login" className="rounded-2xl border border-white/10 px-5 py-3 font-semibold text-white transition hover:border-white/20">
                Sign in
              </Link>
              <Link href="/agents/dashboard" className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-3 font-semibold text-cyan-100 transition hover:border-cyan-300/40">
                Open dashboard
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Agent stack</div>
              <div className="mt-3 text-3xl font-semibold text-white">Referral + payout visibility</div>
              <p className="mt-3 text-sm text-slate-400">
                Designed for `agents.betech.co.ke`, but backed by the same Postgres and Prisma setup already used by ops.
              </p>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Admin control</div>
              <div className="mt-3 text-3xl font-semibold text-white">Approve KYC, monitor performance</div>
              <p className="mt-3 text-sm text-slate-400">
                Admins can review profiles, referral output, commissions, and payout activity from the shared back office.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {featureCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className="rounded-[28px] border border-white/10 bg-slate-950/70 p-6">
                <div className="inline-flex rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-emerald-200">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-5 text-xl font-semibold text-white">{card.title}</h2>
                <p className="mt-3 text-sm text-slate-400">{card.copy}</p>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
