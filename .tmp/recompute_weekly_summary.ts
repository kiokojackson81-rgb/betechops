import { recomputeWeeklySummary, uniqueAccountCountForWindow } from "../src/lib/jobs/recomputeWeeklySummaries.ts";

async function main() {
  const startArg = process.argv[2] || '2025-12-29';
  const endArg = process.argv[3] || '2026-01-04';
  const start = new Date(startArg + 'T00:00:00Z');
  const end = new Date(endArg + 'T23:59:59.999Z');
  console.log('Recomputing weekly summary for', start.toISOString().slice(0,10), '->', end.toISOString().slice(0,10));

  const aggs = await recomputeWeeklySummary(start, end);
  console.log('Unique account groups:', aggs.length);
  let totalPayout = 0;
  let totalGross = 0;
  for (const a of aggs) {
    totalPayout += a.totalPayout;
    totalGross += a.totalGross;
    console.log(`- ${a.accountId}: payout=${a.totalPayout.toFixed(2)} gross=${a.totalGross.toFixed(2)}`);
  }
  console.log('Totals: payout=', totalPayout.toFixed(2), 'gross=', totalGross.toFixed(2));

  const uniqueCount = await uniqueAccountCountForWindow(start, end);
  console.log('Unique account count (per week grouping):', uniqueCount);

  // If manual truth exists, compare
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const manual = require('../.tmp/manual_payouts.json');
    const manualTotal = (manual.reduce((s:any, it:any) => s + Number(it.payoutAmount ?? 0), 0) || 0);
    console.log('Manual total payout:', manualTotal.toFixed(2));
    console.log('Difference (manual - computed):', (manualTotal - totalPayout).toFixed(2));
  } catch (err) {
    // ignore if manual file missing
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
