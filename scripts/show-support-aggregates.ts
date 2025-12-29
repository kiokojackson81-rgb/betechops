import 'dotenv/config';
import { getTradingPeriodFor } from '../src/lib/tradingPeriod.ts';
import { getSupportPeriodAggregates } from '../src/lib/supportEntries.ts';

async function main() {
  const userId = process.argv[2] || 'cmimxqfnr0005v5mc05nwhg9o';
  const period = getTradingPeriodFor(new Date());
  console.log('Period:', period.label);
  const summary = await getSupportPeriodAggregates({ userId, period });
  console.log('Support aggregates:', JSON.stringify(summary, null, 2));
}

main().catch((e)=>{ console.error(e); process.exit(1); });
