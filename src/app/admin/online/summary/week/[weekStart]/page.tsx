import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatJumiaWeekLabel } from '@/lib/tradingPeriod';
import { redirect } from 'next/navigation';

const currencyFormatter = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('en-KE');

export const dynamic = 'force-dynamic';

export default async function WeekDetailPage({ params }: { params: { weekStart: string } }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== 'ADMIN' && role !== 'SUPERVISOR') return redirect('/not-authorized');

  const weekStartIso = decodeURIComponent(params.weekStart);
  const start = new Date(weekStartIso);
  if (Number.isNaN(start.getTime())) return <div>Invalid week</div>;

  // find payout weeks matching this weekStart
  const weeks = await prisma.marketplacePayoutWeek.findMany({
    where: { weekStart: start },
    include: { account: true },
    orderBy: { payoutAmount: 'desc' },
  });

  if (!weeks.length) return <div className="p-6">No payout data for this week.</div>;

  const weekLabel = formatJumiaWeekLabel(weeks[0].weekStart, weeks[0].weekEnd);
  const weekTotalGross = weeks.reduce((total, entry) => total + Number(entry.grossSales ?? 0), 0);
  const weekTotalPayout = weeks.reduce((total, entry) => total + Number(entry.payoutAmount ?? 0), 0);
  const paidStatements = weeks.filter((entry) => entry.isPaid).length;
  const statementsCount = weeks.length;
  const unpaidStatements = statementsCount - paidStatements;

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-xl font-semibold">Payout week: {weekLabel}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Gross sales total</p>
          <p className="mt-2 text-lg font-semibold text-white">{currencyFormatter.format(weekTotalGross)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Payout total</p>
          <p className="mt-2 text-lg font-semibold text-emerald-200">{currencyFormatter.format(weekTotalPayout)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Statements synced</p>
          <p className="mt-2 text-lg font-semibold text-white">{numberFormatter.format(statementsCount)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Paid / unpaid</p>
          <p className="mt-2 text-lg font-semibold text-emerald-200">{numberFormatter.format(paidStatements)} paid</p>
          <p className="text-sm text-yellow-300">{numberFormatter.format(unpaidStatements)} unpaid</p>
        </div>
      </div>
      <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="py-2 pr-4">Account</th>
              <th className="py-2 pr-4 text-right">Payout</th>
              <th className="py-2 pr-4 text-right">Gross sales</th>
              <th className="py-2 pr-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.id} className="border-t border-white/5">
                <td className="py-3 pr-4 font-medium text-white">{w.account?.displayName ?? w.accountId}</td>
                <td className="py-3 pr-4 text-right text-emerald-200">{currencyFormatter.format(Number(w.payoutAmount ?? 0))}</td>
                <td className="py-3 pr-4 text-right text-white">{currencyFormatter.format(Number(w.grossSales ?? 0))}</td>
                <td className="py-3 pr-4">{w.isPaid ? <span className="text-green-400">PAID</span> : <span className="text-yellow-300">UNPAID</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
