import Link from "next/link";
import QuickStats from "@/app/attendant/_components/QuickStats";
import { EarningsCard } from "@/components/EarningsCard";

export default function AttendantOnlineOpsPage() {
  return (
    <div className="min-h-screen bg-slate-950 px-4 pb-16 text-slate-50">
      <div className="mx-auto w-full max-w-6xl space-y-8 pt-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">Jumia / Kilimall Ops</p>
          <h1 className="text-2xl font-semibold">Online sales dashboard</h1>
          <p className="text-sm text-slate-400">
            Record every receipt through the daily report tool. Marketplace statements now sync automatically and are reviewed by admins. Only approved entries contribute to your commissions.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)]">
          <div className="space-y-4">
            <QuickStats />
            <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-400">Sales records</p>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold text-white">Add each receipt for today</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    The weekly manual form has moved to the admin desk. Continue logging every WhatsApp or walk-in sale through the daily report so support can reconcile payouts.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/attendant/daily-report"
                    className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-black hover:brightness-95"
                  >
                    Open daily report
                  </Link>
                  <Link
                    href="/admin/online/manual"
                    className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
                  >
                    Admin desk
                  </Link>
                </div>
              </div>
              <div className="mt-6 rounded-2xl border border-white/5 bg-slate-950/40 p-4 text-sm text-slate-300">
                <p>
                  Need an override? Ping your supervisor or open the admin desk so they can review the payout period, approve manual adjustments, or sync marketplace statements for you.
                </p>
              </div>
            </section>
          </div>
          <div>
            <EarningsCard variant="onlineOps" />
          </div>
        </div>
      </div>
    </div>
  );
}
