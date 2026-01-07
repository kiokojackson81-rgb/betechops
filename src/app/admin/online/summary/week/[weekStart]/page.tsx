import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Platform } from '@prisma/client';
import {
  canonicalNairobiWeekStartUtc,
  formatNairobiDate,
  mondayToSundayNairobiWindow,
  normalizeWeekStartFromParam,
  parseDateOnlyUtc,
} from '@/lib/weekWindow';
import { deriveStatementStatus } from '@/lib/statementStatus';
import { redirect } from 'next/navigation';

const currencyFormatter = new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 });

export const dynamic = 'force-dynamic';

export default async function WeekDetailPage({ params }: { params: { weekStart: string } }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== 'ADMIN' && role !== 'SUPERVISOR') return redirect('/not-authorized');

  const rawParam = params.weekStart ?? '';
  const weekStart = normalizeWeekStartFromParam(rawParam);
  if (!weekStart) return <div>Invalid week</div>;

  // find payout weeks matching this weekStart
  const weekWindow = mondayToSundayNairobiWindow(weekStart);
  const rows = await prisma.marketplacePayoutWeek.findMany({
    where: {
      account: { platform: Platform.JUMIA },
      weekStart: { lte: weekWindow.weekEnd },
      weekEnd: { gte: weekWindow.weekStart },
    },
    include: { account: true },
    orderBy: { payoutAmount: 'desc' },
  });

  if (!rows.length) return <div className="p-6">No payout data for this week.</div>;

  type PayoutRow = (typeof rows)[number];
  const rowsByAccount = new Map<string, PayoutRow[]>();
  for (const row of rows) {
    const bucket = rowsByAccount.get(row.accountId) ?? [];
    bucket.push(row);
    rowsByAccount.set(row.accountId, bucket);
  }

  const canonicalStart = weekWindow.weekStart;

  const chooseBestRow = (group: PayoutRow[]): PayoutRow => {
    let best: { row: PayoutRow; score: number } | null = null;
    for (const candidate of group) {
      const rowStart = canonicalNairobiWeekStartUtc(new Date(candidate.weekStart));
      const diff = Math.abs(rowStart.getTime() - canonicalStart.getTime());
      const payload = candidate.rawPayload as any;
      const periodStart = parseDateOnlyUtc(payload?.period?.startDate ?? null);
      const periodMatch = periodStart ? canonicalNairobiWeekStartUtc(periodStart).getTime() === canonicalStart.getTime() : false;
      const normalizedNumber = String(candidate.statementNumber ?? "").toUpperCase();
      const hasSuffix = /(OPEN|PAID|UNPAID)$/.test(normalizedNumber);
      const updatedScore = (candidate.updatedAt?.getTime() ?? 0) / 1_000_000;
      const score = (periodMatch ? 100 : 0) - diff + (hasSuffix ? 10 : 0) + updatedScore;
      if (!best || score > best.score) {
        best = { row: candidate, score };
      }
    }
    return best?.row ?? group[0];
  };

  const dedupedRows = Array.from(rowsByAccount.values()).map((group) => chooseBestRow(group));
  dedupedRows.sort((a, b) => (Number(b.payoutAmount ?? b.grossSales ?? 0) - Number(a.payoutAmount ?? a.grossSales ?? 0)));

  const weekLabel = `${formatNairobiDate(weekWindow.weekStart)} - ${formatNairobiDate(weekWindow.weekEnd)}`;

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-xl font-semibold">Payout week: {weekLabel}</h2>
      <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="py-2 pr-4">Account</th>
              <th className="py-2 pr-4">Statement</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4 text-right">Payout</th>
              <th className="py-2 pr-4 text-right">Gross sales</th>
            </tr>
          </thead>
          <tbody>
            {dedupedRows.map((row) => {
              const statusInfo = deriveStatementStatus(row.statementNumber, row.isPaid);
              const statusColor =
                statusInfo.label === 'OPEN'
                  ? 'text-sky-300'
                  : statusInfo.label === 'PAID'
                    ? 'text-green-400'
                    : 'text-yellow-300';
              return (
                <tr key={row.id} className="border-t border-white/5">
                  <td className="py-3 pr-4 font-medium text-white">{row.account?.displayName ?? row.accountId}</td>
                  <td className="py-3 pr-4 text-slate-200">{row.statementNumber ?? '—'}</td>
                  <td className="py-3 pr-4"><span className={statusColor}>{statusInfo.label}</span></td>
                  <td className="py-3 pr-4 text-right text-emerald-200">{currencyFormatter.format(Number(row.payoutAmount ?? row.grossSales ?? 0))}</td>
                  <td className="py-3 pr-4 text-right text-white">{currencyFormatter.format(Number(row.grossSales ?? 0))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
