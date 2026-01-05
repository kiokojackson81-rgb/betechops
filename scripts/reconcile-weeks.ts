import 'tsconfig-paths/register';
import { reconcileWeeks } from '../src/lib/jobs/onlineReconcile';

(async () => {
  const weeks = Number(process.argv[2] || 8);
  const res = await reconcileWeeks(weeks);
  console.log('Reconciliation report (most recent first):');
  for (const r of res) {
    console.log(`- ${r.weekStart} -> ${r.weekEnd}: payoutRows=${r.payoutRows}, gross=${r.totalGross.toFixed(2)}, weeklySum=${r.weeklySum.toFixed(2)}, duplicates=${r.duplicates}, missingSids=${r.missingSids}`);
  }
  process.exit(0);
})();
