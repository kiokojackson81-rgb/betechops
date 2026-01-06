import { reconcileWeeks } from '../src/lib/jobs/onlineReconcile.ts';

(async () => {
  const weeks = Number(process.argv[2] || 12);
  const targetWeekStart = process.argv[3] || null; // e.g. '2025-12-29'
  const res = await reconcileWeeks(weeks);
  console.log('Reconciliation report (most recent first):');
  for (const r of res) {
    if (targetWeekStart && r.weekStart !== targetWeekStart) continue;
    console.log(`- ${r.weekStart} -> ${r.weekEnd}: payoutRows=${r.payoutRows}, gross=${r.totalGross.toFixed(2)}, weeklySum=${r.weeklySum.toFixed(2)}, duplicates=${r.duplicates}, missingSids=${r.missingSids}`);
  }
  process.exit(0);
})();
