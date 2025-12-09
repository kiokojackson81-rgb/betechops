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
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
              <h2 className="text-lg font-semibold text-white">Capture daily receipts</h2>
              <p className="mt-2 text-sm text-slate-400">
                The weekly manual form has moved to the admin desk. Continue logging every WhatsApp or walk-in sale through the daily report so support can reconcile payouts.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/attendant/daily-report"
                  className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-black hover:brightness-95"
                >
                  Open daily report
                </Link>
                <Link href="/admin/online/manual" className="text-sm text-slate-400 hover:text-slate-200">
                  Need an override? Ping your supervisor or open the admin desk →
                </Link>
              </div>
            </div>
          </div>
          <div>
            <EarningsCard variant="onlineOps" />
          </div>
        </div>
      </div>
    </div>
  );
}
