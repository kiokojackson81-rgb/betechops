import 'dotenv/config';
import { recomputeMarketingCommissionLedger } from '../src/lib/marketingPeriodTotals.ts';
import { getTradingPeriodFor } from '../src/lib/tradingPeriod.ts';

async function main() {
  const userId = process.argv[2] || 'cmimxqfnr0005v5mc05nwhg9o';
  const dateArg = process.argv[3];
  const period = dateArg ? getTradingPeriodFor(new Date(dateArg)) : getTradingPeriodFor(new Date());

  console.log('Recomputing ledger for', userId, 'period', period.label);
  const res = await recomputeMarketingCommissionLedger({ userId, period });
  console.log('Recompute result:', JSON.stringify(res, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
