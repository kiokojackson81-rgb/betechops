import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Platform } from '@prisma/client';
import { formatNairobiDate, mondayToSundayNairobiWindow, normalizeWeekStartFromParam } from '@/lib/weekWindow';
import { deriveStatementStatus } from '@/lib/statementStatus';
import { chooseAuthoritativeCandidate } from '@/lib/payoutWeekDedupe';
import { redirect } from 'next/navigation';

const currencyFormatter = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 0,
});

export const dynamic = 'force-dynamic';

type RowLike = {
  accountId: string;
  accountName: string;
  statementNumber: string | null;
  statusLabel: string;
  statusColor: string;
  payout: number;
  gross: number;
  rowId?: string | null;
};

export default async function WeekDetailPage({ params }: { params: { weekStart: string } }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== 'ADMIN' && role !== 'SUPERVISOR') return redirect('/not-authorized');

  const rawParam = params.weekStart ?? '';
  const weekStart = normalizeWeekStartFromParam(rawParam);
  if (!weekStart) return <div>Invalid week</div>;

  // find payout weeks matching this weekStart
  const weekWindow = mondayToSundayNairobiWindow(weekStart);
  const allAccounts = await prisma.marketplaceAccount.findMany({
    where: { platform: Platform.JUMIA, isActive: true },
    select: { id: true, displayName: true },
    orderBy: { displayName: 'asc' },
  });

  const rows = await prisma.marketplacePayoutWeek.findMany({
    where: {
      account: { platform: Platform.JUMIA },
      weekStart: { lte: weekWindow.weekEnd },
      weekEnd: { gte: weekWindow.weekStart },
    },
    include: { account: { select: { id: true, displayName: true, platform: true } } },
    orderBy: { payoutAmount: 'desc' },
  });

  type PayoutRow = (typeof rows)[number];
  const rowsByAccount = new Map<string, PayoutRow[]>();
  for (const row of rows) {
    const bucket = rowsByAccount.get(row.accountId) ?? [];
    bucket.push(row);
    rowsByAccount.set(row.accountId, bucket);
  }

  const canonicalStart = weekWindow.weekStart;

  const displayRows: RowLike[] = allAccounts.map((acct) => {
    const bucket = rowsByAccount.get(acct.id) ?? [];
    const row = chooseAuthoritativeCandidate(bucket, canonicalStart);

    if (!row) {
      return {
        accountId: acct.id,
        accountName: acct.displayName ?? acct.id,
        statementNumber: null,
        statusLabel: 'NO STATEMENT',
        statusColor: 'text-amber-200',
        payout: 0,
        gross: 0,
      };
    }

    const statusInfo = deriveStatementStatus(row.statementNumber, row.isPaid);
    const statusColor =
      statusInfo.label === 'OPEN'
        ? 'text-sky-300'
        : statusInfo.label === 'PAID'
          ? 'text-green-400'
          : 'text-yellow-300';

    return {
      accountId: acct.id,
      accountName: acct.displayName ?? row.account?.displayName ?? acct.id,
      statementNumber: row.statementNumber ?? null,
      statusLabel: statusInfo.label,
      statusColor,
      payout: Number(row.payoutAmount ?? row.grossSales ?? 0),
      gross: Number(row.grossSales ?? 0),
      rowId: row.id,
    };
  });

  displayRows.sort((a, b) => b.payout - a.payout);

  const missingCount = displayRows.filter((row) => row.statusLabel === 'NO STATEMENT').length;
  const weekLabel = `${formatNairobiDate(weekWindow.weekStart)} - ${formatNairobiDate(weekWindow.weekEnd)}`;
  const totalPayout = displayRows.reduce((sum, row) => sum + row.payout, 0);
  const totalGross = displayRows.reduce((sum, row) => sum + row.gross, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Payout week: {weekLabel}</h2>
        <div className="text-sm text-slate-300">
          Accounts: <span className="font-semibold text-white">{displayRows.length}</span>
          {missingCount > 0 ? (
            <span className="ml-2 text-amber-200">Missing statements: {missingCount}</span>
          ) : (
            <span className="ml-2 text-emerald-200">All statements present</span>
          )}
        </div>
        <div className="text-sm text-slate-400">
          Total payout: <span className="text-emerald-200">{currencyFormatter.format(totalPayout)}</span>{' '}
          <span className="mx-2">•</span>
          Total gross: <span className="text-white">{currencyFormatter.format(totalGross)}</span>
        </div>
      </div>
      {missingCount > 0 && (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100">
          Some accounts aren't yet backed by a statement row for this week. This usually means the Vendor Center
          hasn't published a payout in the canonical Nairobi week window yet.
        </div>
      )}
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
            {displayRows.map((row) => (
              <tr key={row.rowId ?? row.accountId} className="border-t border-white/5">
                <td className="py-3 pr-4 font-medium text-white">{row.accountName}</td>
                <td className="py-3 pr-4 text-slate-200">{row.statementNumber ?? '—'}</td>
                <td className="py-3 pr-4">
                  <span className={row.statusColor}>{row.statusLabel}</span>
                </td>
                <td className="py-3 pr-4 text-right text-emerald-200">{currencyFormatter.format(row.payout)}</td>
                <td className="py-3 pr-4 text-right text-white">{currencyFormatter.format(row.gross)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
