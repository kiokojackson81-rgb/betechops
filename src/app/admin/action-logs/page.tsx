import { prisma } from '@/lib/prisma';
import { formatISO } from 'date-fns';

export const dynamic = 'force-dynamic';

export default async function ActionLogsPage() {
  // Fetch recent action logs related to marketing entries
  const logs = await prisma.actionLog.findMany({
    where: { OR: [{ entity: 'MarketingDailyEntry' }, { action: 'WIPE_RECEIPTS' }] },
    include: { actor: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <div className="mx-auto max-w-6xl p-6 text-slate-100">
      <h1 className="text-2xl font-semibold mb-4">Action logs</h1>
      <p className="text-sm text-slate-400 mb-4">Recent actions for MarketingDailyEntry and wipes. Useful for audits and reversals.</p>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 p-2">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-950/80 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Entity</th>
              <th className="px-3 py-2">Entity ID</th>
              <th className="px-3 py-2">Before</th>
              <th className="px-3 py-2">After</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-slate-800 odd:bg-slate-950/40">
                <td className="px-3 py-2 text-slate-200">{new Date(l.createdAt).toISOString()}</td>
                <td className="px-3 py-2 text-slate-200">{(l.actor && (l.actor.email || l.actor.name)) || 'system'}</td>
                <td className="px-3 py-2 text-slate-200">{l.action}</td>
                <td className="px-3 py-2 text-slate-200">{l.entity}</td>
                <td className="px-3 py-2 text-slate-200">{l.entityId}</td>
                <td className="px-3 py-2 text-slate-200" title={JSON.stringify(l.before || {}).slice(0, 1000)}>
                  <pre className="whitespace-pre-wrap max-h-40 overflow-auto text-xs">{JSON.stringify(l.before || {}, null, 2)}</pre>
                </td>
                <td className="px-3 py-2 text-slate-200" title={JSON.stringify(l.after || {}).slice(0, 1000)}>
                  <pre className="whitespace-pre-wrap max-h-40 overflow-auto text-xs">{JSON.stringify(l.after || {}, null, 2)}</pre>
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-slate-400" colSpan={7}>
                  No action logs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
