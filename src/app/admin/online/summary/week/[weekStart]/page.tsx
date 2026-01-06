import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { mondayToSundayLocalWindow, normalizeWeekStartFromParam } from '@/lib/weekWindow';
import { redirect } from 'next/navigation';

const currencyFormatter = new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 });

export const dynamic = 'force-dynamic';

export default async function WeekDetailPage({ params }: { params: { weekStart: string } }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== 'ADMIN' && role !== 'SUPERVISOR') return redirect('/not-authorized');

  const rawParam = params.weekStart ?? '';
  let weekStart = normalizeWeekStartFromParam(rawParam);
  if (!weekStart) {
    try {
      const decoded = decodeURIComponent(rawParam);
      const parsed = new Date(decoded);
      if (!Number.isNaN(parsed.getTime())) {
        weekStart = mondayToSundayLocalWindow(parsed).weekStart;
      }
    } catch {
      weekStart = null;
    }
  }
  if (!weekStart) return <div>Invalid week</div>;

  // find payout weeks matching this weekStart
  const weeks = await prisma.marketplacePayoutWeek.findMany({
    where: { weekStart },
    include: { account: true },
    orderBy: { payoutAmount: 'desc' },
  });

  if (!weeks.length) return <div className="p-6">No payout data for this week.</div>;

  const weekWindow = mondayToSundayLocalWindow(weekStart);
  const weekLabel = `${weekWindow.weekStart.toLocaleDateString()} - ${weekWindow.weekEnd.toLocaleDateString()}`;

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-xl font-semibold">Payout week: {weekLabel}</h2>
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
